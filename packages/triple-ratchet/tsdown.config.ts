import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsTripleRatchet",
  outputOptions: {
    globals: {
      "@bcts/rand": "bctsRand",
      "@bcts/crypto": "bctsCrypto",
      "@bcts/double-ratchet": "bctsDoubleRatchet",
      "@bcts/spqr": "bctsSpqr",
      "@noble/hashes/hkdf.js": "nobleHashesHkdf",
      "@noble/hashes/sha2.js": "nobleHashesSha2",
      "@noble/hashes/hmac.js": "nobleHashesHmac",
      "@noble/hashes/utils.js": "nobleHashesUtils",
    },
  },
});
