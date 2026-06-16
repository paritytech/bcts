import { defineConfig } from "tsdown";

export default defineConfig([
  // Library build
  {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    dts: true,
    inputOptions: {
      // The rolldown-plugin-dts "fake-js" pass transforms .d.ts content without
      // emitting a sourcemap, producing a spurious SOURCEMAP_BROKEN warning even
      // though the real JS sourcemaps are correct. Filter only that case.
      onwarn(warning, defaultHandler) {
        if (warning.code === "SOURCEMAP_BROKEN") return;
        defaultHandler(warning);
      },
    },
    sourcemap: true,
    clean: true,
    target: "es2022",
    outputOptions: {
      globals: {
        "@bcts/components": "bctsComponents",
        "@bcts/dcbor": "bctsDcbor",
        "@bcts/envelope": "bctsEnvelope",
        "@bcts/uniform-resources": "bctsUniformResources",
        "@bcts/sskr": "bctsSskr",
        "@bcts/rand": "bctsRand",
        "@bcts/known-values": "bctsKnownValues",
        "@bcts/tags": "bctsTags",
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
