/**
 * Port of rust `tests/integration.rs::write_test_outputs`.
 *
 * Writes sample PNG + GIF + ProRes artefacts to `tests/out/` for human
 * review. Runs only when `MUR_WRITE_OUTPUTS=1` is set; the ProRes step
 * requires `ffmpeg` on PATH and is skipped otherwise.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toByteString } from "@bcts/dcbor";
import { UR } from "@bcts/uniform-resources";

import {
  type AnimateParams,
  Color,
  CorrectionLevel,
  Logo,
  LogoClearShape,
  encodeAnimatedGif,
  encodeProres,
  generateFrames,
  renderUrQr,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_SVG = new Uint8Array(readFileSync(resolve(__dirname, "test_data", "bc-logo.svg")));
const SHORT_UR = "ur:bytes/hdcxdwinvezm";

function longUr(): UR {
  const data = new Uint8Array(500);
  for (let i = 0; i < 500; i++) data[i] = i % 256;
  return UR.new("bytes", toByteString(data));
}

const WRITE = process.env["MUR_WRITE_OUTPUTS"] === "1";
const HAS_FFMPEG = spawnSync("which", ["ffmpeg"], { encoding: "utf8" }).status === 0;

describe.skipIf(!WRITE)("write_test_outputs", () => {
  it("writes all sample artefacts", async () => {
    const outDir = resolve(__dirname, "out");
    mkdirSync(outDir, { recursive: true });

    const logo = await Logo.fromSvg(TEST_SVG, 0.25, 1, LogoClearShape.Square);
    const circleLogo = await Logo.fromSvg(TEST_SVG, 0.25, 1, LogoClearShape.Circle);

    // ── Light mode (default) ──
    writeFileSync(
      resolve(outDir, "single-no-logo.png"),
      renderUrQr(SHORT_UR, CorrectionLevel.Low, 512, Color.BLACK, Color.WHITE, 1, null).toPng(),
    );
    writeFileSync(
      resolve(outDir, "single-with-logo.png"),
      renderUrQr(SHORT_UR, CorrectionLevel.High, 512, Color.BLACK, Color.WHITE, 1, logo).toPng(),
    );
    writeFileSync(
      resolve(outDir, "single-circle-logo.png"),
      renderUrQr(
        SHORT_UR,
        CorrectionLevel.High,
        512,
        Color.BLACK,
        Color.WHITE,
        1,
        circleLogo,
      ).toPng(),
    );

    // ── Dark mode ──
    writeFileSync(
      resolve(outDir, "single-dark-no-logo.png"),
      renderUrQr(SHORT_UR, CorrectionLevel.Low, 512, Color.WHITE, Color.BLACK, 1, null).toPng(),
    );
    writeFileSync(
      resolve(outDir, "single-dark-with-logo.png"),
      renderUrQr(SHORT_UR, CorrectionLevel.High, 512, Color.WHITE, Color.BLACK, 1, logo).toPng(),
    );

    // ── Quiet zone variations ──
    writeFileSync(
      resolve(outDir, "single-qz0.png"),
      renderUrQr(SHORT_UR, CorrectionLevel.Low, 512, Color.BLACK, Color.WHITE, 0, null).toPng(),
    );
    writeFileSync(
      resolve(outDir, "single-qz4.png"),
      renderUrQr(SHORT_UR, CorrectionLevel.Low, 512, Color.BLACK, Color.WHITE, 4, null).toPng(),
    );
    writeFileSync(
      resolve(outDir, "single-dark-qz4-logo.png"),
      renderUrQr(SHORT_UR, CorrectionLevel.High, 512, Color.WHITE, Color.BLACK, 4, logo).toPng(),
    );

    // ── Animated ──
    const ur = longUr();
    const baseParams: AnimateParams = {
      maxFragmentLen: 50,
      size: 512,
      cycles: 2,
      fps: 8,
    };

    const frames = generateFrames(ur, baseParams);
    writeFileSync(resolve(outDir, "animated.gif"), encodeAnimatedGif(frames, 8));

    const framesLogo = generateFrames(ur, { ...baseParams, logo });
    writeFileSync(resolve(outDir, "animated-logo.gif"), encodeAnimatedGif(framesLogo, 8));

    const framesCircleLogo = generateFrames(ur, {
      ...baseParams,
      logo: circleLogo,
    });
    writeFileSync(
      resolve(outDir, "animated-circle-logo.gif"),
      encodeAnimatedGif(framesCircleLogo, 8),
    );

    const framesDarkLogo = generateFrames(ur, {
      ...baseParams,
      foreground: Color.WHITE,
      background: Color.BLACK,
      logo,
    });
    writeFileSync(resolve(outDir, "animated-dark-logo.gif"), encodeAnimatedGif(framesDarkLogo, 8));

    const framesDark = generateFrames(ur, {
      ...baseParams,
      foreground: Color.WHITE,
      background: Color.BLACK,
    });
    writeFileSync(resolve(outDir, "animated-dark.gif"), encodeAnimatedGif(framesDark, 8));

    // ── ProRes 4444 (requires ffmpeg on PATH) ──
    if (HAS_FFMPEG) {
      const proresPath = resolve(outDir, "animated.mov");
      await encodeProres(frames, 8, proresPath);
      expect(existsSync(proresPath)).toBe(true);
      expect(statSync(proresPath).size).toBeGreaterThan(100);
    }
  });
});
