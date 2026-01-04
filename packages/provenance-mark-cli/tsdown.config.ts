import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  outDir: "dist",
  external: [
    "@bcts/components",
    "@bcts/dcbor",
    "@bcts/envelope",
    "@bcts/known-values",
    "@bcts/provenance-mark",
    "@bcts/uniform-resources",
    "commander",
  ],
});
