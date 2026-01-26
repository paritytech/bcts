import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/dkg/index.ts",
    "src/registry/index.ts",
    "src/cmd/index.ts",
    "src/frost/index.ts",
    "src/bin/frost.ts",
  ],
  outDir: "dist",
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: [
    "@bcts/components",
    "@bcts/dcbor",
    "@bcts/envelope",
    "@bcts/gstp",
    "@bcts/hubert",
    "@bcts/provenance-mark",
    "@bcts/uniform-resources",
    "@bcts/xid",
    "@frosts/core",
    "@frosts/ed25519",
    "commander",
  ],
});
