import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "BCShamir",
  outputOptions: {
    globals: {
      "@bcts/crypto": "BCCrypto",
      "@bcts/rand": "BCRand",
    },
  },
});
