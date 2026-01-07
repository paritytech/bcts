import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsComponents",
  // Keep @noble/* and @scure/* as external - don't bundle them
  external: [/@noble\/.*/, /@scure\/.*/],
  outputOptions: {
    globals: {
      "@bcts/crypto": "bctsCrypto",
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/rand": "bctsRand",
      "@bcts/sskr": "bctsSskr",
      "@bcts/tags": "bctsTags",
      "@bcts/uniform-resources": "bctsUniformResources",
      "@noble/hashes/blake2.js": "nobleHashesBlake2",
      "@noble/post-quantum/ml-dsa.js": "noblePostQuantumMldsa",
      "@noble/post-quantum/ml-kem.js": "noblePostQuantumMlkem",
      "@scure/sr25519": "scureSr25519",
      pako: "pako",
    },
  },
});
