/**
 * Port of `bc-mur::tests::integration`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { toByteString } from "@bcts/dcbor";
import { UR } from "@bcts/uniform-resources";

import {
  type AnimateParams,
  Color,
  CorrectionLevel,
  DEFAULT_MAX_MODULES,
  Logo,
  LogoClearShape,
  MurError,
  checkQrDensity,
  encodeAnimatedGif,
  generateFrames,
  qrModuleCount,
  renderQr,
  renderUrQr,
  writeFramePngs,
} from "../src/index.js";

const TEST_SVG = new Uint8Array(
  readFileSync(new URL("./test_data/bc-logo.svg", import.meta.url)),
);

// A short UR string that fits in a single QR frame.
const SHORT_UR = "ur:bytes/hdcxdwinvezm";

/** Build a valid UR with a large CBOR payload that requires multipart encoding. */
function longUr(): UR {
  const data = new Uint8Array(500);
  for (let i = 0; i < 500; i++) data[i] = i % 256;
  return UR.new("bytes", toByteString(data));
}

// ─── Single-frame rendering ────────────────────────────

describe("single frame", () => {
  it("png dimensions", () => {
    const img = renderUrQr(
      SHORT_UR,
      CorrectionLevel.Low,
      512,
      Color.BLACK,
      Color.WHITE,
      1,
      null,
    );
    expect(img.width).toBe(512);
    expect(img.height).toBe(512);

    const png = img.toPng();
    expect(png.length).toBeGreaterThan(100);
    expect(Array.from(png.slice(0, 4))).toEqual([137, 80, 78, 71]);
  });

  it("jpeg", () => {
    const img = renderUrQr(
      SHORT_UR,
      CorrectionLevel.Medium,
      256,
      Color.BLACK,
      Color.WHITE,
      1,
      null,
    );
    const jpegBytes = img.toJpeg(85);
    expect(Array.from(jpegBytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
  });

  it("custom colors", () => {
    const img = renderQr(
      new TextEncoder().encode("HELLO"),
      CorrectionLevel.High,
      128,
      Color.fromHex("#0000FF"),
      Color.fromHex("#FFFF00"),
      1,
      null,
    );
    expect(img.width).toBe(128);
    let hasBlue = false;
    for (let i = 0; i < img.pixels.length; i += 4) {
      if (
        img.pixels[i] === 0 &&
        img.pixels[i + 1] === 0 &&
        img.pixels[i + 2] === 255
      ) {
        hasBlue = true;
        break;
      }
    }
    expect(hasBlue).toBe(true);
  });

  it("dark mode", () => {
    const img = renderUrQr(
      SHORT_UR,
      CorrectionLevel.Low,
      256,
      Color.WHITE,
      Color.BLACK,
      1,
      null,
    );
    expect(img.pixels[0]).toBe(0);
    expect(img.pixels[1]).toBe(0);
    expect(img.pixels[2]).toBe(0);
  });

  it("quiet zone 0", () => {
    const img = renderQr(
      new TextEncoder().encode("HELLO"),
      CorrectionLevel.Low,
      256,
      Color.BLACK,
      Color.WHITE,
      0,
      null,
    );
    expect(img.width).toBe(256);
  });

  it("quiet zone 4", () => {
    const img = renderQr(
      new TextEncoder().encode("HELLO"),
      CorrectionLevel.Low,
      512,
      Color.BLACK,
      Color.WHITE,
      4,
      null,
    );
    expect(img.width).toBe(512);
    expect(img.pixels[0]).toBe(255);
  });
});

// ─── Logo overlay ──────────────────────────────────────

describe("logo overlay", () => {
  it("svg logo", async () => {
    const logo = await Logo.fromSvg(TEST_SVG, 0.25, 1, LogoClearShape.Square);
    expect(logo.width).toBe(512);
    expect(logo.height).toBe(512);

    const img = renderUrQr(
      SHORT_UR,
      CorrectionLevel.High,
      512,
      Color.BLACK,
      Color.WHITE,
      1,
      logo,
    );
    const png = img.toPng();
    expect(png.length).toBeGreaterThan(100);
  });

  it("circle logo", async () => {
    const logo = await Logo.fromSvg(TEST_SVG, 0.30, 2, LogoClearShape.Circle);

    const img = renderQr(
      new TextEncoder().encode("UR:BYTES/TEST"),
      CorrectionLevel.High,
      256,
      Color.BLACK,
      Color.WHITE,
      1,
      logo,
    );
    expect(img.width).toBe(256);
  });
});

// ─── Animated multipart ────────────────────────────────

describe("animated", () => {
  it("gif basic", () => {
    const ur = longUr();
    const params: AnimateParams = {
      maxFragmentLen: 50,
      size: 256,
      cycles: 2,
      fps: 4,
    };
    const frames = generateFrames(ur, params);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const gif = encodeAnimatedGif(frames, 4);
    expect(new TextDecoder().decode(gif.slice(0, 6))).toBe("GIF89a");
    expect(gif.length).toBeGreaterThan(100);
  });

  it("gif with logo", async () => {
    const ur = longUr();
    const logo = await Logo.fromSvg(TEST_SVG, 0.20, 1, LogoClearShape.Square);
    const frames = generateFrames(ur, {
      maxFragmentLen: 50,
      size: 256,
      cycles: 1,
      fps: 4,
      logo,
    });
    const gif = encodeAnimatedGif(frames, 4);
    expect(new TextDecoder().decode(gif.slice(0, 6))).toBe("GIF89a");
  });

  it("frame dump", async () => {
    const ur = longUr();
    const frames = generateFrames(ur, {
      maxFragmentLen: 50,
      size: 128,
      cycles: 1,
      fps: 4,
    });
    const tmp = mkdtempSync(join(tmpdir(), "bc-mur-test-"));
    try {
      await writeFramePngs(frames, tmp);
      const entries = readdirSync(tmp);
      expect(entries.length).toBe(frames.length);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ─── Error cases ───────────────────────────────────────

describe("error cases", () => {
  it("invalid color hex", () => {
    expect(() => Color.fromHex("#ZZZZZZ")).toThrow();
  });

  it("logo fraction out of range", async () => {
    await expect(
      Logo.fromSvg(TEST_SVG, 0.0, 1, LogoClearShape.Square),
    ).rejects.toThrow();
    await expect(
      Logo.fromSvg(TEST_SVG, 1.0, 1, LogoClearShape.Square),
    ).rejects.toThrow();
  });
});

// ─── Density check ────────────────────────────────────

describe("density", () => {
  it("module count small", () => {
    const count = qrModuleCount(
      new TextEncoder().encode("HELLO"),
      CorrectionLevel.Low,
    );
    expect(count).toBe(21);
  });

  it("density passes", () => {
    expect(() => checkQrDensity(21, DEFAULT_MAX_MODULES)).not.toThrow();
  });

  it("density fails", () => {
    try {
      checkQrDensity(150, 117);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(MurError);
      const err = e as MurError;
      expect(err.isKind("QrCodeTooDense")).toBe(true);
      if (err.isKind("QrCodeTooDense")) {
        expect(err.variant.moduleCount).toBe(150);
        expect(err.variant.maxModules).toBe(117);
      }
    }
  });

  it("density check on dense QR", () => {
    const data = new Uint8Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = i % 256;
    const ur = UR.new("bytes", toByteString(data));
    const urString = ur.qrString();
    const upper = urString.toUpperCase();
    const modules = qrModuleCount(
      new TextEncoder().encode(upper),
      CorrectionLevel.Low,
    );
    expect(modules).toBeGreaterThan(DEFAULT_MAX_MODULES);
    try {
      checkQrDensity(modules, DEFAULT_MAX_MODULES);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(MurError);
      expect((e as MurError).isKind("QrCodeTooDense")).toBe(true);
    }
  });
});

// ─── Insufficient frames ─────────────────────────────

describe("frames", () => {
  it("insufficient frames error", () => {
    const ur = longUr();
    try {
      generateFrames(ur, {
        maxFragmentLen: 50,
        frameCount: 1,
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(MurError);
      expect((e as MurError).isKind("InsufficientFrames")).toBe(true);
    }
  });

  it("frame count exact", () => {
    const ur = longUr();
    const frames = generateFrames(ur, {
      maxFragmentLen: 50,
      frameCount: 100,
    });
    expect(frames.length).toBe(100);
  });

  it("animate density check", () => {
    const ur = longUr();
    try {
      generateFrames(ur, {
        maxFragmentLen: 500,
        maxModules: 21,
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(MurError);
      expect((e as MurError).isKind("QrCodeTooDense")).toBe(true);
    }
  });
});
