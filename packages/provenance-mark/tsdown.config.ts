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
  globalName: "bctsProvenanceMark",
  deps: {
    neverBundle: [/@noble\/.*/],
  },
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/envelope": "bctsEnvelope",
      "@bcts/rand": "bctsRand",
      "@bcts/tags": "bctsTags",
      "@bcts/uniform-resources": "bctsUniformResources",
      "@noble/hashes/sha2.js": "nobleHashesSha2",
      "@noble/hashes/hkdf.js": "nobleHashesHkdf",
      "@noble/ciphers/chacha.js": "nobleCiphersChacha",
    },
  },
});
