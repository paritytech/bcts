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
  globalName: "bctsCrypto",
  outputOptions: {
    globals: {
      "@bcts/rand": "bctsRand",
      "@noble/hashes/sha2.js": "nobleHashesSha2",
      "@noble/hashes/hmac.js": "nobleHashesHmac",
      "@noble/hashes/pbkdf2.js": "nobleHashesPbkdf2",
      "@noble/hashes/hkdf.js": "nobleHashesHkdf",
      "@noble/hashes/scrypt.js": "nobleHashesScrypt",
      "@noble/hashes/argon2.js": "nobleHashesArgon2",
      "@noble/ciphers/chacha.js": "nobleCiphersChacha",
      "@noble/curves/secp256k1.js": "nobleCurvesSecp256k1",
      "@noble/curves/ed25519.js": "nobleCurvesEd25519",
    },
  },
});
