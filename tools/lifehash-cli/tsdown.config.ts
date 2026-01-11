import { defineConfig } from "tsdown";

export default defineConfig([
  // Library build
  {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    outputOptions: {
      globals: {
        "@bcts/lifehash": "bctsLifehash",
        commander: "commander",
        pngjs: "pngjs",
      },
    },
  },
  // CLI build
  {
    entry: ["src/main.ts"],
    outDir: "dist",
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: false,
    target: "es2022",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
