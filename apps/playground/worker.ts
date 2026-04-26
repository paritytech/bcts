import nitroApp from "./.output/server/index.mjs";
import { handleMcpRequest } from "./mcp.js";

interface KVNamespace {
  // Bindings we don't call from the wrapper itself; declared so Env stays accurate.
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  CACHE: KVNamespace;
}

const DOCS_HOSTNAME = "docs.bcts.dev";
const DOCS_PREFIX = "/__docs__";
const MCP_HOSTNAME = "mcp.bcts.dev";
const MCP_PREFIX = "/__mcp__";
const MCP_ENDPOINT = "/mcp";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === MCP_HOSTNAME) {
      if (url.pathname === MCP_ENDPOINT || url.pathname === `${MCP_ENDPOINT}/`) {
        return handleMcpRequest(request, env.ASSETS);
      }
      if (url.pathname === "/" || url.pathname === "") {
        return new Response(
          JSON.stringify({
            name: "bcts-docs",
            endpoint: `https://${MCP_HOSTNAME}${MCP_ENDPOINT}`,
            transport: "Streamable HTTP (JSON-RPC 2.0)",
            docs: "https://docs.bcts.dev",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not Found", { status: 404 });
    }

    if (url.hostname === DOCS_HOSTNAME) {
      const target = new URL(request.url);
      const incoming = url.pathname === "/" ? "/index.html" : url.pathname;
      target.pathname = DOCS_PREFIX + incoming;
      return env.ASSETS.fetch(new Request(target.toString(), request));
    }

    if (
      url.pathname === DOCS_PREFIX ||
      url.pathname.startsWith(DOCS_PREFIX + "/") ||
      url.pathname === MCP_PREFIX ||
      url.pathname.startsWith(MCP_PREFIX + "/")
    ) {
      return new Response("Not Found", { status: 404 });
    }

    return (
      nitroApp as { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }
    ).fetch(request, env, ctx);
  },
};
