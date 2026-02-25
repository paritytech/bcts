import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  minify: false,
  target: "es2022",
  outDir: "dist",
  external: [/@noble\/.*/, /@bcts\/.*/],
  globalName: "bctsRatchet",
  outputOptions: {
    globals: {
      "@bcts/crypto": "bctsCrypto",
      "@bcts/rand": "bctsRand",
      "@noble/hashes/sha2.js": "nobleHashesSha2",
      "@noble/hashes/hmac.js": "nobleHashesHmac",
      "@noble/hashes/hkdf.js": "nobleHashesHkdf",
      "@noble/ciphers/aes.js": "nobleCiphersAes",
      "@noble/curves/ed25519.js": "nobleCurvesEd25519",
      "@noble/post-quantum/ml-kem.js": "noblePostQuantumMlKem",
    },
  },
});
