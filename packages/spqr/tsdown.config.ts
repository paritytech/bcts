import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsSpqr",
  outputOptions: {
    globals: {
      "@bcts/rand": "bctsRand",
      "@bcts/crypto": "bctsCrypto",
      "@noble/hashes/hkdf.js": "nobleHashesHkdf",
      "@noble/hashes/sha2.js": "nobleHashesSha2",
      "@noble/hashes/hmac.js": "nobleHashesHmac",
      "@noble/hashes/sha3.js": "nobleHashesSha3",
      "@noble/hashes/utils.js": "nobleHashesUtils",
      "@noble/post-quantum/_crystals.js": "noblePostQuantumCrystals",
      "@noble/post-quantum/ml-kem.js": "noblePostQuantumMlKem",
    },
  },
});
