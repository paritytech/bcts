/**
 * MCP server for BCTS docs over Streamable HTTP.
 *
 * Stateless JSON-RPC 2.0 — every POST is independent. We don't open SSE
 * streams or track sessions because all five tools are fast lookups.
 *
 * Data is read from the static-asset prefix `/__mcp__/...` written by
 * `scripts/build-mcp.ts`.
 */

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

const MCP_PREFIX = "/__mcp__";
const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "bcts-docs", version: "1.0.0" };

const TOOLS = [
  {
    name: "list_packages",
    description: "List all BCTS TypeScript packages with descriptions and symbol counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_symbols",
    description: "Search for exported symbols (functions, classes, types) across BCTS packages.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to match against symbol names." },
        package: {
          type: "string",
          description: "Optional package name to scope the search (e.g. 'envelope').",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_symbol",
    description:
      "Get full details (kind, doc comment, source link, members) for a specific symbol.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name (e.g. 'envelope')." },
        name: { type: "string", description: "Exported symbol name." },
      },
      required: ["package", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_guide",
    description: "Get the README / hand-written guide for a package.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: "string" },
      },
      required: ["package"],
      additionalProperties: false,
    },
  },
  {
    name: "find_examples",
    description:
      "Find code examples whose summary or doc comment matches a query, across BCTS packages.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

interface PackageIndexEntry {
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

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

async function readAsset(assets: Fetcher, baseUrl: string, path: string): Promise<Response> {
  const target = new URL(baseUrl);
  target.pathname = `${MCP_PREFIX}${path}`;
  return assets.fetch(new Request(target.toString()));
}

async function readJson<T>(assets: Fetcher, baseUrl: string, path: string): Promise<T | undefined> {
  const res = await readAsset(assets, baseUrl, path);
  if (!res.ok) return undefined;
  return (await res.json()) as T;
}

async function readText(
  assets: Fetcher,
  baseUrl: string,
  path: string,
): Promise<string | undefined> {
  const res = await readAsset(assets, baseUrl, path);
  if (!res.ok) return undefined;
  return await res.text();
}

interface ToolContext {
  assets: Fetcher;
  baseUrl: string;
}

async function listPackages(ctx: ToolContext): Promise<string> {
  const data = await readJson<{ packages: PackageIndexEntry[] }>(
    ctx.assets,
    ctx.baseUrl,
    "/index.json",
  );
  if (!data) return "MCP index not found.";
  const lines = data.packages.map(
    (p) =>
      `- **${p.label === "tool" ? p.name : `@bcts/${p.name}`}** (${p.symbolCount} symbols) — ${p.description || "no description"}\n  ${p.url}`,
  );
  return `# BCTS packages (${data.packages.length})\n\n${lines.join("\n")}`;
}

async function searchSymbols(ctx: ToolContext, query: string, pkg?: string): Promise<string> {
  const data = await readJson<SearchEntry[]>(ctx.assets, ctx.baseUrl, "/search.json");
  if (!data) return "MCP search index not found.";
  const q = query.toLowerCase();
  const matches = data.filter((s) => {
    if (pkg && s.package !== pkg) return false;
    return s.name.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q);
  });
  if (matches.length === 0) {
    return `No symbols matched "${query}"${pkg ? ` in @bcts/${pkg}` : ""}.`;
  }
  const limited = matches.slice(0, 100);
  const lines = limited.map(
    (m) =>
      `- \`${m.kind} ${m.name}\` — @bcts/${m.package}\n  ${m.summary || "(no summary)"}\n  ${m.url}`,
  );
  const suffix =
    matches.length > limited.length
      ? `\n\n_${matches.length - limited.length} more results truncated._`
      : "";
  return `# ${matches.length} match${matches.length === 1 ? "" : "es"} for "${query}"${pkg ? ` in @bcts/${pkg}` : ""}\n\n${lines.join("\n")}${suffix}`;
}

async function getSymbol(ctx: ToolContext, pkg: string, name: string): Promise<string> {
  const data = await readJson<PackageData>(ctx.assets, ctx.baseUrl, `/packages/${pkg}.json`);
  if (!data) return `Package not found: ${pkg}`;
  const sym = data.symbols[name];
  if (!sym) return `Symbol \`${name}\` not found in @bcts/${pkg}.`;
  const out: string[] = [];
  out.push(`# ${sym.kind} \`${sym.name}\` — @bcts/${pkg}`);
  out.push("");
  if (sym.summary) {
    out.push(`> ${sym.summary}`);
    out.push("");
  }
  if (sym.comment && sym.comment !== sym.summary) {
    out.push(sym.comment);
    out.push("");
  }
  if (sym.members && sym.members.length > 0) {
    out.push("## Members");
    out.push("");
    for (const m of sym.members) {
      out.push(`- \`${m.kind} ${m.name}\`${m.summary ? ` — ${m.summary}` : ""}`);
    }
    out.push("");
  }
  out.push(`HTML: ${sym.url}`);
  if (sym.source) out.push(`Source: ${sym.source}`);
  return out.join("\n");
}

async function getGuide(ctx: ToolContext, pkg: string): Promise<string> {
  const md = await readText(ctx.assets, ctx.baseUrl, `/packages/${pkg}/guide.md`);
  if (!md) return `No guide available for @bcts/${pkg}.`;
  return md;
}

async function findExamples(ctx: ToolContext, query: string): Promise<string> {
  const search = await readJson<SearchEntry[]>(ctx.assets, ctx.baseUrl, "/search.json");
  if (!search) return "MCP search index not found.";
  const q = query.toLowerCase();
  const candidates = search.filter(
    (s) => s.summary.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  );
  if (candidates.length === 0) {
    return `No examples found for "${query}".`;
  }
  // Group by package; load each package's full data to scan comments for code blocks.
  const byPkg = new Map<string, SearchEntry[]>();
  for (const c of candidates) {
    const list = byPkg.get(c.package) ?? [];
    list.push(c);
    byPkg.set(c.package, list);
  }
  const sections: string[] = [];
  let total = 0;
  for (const [pkg, syms] of byPkg) {
    if (total >= 20) break;
    const data = await readJson<PackageData>(ctx.assets, ctx.baseUrl, `/packages/${pkg}.json`);
    if (!data) continue;
    for (const s of syms) {
      if (total >= 20) break;
      const full = data.symbols[s.name];
      if (!full?.comment) continue;
      const blocks = extractCodeBlocks(full.comment);
      const matchingBlocks = blocks.filter((b) => b.toLowerCase().includes(q));
      if (matchingBlocks.length === 0 && !full.comment.toLowerCase().includes(q)) continue;
      const block = matchingBlocks[0] ?? blocks[0];
      sections.push(
        `## @bcts/${pkg} · \`${full.kind} ${full.name}\`\n\n${block ? "```ts\n" + block + "\n```" : full.summary}\n\n${full.url}`,
      );
      total++;
    }
  }
  if (sections.length === 0) {
    return `No examples found for "${query}".`;
  }
  return `# Examples matching "${query}"\n\n${sections.join("\n\n")}`;
}

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:ts|typescript|js|javascript)?\s*\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// JSON-RPC dispatch
// ---------------------------------------------------------------------------

interface RpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcSuccess {
  jsonrpc: "2.0";
  id: number | string | null;
  result: unknown;
}

interface RpcError {
  jsonrpc: "2.0";
  id: number | string | null;
  error: { code: number; message: string; data?: unknown };
}

type RpcResponse = RpcSuccess | RpcError;

function rpcError(id: RpcRequest["id"], code: number, message: string): RpcError {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function callTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  let text: string;
  try {
    switch (name) {
      case "list_packages":
        text = await listPackages(ctx);
        break;
      case "search_symbols":
        text = await searchSymbols(
          ctx,
          String(args.query ?? ""),
          typeof args.package === "string" ? args.package : undefined,
        );
        break;
      case "get_symbol":
        text = await getSymbol(ctx, String(args.package ?? ""), String(args.name ?? ""));
        break;
      case "get_guide":
        text = await getGuide(ctx, String(args.package ?? ""));
        break;
      case "find_examples":
        text = await findExamples(ctx, String(args.query ?? ""));
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Tool error: ${(err as Error).message}` }],
      isError: true,
    };
  }
  return { content: [{ type: "text", text }] };
}

async function dispatch(req: RpcRequest, ctx: ToolContext): Promise<RpcResponse | undefined> {
  // Notifications: no `id` → no response.
  const isNotification = req.id === undefined;
  const id = req.id ?? null;

  if (req.method === "initialize") {
    if (isNotification) return undefined;
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
        instructions:
          "BCTS docs MCP. Use `list_packages` first, then `search_symbols`, `get_symbol`, `get_guide`, or `find_examples`.",
      },
    };
  }
  if (req.method === "notifications/initialized" || req.method === "initialized") {
    return undefined;
  }
  if (req.method === "tools/list") {
    if (isNotification) return undefined;
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (req.method === "tools/call") {
    if (isNotification) return undefined;
    const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    if (!params.name) return rpcError(id, -32602, "Missing tool name");
    const result = await callTool(ctx, params.name, params.arguments ?? {});
    return { jsonrpc: "2.0", id, result };
  }
  if (req.method === "ping") {
    if (isNotification) return undefined;
    return { jsonrpc: "2.0", id, result: {} };
  }
  if (isNotification) return undefined;
  return rpcError(id, -32601, `Method not found: ${req.method}`);
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export async function handleMcpRequest(request: Request, assets: Fetcher): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocolVersion: PROTOCOL_VERSION,
        endpoint: "POST JSON-RPC 2.0 messages to this URL.",
        tools: TOOLS.map((t) => t.name),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const ctx: ToolContext = { assets, baseUrl: new URL(request.url).origin };

  // Batched requests
  if (Array.isArray(body)) {
    const responses: RpcResponse[] = [];
    for (const req of body) {
      const r = await dispatch(req as RpcRequest, ctx);
      if (r) responses.push(r);
    }
    if (responses.length === 0) {
      return new Response(null, { status: 202, headers: corsHeaders });
    }
    return new Response(JSON.stringify(responses), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const response = await dispatch(body as RpcRequest, ctx);
  if (!response) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
