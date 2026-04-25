/**
 * Port of inline `#[cfg(test)] mod tests` blocks in the Rust source.
 */
import { describe, expect, it } from "vitest";

import { Color, CorrectionLevel, renderQr, renderUrQr } from "../src/index.js";
// Package-internal imports (not exposed in `index.ts` — same as rust crate-private symbols).
import { __testables as logoInternals } from "../src/logo.js";
import { QrMatrix } from "../src/qr-matrix.js";
import { __testables as renderInternals } from "../src/render.js";
import { demultiplyAlpha } from "../src/svg.js";

const { validateFraction, validateClearBorder } = logoInternals;
const { LogoLayout } = renderInternals;

// color.rs
describe("color", () => {
  it("parse_hex_6", () => {
    const c = Color.fromHex("#FF8000");
    expect(c).toEqual(Color.new(255, 128, 0, 255));
  });

  it("parse_hex_8", () => {
    const c = Color.fromHex("#FF800080");
    expect(c).toEqual(Color.new(255, 128, 0, 128));
  });

  it("parse_hex_3", () => {
    const c = Color.fromHex("#F80");
    expect(c).toEqual(Color.new(0xff, 0x88, 0x00, 255));
  });

  it("display_rgb", () => {
    expect(Color.BLACK.toString()).toBe("#000000");
  });

  it("display_rgba", () => {
    expect(Color.new(255, 128, 0, 128).toString()).toBe("#FF800080");
  });
});

// qr_matrix.rs
describe("qr_matrix", () => {
  it("encode_small", () => {
    const m = QrMatrix.encode(new TextEncoder().encode("HELLO"), CorrectionLevel.Low);
    expect(m.width()).toBe(21);
  });

  it("encode_ur_string", () => {
    const ur = "UR:BYTES/HDCXDWINVEZM";
    const m = QrMatrix.encode(new TextEncoder().encode(ur), CorrectionLevel.Low);
    expect(m.width()).toBeGreaterThanOrEqual(21);
  });
});

// logo.rs
describe("logo internals", () => {
  it("fraction_validation", () => {
    expect(() => validateFraction(0.25)).not.toThrow();
    expect(() => validateFraction(0.0)).toThrow();
    expect(() => validateFraction(1.0)).toThrow();
  });

  it("clear_border_validation", () => {
    expect(() => validateClearBorder(0)).not.toThrow();
    expect(() => validateClearBorder(5)).not.toThrow();
    expect(() => validateClearBorder(6)).toThrow();
  });

  it("demultiply identity (opaque)", () => {
    const data = new Uint8Array([255, 128, 0, 255]);
    const out = demultiplyAlpha(data);
    expect(Array.from(out)).toEqual(Array.from(data));
  });

  it("demultiply transparent", () => {
    const data = new Uint8Array([0, 0, 0, 0]);
    const out = demultiplyAlpha(data);
    expect(Array.from(out)).toEqual([0, 0, 0, 0]);
  });
});

// render.rs
describe("render", () => {
  it("logo_layout_basic", () => {
    const l = new LogoLayout(25, 0.25, 1);
    // 25 * 0.25 = 6.25 → round to 6 → force odd → 7
    expect(l.logoModules).toBe(7);
    // 7 + 2*1 = 9
    expect(l.clearedModules).toBe(9);
  });

  it("logo_layout_cap_at_40_pct", () => {
    // 21 * 0.40 = 8.4 → floor = 8
    const l = new LogoLayout(21, 0.5, 2);
    // 21 * 0.5 = 10.5 → 11 (odd), cleared = 11+4=15 > 8 → capped
    expect(l.clearedModules).toBeLessThanOrEqual(8);
  });

  it("render_basic_qr", () => {
    const img = renderQr(
      new TextEncoder().encode("HELLO"),
      CorrectionLevel.Low,
      256,
      Color.BLACK,
      Color.WHITE,
      1,
      null,
    );
    expect(img.width).toBe(256);
    expect(img.height).toBe(256);
    expect(img.pixels.length).toBe(256 * 256 * 4);
  });

  it("render_to_png", () => {
    const img = renderQr(
      new TextEncoder().encode("TEST"),
      CorrectionLevel.Medium,
      128,
      Color.BLACK,
      Color.WHITE,
      1,
      null,
    );
    const png = img.toPng();
    expect(Array.from(png.slice(0, 4))).toEqual([137, 80, 78, 71]);
  });

  it("render_ur_qr_uppercases", () => {
    const img = renderUrQr(
      "ur:bytes/hdcxdwinvezm",
      CorrectionLevel.Low,
      256,
      Color.BLACK,
      Color.WHITE,
      1,
      null,
    );
    expect(img.width).toBe(256);
  });
});
