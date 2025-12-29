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
  noExternal: ["byte-data", "collections/sorted-map"],
  outputOptions: {
    globals: {
      "byte-data": "byteData",
      "collections/sorted-map": "sortedMap",
    },
  },
});
