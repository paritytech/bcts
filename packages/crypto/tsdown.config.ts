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
  // Keep @noble/* as external - don't bundle them
  // This allows the consuming app (playground) to use proper browser resolution
  external: [/@noble\/.*/],
  globalName: "BCCrypto",
  outputOptions: {
    globals: {
      "@bcts/rand": "BCRand",
      "@noble/hashes/sha2": "nobleHashesSha2",
      "@noble/hashes/hmac": "nobleHashesHmac",
      "@noble/hashes/pbkdf2": "nobleHashesPbkdf2",
      "@noble/hashes/hkdf": "nobleHashesHkdf",
      "@noble/hashes/scrypt": "nobleHashesScrypt",
      "@noble/hashes/argon2": "nobleHashesArgon2",
      "@noble/ciphers/chacha": "nobleCiphersChacha",
      "@noble/curves/secp256k1": "nobleCurvesSecp256k1",
      "@noble/curves/ed25519": "nobleCurvesEd25519",
    },
  },
});
