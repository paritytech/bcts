import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
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
  globalName: "bctsEnvelopePattern",
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/dcbor-parse": "bctsDcborParse",
      "@bcts/dcbor-pattern": "bctsDcborPattern",
      "@bcts/envelope": "bctsEnvelope",
      "@bcts/components": "bctsComponents",
      "@bcts/tags": "bctsTags",
      "@bcts/known-values": "bctsKnownValues",
    },
  },
});
