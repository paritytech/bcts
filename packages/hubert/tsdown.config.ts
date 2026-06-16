import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/server/index.ts",
    "src/ipfs/index.ts",
    "src/mainline/index.ts",
    "src/hybrid/index.ts",
    "src/bin/hubert.ts",
  ],
  outDir: "dist",
  format: ["cjs", "esm"],
  dts: true,
  inputOptions: {
    // The rolldown-plugin-dts "fake-js" pass transforms .d.ts content without
    // emitting a sourcemap, producing a spurious SOURCEMAP_BROKEN warning even
    // though the real JS sourcemaps are correct. Filter only that case.
    onwarn(warning, defaultHandler) {
      if (warning.code === "SOURCEMAP_BROKEN") return;
      defaultHandler(warning);
    },
  },
  sourcemap: true,
  clean: true,
  target: "es2022",
  deps: {
    neverBundle: [
      "@bcts/components",
      "@bcts/crypto",
      "@bcts/envelope",
      "@noble/ciphers",
      "@noble/curves",
      "better-sqlite3",
      "bittorrent-dht",
      "commander",
      "fastify",
      "kubo-rpc-client",
    ],
  },
});
