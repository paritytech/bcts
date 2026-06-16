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
  },
});
