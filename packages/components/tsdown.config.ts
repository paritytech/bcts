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
  globalName: "bctsComponents",
  // Keep @noble/* and @scure/* as external - don't bundle them
  deps: {
    neverBundle: [/@noble\/.*/, /@scure\/.*/],
  },
  outputOptions: {
    globals: {
      "@bcts/crypto": "bctsCrypto",
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/rand": "bctsRand",
      "@bcts/sskr": "bctsSskr",
      "@bcts/tags": "bctsTags",
      "@bcts/uniform-resources": "bctsUniformResources",
      "@noble/curves/ed25519.js": "nobleCurvesEd25519",
      "@noble/curves/nist.js": "nobleCurvesNist",
      "@noble/hashes/blake2.js": "nobleHashesBlake2",
      "@noble/hashes/hmac.js": "nobleHashesHmac",
      "@noble/hashes/legacy.js": "nobleHashesLegacy",
      "@noble/hashes/sha2.js": "nobleHashesSha2",
      "@noble/post-quantum/ml-dsa.js": "noblePostQuantumMldsa",
      "@noble/post-quantum/ml-kem.js": "noblePostQuantumMlkem",
      "@scure/base": "scureBase",
      "@scure/sr25519": "scureSr25519",
      pako: "pako",
    },
  },
});
