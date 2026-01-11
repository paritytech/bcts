import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/ipfs/index.ts",
    "src/mainline/index.ts",
    "src/server/index.ts",
    "src/hybrid/index.ts",
    "src/bin/hubert.ts",
  ],
  outDir: "dist",
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: [
    "@bcts/components",
    "@bcts/envelope",
    "better-sqlite3",
    "bittorrent-dht",
    "commander",
    "fastify",
    "kubo-rpc-client",
  ],
});
