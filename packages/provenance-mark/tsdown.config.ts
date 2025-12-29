import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsProvenanceMark",
  external: [/@noble\/.*/],
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/rand": "bctsRand",
      "@bcts/tags": "bctsTags",
      "@bcts/uniform-resources": "bctsUniformResources",
      "@noble/hashes/sha2.js": "nobleHashesSha2",
      "@noble/hashes/hkdf.js": "nobleHashesHkdf",
      "@noble/ciphers/chacha.js": "nobleCiphersChacha",
    },
  },
});
