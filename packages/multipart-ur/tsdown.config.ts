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
    inputOptions: {
      // Node-only `import.meta.url` in svg.ts:loadWasmFromNode is gated by
      // an `isNode` runtime check, so the empty-object replacement in IIFE
      // is harmless dead code.
      onwarn(warning, defaultHandler) {
        if (warning.code === "EMPTY_IMPORT_META") return;
        defaultHandler(warning);
      },
    },
    outputOptions: {
      globals: {
        "@bcts/uniform-resources": "bctsUniformResources",
        "@resvg/resvg-wasm": "resvgWasm",
        "fast-png": "fastPng",
        gifenc: "gifenc",
        "jpeg-js": "jpegJs",
        omggif: "omggif",
        "qrcode-generator": "qrcodeGenerator",
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
    // CLI is self-contained: bundle every dep (including commander, a devDep).
    deps: {
      onlyBundle: false,
    },
  },
]);
