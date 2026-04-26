/**
 * Build MCP server data for all packages and tools.
 *
 * Consumes TypeDoc JSON output (one pass per package) and emits a flat,
 * worker-friendly index under <target>/:
 *
 *   index.json                  — package list + descriptions
 *   search.json                 — flat array of every symbol for search
 *   packages/<pkg>.json         — per-package symbol map for get_symbol
 *   packages/<pkg>/guide.md     — README content for get_guide
 *
 * Usage:
 *   bun run scripts/build-mcp.ts                                         # → mcp-data/
 *   bun run scripts/build-mcp.ts --target=path/to/dir
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const ROOT_DIR = join(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT_DIR, "packages");
const TOOLS_DIR = join(ROOT_DIR, "tools");

const DOCS_URL = "https://docs.bcts.dev";
const REPO_URL = "https://github.com/paritytech/bcts";

function parseTargetArg(argv: string[]): string {
  for (const arg of argv) {
    if (arg.startsWith("--target=")) {
      const raw = arg.slice("--target=".length);
      if (!raw) throw new Error("--target= was provided with an empty value");
      return isAbsolute(raw) ? raw : resolve(ROOT_DIR, raw);
    }
  }
  return join(ROOT_DIR, "mcp-data");
}

const OUTPUT_DIR = parseTargetArg(process.argv.slice(2));
const PACKAGES_OUT = join(OUTPUT_DIR, "packages");

if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
mkdirSync(PACKAGES_OUT, { recursive: true });

console.log(`Building MCP data into: ${OUTPUT_DIR}\n`);

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

interface Entry {
  name: string;
  label: "package" | "tool";
  sourceDir: string;
  description?: string;
  version?: string;
}

function discoverEntries(sourceDir: string, label: Entry["label"]): Entry[] {
  if (!existsSync(sourceDir)) return [];
  const out: Entry[] = [];
  for (const dirent of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dir = join(sourceDir, dirent.name);
    if (!existsSync(join(dir, "typedoc.json"))) continue;
    const pkgPath = join(dir, "package.json");
    let description: string | undefined;
    let version: string | undefined;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        description?: string;
        version?: string;
      };
      description = pkg.description;
      version = pkg.version;
    } catch {
      /* ignore */
    }
    out.push({ name: dirent.name, label, sourceDir: dir, description, version });
  }
  return out;
}

const entries = [
  ...discoverEntries(PACKAGES_DIR, "package"),
  ...discoverEntries(TOOLS_DIR, "tool"),
].sort((a, b) => a.name.localeCompare(b.name));

console.log(`Discovered ${entries.length} entries.\n`);

// ---------------------------------------------------------------------------
// TypeDoc reflection types (subset)
// ---------------------------------------------------------------------------

interface CommentDisplayPart {
  kind: string;
  text: string;
}

interface Comment {
  summary?: CommentDisplayPart[];
  blockTags?: { tag: string; content: CommentDisplayPart[] }[];
}

interface Source {
  fileName: string;
  line: number;
  url?: string;
}

interface Reflection {
  id: number;
  name: string;
  kind: number;
  variant?: string;
  comment?: Comment;
  signatures?: Reflection[];
  children?: Reflection[];
  sources?: Source[];
  type?: { type: string; name?: string };
  flags?: Record<string, boolean>;
}

const KIND_NAMES: Record<number, string> = {
  1: "Project",
  2: "Module",
  4: "Namespace",
  8: "Enum",
  16: "EnumMember",
  32: "Variable",
  64: "Function",
  128: "Class",
  256: "Interface",
  512: "Constructor",
  1024: "Property",
  2048: "Method",
  262144: "Accessor",
  2097152: "TypeAlias",
  4194304: "Reference",
};

function commentToText(comment?: Comment): string {
  if (!comment?.summary) return "";
  return comment.summary
    .map((part) => part.text)
    .join("")
    .trim();
}

function firstSentence(text: string): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/^(.{1,200}?)(?:[.!?](?:\s|$)|$)/);
  return (m ? m[1] : cleaned).trim();
}

function topLevelExports(root: Reflection): Reflection[] {
  // Single-entry projects expose exports directly in `children`.
  // Multi-entry projects nest a layer of Module reflections; flatten one level.
  if (!root.children) return [];
  const flat: Reflection[] = [];
  for (const child of root.children) {
    if (child.kind === 2 /* Module */ && child.children) {
      for (const grand of child.children) flat.push(grand);
    } else {
      flat.push(child);
    }
  }
  return flat;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

function packageUrl(entry: Entry): string {
  return `${DOCS_URL}/api/${entry.name}/`;
}

const KIND_TO_URL_DIR: Record<number, string> = {
  8: "enums",
  64: "functions",
  128: "classes",
  256: "interfaces",
  32: "variables",
  2097152: "types",
};

function symbolUrl(entry: Entry, refl: Reflection): string {
  const dir = KIND_TO_URL_DIR[refl.kind];
  if (!dir) return packageUrl(entry);
  return `${packageUrl(entry)}${dir}/${refl.name}.html`;
}

function sourceLink(entry: Entry, refl: Reflection): string | undefined {
  const src = refl.sources?.[0];
  if (!src) return undefined;
  if (src.url) return src.url;
  const subdir = entry.label === "package" ? "packages" : "tools";
  return `${REPO_URL}/blob/main/${subdir}/${entry.name}/${src.fileName}#L${src.line}`;
}

// ---------------------------------------------------------------------------
// Per-package extraction
// ---------------------------------------------------------------------------

interface MemberData {
  name: string;
  kind: string;
  summary: string;
}

interface SymbolData {
  name: string;
  kind: string;
  summary: string;
  comment: string;
  url: string;
  source?: string;
  members?: MemberData[];
}

interface PackageData {
  package: string;
  description: string;
  version?: string;
  url: string;
  symbols: Record<string, SymbolData>;
}

function extractMembers(refl: Reflection): MemberData[] {
  if (!refl.children) return [];
  return refl.children
    .filter((c) => !c.flags?.isPrivate)
    .map((c) => {
      const summary = firstSentence(commentToText(c.comment ?? c.signatures?.[0]?.comment));
      return {
        name: c.name,
        kind: KIND_NAMES[c.kind] ?? `Kind${c.kind}`,
        summary,
      };
    });
}

function extractSymbol(entry: Entry, refl: Reflection): SymbolData | undefined {
  const kind = KIND_NAMES[refl.kind];
  if (!kind) return undefined;
  // Skip references; they point to symbols re-exported from elsewhere.
  if (refl.kind === 4194304) return undefined;
  const comment = commentToText(refl.comment ?? refl.signatures?.[0]?.comment);
  const summary = firstSentence(comment);
  const data: SymbolData = {
    name: refl.name,
    kind,
    summary,
    comment,
    url: symbolUrl(entry, refl),
    source: sourceLink(entry, refl),
  };
  if (refl.kind === 128 || refl.kind === 256 || refl.kind === 8) {
    const members = extractMembers(refl);
    if (members.length > 0) data.members = members;
  }
  return data;
}

function loadGuide(entry: Entry): string {
  const candidates = ["README.md", "readme.md"];
  for (const f of candidates) {
    const p = join(entry.sourceDir, f);
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return "";
}

function runTypedocJson(entry: Entry): Reflection | undefined {
  const tmp = mkdtempSync(join(tmpdir(), `bcts-mcp-${entry.name}-`));
  const out = join(tmp, "docs.json");
  try {
    execSync(`bunx typedoc --json ${JSON.stringify(out)} --excludeReferences false`, {
      cwd: entry.sourceDir,
      stdio: "pipe",
    });
    if (!existsSync(out)) return undefined;
    return JSON.parse(readFileSync(out, "utf8")) as Reflection;
  } catch (err) {
    console.warn(`  ! ${entry.name} typedoc --json failed:`, (err as Error).message);
    return undefined;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

interface PackageIndex {
  name: string;
  label: "package" | "tool";
  description: string;
  version?: string;
  url: string;
  symbolCount: number;
}

interface SearchEntry {
  package: string;
  name: string;
  kind: string;
  summary: string;
  url: string;
}

const packageIndex: PackageIndex[] = [];
const searchIndex: SearchEntry[] = [];

for (const entry of entries) {
  process.stdout.write(`  · ${entry.name} … `);
  const reflection = runTypedocJson(entry);
  if (!reflection) {
    console.log("skipped (no typedoc output)");
    continue;
  }
  const exports = topLevelExports(reflection);
  const symbols: Record<string, SymbolData> = {};
  for (const refl of exports) {
    const sym = extractSymbol(entry, refl);
    if (!sym) continue;
    symbols[sym.name] = sym;
    searchIndex.push({
      package: entry.name,
      name: sym.name,
      kind: sym.kind,
      summary: sym.summary,
      url: sym.url,
    });
  }
  const data: PackageData = {
    package: entry.name,
    description: entry.description ?? "",
    version: entry.version,
    url: packageUrl(entry),
    symbols,
  };
  writeFileSync(join(PACKAGES_OUT, `${entry.name}.json`), JSON.stringify(data));
  const guide = loadGuide(entry);
  if (guide) {
    const guideDir = join(PACKAGES_OUT, entry.name);
    mkdirSync(guideDir, { recursive: true });
    writeFileSync(join(guideDir, "guide.md"), guide);
  }
  packageIndex.push({
    name: entry.name,
    label: entry.label,
    description: entry.description ?? "",
    version: entry.version,
    url: packageUrl(entry),
    symbolCount: Object.keys(symbols).length,
  });
  console.log(`${Object.keys(symbols).length} symbols`);
}

writeFileSync(
  join(OUTPUT_DIR, "index.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    packages: packageIndex,
  }),
);
writeFileSync(join(OUTPUT_DIR, "search.json"), JSON.stringify(searchIndex));

console.log(
  `\nMCP data built: ${packageIndex.length} packages, ${searchIndex.length} symbols → ${OUTPUT_DIR}`,
);
