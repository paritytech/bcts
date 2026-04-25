import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["iife", "cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    globalName: "bctsMultipartUr",
    outputOptions: {
      globals: {
        "@bcts/uniform-resources": "bctsUniformResources",
      },
    },
  },
  {
    entry: ["src/bin/mur.ts"],
    outDir: "dist/bin",
    format: ["cjs"],
    target: "node18",
    platform: "node",
    sourcemap: true,
    clean: false,
    shims: true,
  },
]);
