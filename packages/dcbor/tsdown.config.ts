import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsDcbor",
  deps: {
    // Intentionally bundling these dependencies for browser/IIFE builds
    alwaysBundle: ["byte-data", "collections/sorted-map"],
    onlyBundle: false,
  },
  outputOptions: {
    globals: {
      "byte-data": "byteData",
      "collections/sorted-map": "sortedMap",
    },
  },
});
