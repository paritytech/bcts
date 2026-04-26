/**
 * Build and organize documentation for all packages and tools.
 *
 * 1. Runs typedoc for all packages and tools (via turbo) → HTML.
 * 2. Copies all generated docs into the target directory.
 * 3. Runs typedoc again per package with `typedoc-plugin-markdown` → Markdown.
 * 4. Concatenates the Markdown into per-package `llms-full.txt` and emits a
 *    short `llms.txt` index next to it.
 * 5. Emits a top-level `index.html` (landing page) and `llms.txt` listing every
 *    aggregated package, following the https://llmstxt.org convention.
 *
 * Output structure:
 *   <target>/
 *     index.html                         landing page (HTML)
 *     llms.txt                           top-level llms.txt index
 *     api/
 *       dcbor/                           per-package typedoc HTML
 *         index.html
 *         llms.txt                       per-package llms.txt index
 *         llms-full.txt                  full Markdown API for ingestion
 *         ...
 *       envelope-cli/
 *       ...
 *
 * Usage:
 *   bun run scripts/build-docs.ts                           # → docs-site/
 *   bun run scripts/build-docs.ts --target=path/to/dir      # → path/to/dir/
 */

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const ROOT_DIR = join(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT_DIR, "packages");
const TOOLS_DIR = join(ROOT_DIR, "tools");

const SITE_URL = "https://bcts.dev";
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
  return join(ROOT_DIR, "docs-site");
}

const OUTPUT_DIR = parseTargetArg(process.argv.slice(2));
const API_DIR = join(OUTPUT_DIR, "api");

if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true });
}
mkdirSync(API_DIR, { recursive: true });

console.log(`Building documentation into: ${OUTPUT_DIR}\n`);
console.log("Generating HTML documentation for all packages and tools...\n");
execSync(`bunx turbo run docs`, { cwd: ROOT_DIR, stdio: "inherit" });

interface DocEntry {
  name: string;
  label: "package" | "tool";
  sourceDir: string;
  description?: string;
}

function readPackageDescription(sourceDir: string, name: string): string | undefined {
  const pkgPath = join(sourceDir, name, "package.json");
  if (!existsSync(pkgPath)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { description?: string };
    return pkg.description;
  } catch {
    return undefined;
  }
}

function copyDocsFrom(sourceDir: string, label: DocEntry["label"]): DocEntry[] {
  const found: DocEntry[] = [];
  const items = readdirSync(sourceDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const item of items) {
    const docsDir = join(sourceDir, item, "docs");
    if (existsSync(docsDir)) {
      const destDir = join(API_DIR, item);
      cpSync(docsDir, destDir, { recursive: true });
      console.log(`  ✓ ${item} (${label})`);
      found.push({
        name: item,
        label,
        sourceDir: join(sourceDir, item),
        description: readPackageDescription(sourceDir, item),
      });
    }
  }
  return found;
}

console.log("\nOrganizing HTML documentation...");
const packageEntries = copyDocsFrom(PACKAGES_DIR, "package");
const toolEntries = copyDocsFrom(TOOLS_DIR, "tool");
const allEntries = [...packageEntries, ...toolEntries].sort((a, b) => a.name.localeCompare(b.name));

console.log("\nGenerating Markdown variants for llms.txt / llms-full.txt...");
for (const entry of allEntries) {
  buildLlmsForPackage(entry);
}

writeFileSync(join(OUTPUT_DIR, "index.html"), renderLandingPage(allEntries));
console.log(`  ✓ index.html (landing page, ${allEntries.length} entries)`);

writeFileSync(join(OUTPUT_DIR, "llms.txt"), renderRootLlms(allEntries));
console.log(`  ✓ llms.txt (top-level index, ${allEntries.length} entries)`);

console.log(`\nDocumentation built to: ${OUTPUT_DIR}`);
console.log(
  `Total: ${allEntries.length} (${packageEntries.length} packages, ${toolEntries.length} tools)`,
);

// ---------------------------------------------------------------------------
// llms.txt generation
// ---------------------------------------------------------------------------

function buildLlmsForPackage(entry: DocEntry): void {
  const mdDir = join(entry.sourceDir, "docs-md");
  if (existsSync(mdDir)) rmSync(mdDir, { recursive: true });

  // Run typedoc with the markdown plugin against the package's existing
  // typedoc.json. `--out` and `--readme` overrides keep the HTML build's
  // output untouched and produce a fresh tree under docs-md/.
  execSync(
    `bunx typedoc --plugin typedoc-plugin-markdown --out ${JSON.stringify(mdDir)} --hideBreadcrumbs --hidePageHeader`,
    { cwd: entry.sourceDir, stdio: "pipe" },
  );

  const mdFiles = collectMarkdownFiles(mdDir);
  const concatenated = concatenateMarkdown(entry, mdDir, mdFiles);

  const apiDest = join(API_DIR, entry.name);
  writeFileSync(join(apiDest, "llms-full.txt"), concatenated);
  writeFileSync(join(apiDest, "llms.txt"), renderPackageLlms(entry));

  // Clean up the temporary docs-md tree so the source tree stays clean.
  rmSync(mdDir, { recursive: true });
  console.log(`  ✓ ${entry.name} (llms.txt + llms-full.txt, ${mdFiles.length} sections)`);
}

function collectMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  const ordered: { dir: string; rank: number }[] = [
    { dir, rank: 0 }, // README.md / globals.md at the top
    { dir: join(dir, "enumerations"), rank: 1 },
    { dir: join(dir, "classes"), rank: 2 },
    { dir: join(dir, "interfaces"), rank: 3 },
    { dir: join(dir, "type-aliases"), rank: 4 },
    { dir: join(dir, "functions"), rank: 5 },
    { dir: join(dir, "variables"), rank: 6 },
  ];

  for (const { dir: groupDir } of ordered) {
    if (!existsSync(groupDir)) continue;
    const files = readdirSync(groupDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".md"))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
    for (const f of files) out.push(join(groupDir, f));
  }

  // Catch any extra subdirectories typedoc-plugin-markdown might emit that
  // we did not enumerate above (e.g. `modules/`, `namespaces/`).
  const known = new Set(ordered.map((o) => o.dir));
  for (const child of readdirSync(dir, { withFileTypes: true })) {
    if (!child.isDirectory()) continue;
    const childPath = join(dir, child.name);
    if (known.has(childPath)) continue;
    walkMarkdown(childPath, out);
  }

  return out;
}

function walkMarkdown(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, acc);
    else if (entry.isFile() && entry.name.endsWith(".md")) acc.push(full);
  }
}

function concatenateMarkdown(entry: DocEntry, mdRoot: string, files: string[]): string {
  const header = [
    `# ${displayName(entry)}`,
    "",
    entry.description ?? "",
    "",
    `> Auto-generated full Markdown API reference for ${displayName(entry)}.`,
    `> Source repository: ${REPO_URL}`,
    `> HTML reference: ${DOCS_URL}/api/${entry.name}/`,
    "",
    "---",
    "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  const sections = files.map((path) => {
    const rel = relative(mdRoot, path).replace(/\\/g, "/");
    const body = readFileSync(path, "utf8").trim();
    return `<!-- file: ${rel} -->\n\n${body}\n`;
  });

  return `${header}\n${sections.join("\n---\n\n")}\n`;
}

function displayName(entry: DocEntry): string {
  return `@bcts/${entry.name}`;
}

function renderPackageLlms(entry: DocEntry): string {
  const lines: string[] = [];
  lines.push(`# ${displayName(entry)}`);
  lines.push("");
  if (entry.description) {
    lines.push(`> ${entry.description}`);
    lines.push("");
  }
  lines.push("## Documentation");
  lines.push("");
  lines.push(
    `- [Full API reference (Markdown)](llms-full.txt): concatenated Markdown of every export, suitable for LLM ingestion.`,
  );
  lines.push(`- [HTML reference](index.html): browsable typedoc output for humans.`);
  lines.push("");
  lines.push("## Source");
  lines.push("");
  const subdir = entry.label === "package" ? "packages" : "tools";
  lines.push(`- [Repository](${REPO_URL}/tree/main/${subdir}/${entry.name})`);
  lines.push(`- [Package on npm](https://www.npmjs.com/package/${displayName(entry)})`);
  lines.push("");
  return lines.join("\n");
}

function renderRootLlms(entries: DocEntry[]): string {
  const packages = entries.filter((e) => e.label === "package");
  const tools = entries.filter((e) => e.label === "tool");
  const link = (e: DocEntry): string => {
    const summary = e.description ? `: ${e.description}` : "";
    return `- [${displayName(e)}](${DOCS_URL}/api/${e.name}/llms-full.txt)${summary}`;
  };

  return [
    "# BCTS — Blockchain Commons TypeScript",
    "",
    "> TypeScript implementations of Blockchain Commons specifications including dCBOR, Gordian Envelopes, Uniform Resources, SSKR, and other cryptographic standards.",
    "",
    "This file follows the [llms.txt](https://llmstxt.org) convention. Each link below points at a per-package `llms-full.txt`: a concatenated Markdown reference for that package's full TypeScript API, suitable for direct ingestion by Claude, Cursor, ChatGPT, Windsurf, and similar tools.",
    "",
    "## Packages",
    "",
    ...(packages.length ? packages.map(link) : ["- *(none)*"]),
    "",
    "## CLI tools",
    "",
    ...(tools.length ? tools.map(link) : ["- *(none)*"]),
    "",
    "## Browse",
    "",
    `- [HTML reference](${DOCS_URL}/): full typedoc HTML site, cross-linked.`,
    `- [Playground](${SITE_URL}/): interactive exploration of dCBOR, Gordian Envelopes, and more.`,
    `- [Repository](${REPO_URL}): source code and issue tracker.`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Landing page (HTML)
// ---------------------------------------------------------------------------

function renderLandingPage(entries: DocEntry[]): string {
  const packages = entries.filter((e) => e.label === "package");
  const tools = entries.filter((e) => e.label === "tool");
  const list = (xs: DocEntry[]): string =>
    xs.length === 0
      ? "<li><em>none</em></li>"
      : xs.map((x) => `<li><a href="api/${x.name}/">${x.name}</a></li>`).join("\n      ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BCTS API Reference</title>
  <meta name="description" content="API reference documentation for the Blockchain Commons TypeScript packages and CLI tools." />
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      max-width: 60rem;
      margin: 0 auto;
      padding: 2.5rem 1.25rem 4rem;
      line-height: 1.55;
    }
    h1 { margin-top: 0; }
    h2 { margin-top: 2rem; }
    ul { padding-left: 1.25rem; }
    li { margin: 0.15rem 0; }
    a { text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
    @media (max-width: 40rem) { .columns { grid-template-columns: 1fr; } }
    footer { margin-top: 3rem; font-size: 0.9rem; opacity: 0.7; }
  </style>
</head>
<body>
  <h1>BCTS API Reference</h1>
  <p>
    API reference for the
    <a href="${SITE_URL}">Blockchain Commons TypeScript</a>
    packages and CLI tools, generated by <code>typedoc</code>.
  </p>
  <p>
    Looking for an LLM-friendly index?
    See <a href="llms.txt"><code>llms.txt</code></a>
    (per-package <code>llms-full.txt</code> files are linked from each package).
  </p>
  <div class="columns">
    <section>
      <h2>Packages</h2>
      <ul>
      ${list(packages)}
      </ul>
    </section>
    <section>
      <h2>CLI tools</h2>
      <ul>
      ${list(tools)}
      </ul>
    </section>
  </div>
  <footer>
    <p>
      <a href="${SITE_URL}">← back to playground</a>
    </p>
  </footer>
</body>
</html>
`;
}
