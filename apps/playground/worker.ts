import nitroApp from "./.output/server/index.mjs";

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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === DOCS_HOSTNAME) {
      const target = new URL(request.url);
      const incoming = url.pathname === "/" ? "/index.html" : url.pathname;
      target.pathname = DOCS_PREFIX + incoming;
      return env.ASSETS.fetch(new Request(target.toString(), request));
    }

    if (url.pathname === DOCS_PREFIX || url.pathname.startsWith(DOCS_PREFIX + "/")) {
      return new Response("Not Found", { status: 404 });
    }

    return (
      nitroApp as { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }
    ).fetch(request, env, ctx);
  },
};
