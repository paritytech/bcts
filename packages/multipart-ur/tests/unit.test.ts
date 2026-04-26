/**
 * Port of inline `#[cfg(test)] mod tests` blocks in the Rust source.
 */
import { describe, expect, it } from "vitest";

import { Color, CorrectionLevel, renderQr, renderUrQr } from "../src/index.js";
// Package-internal imports (not exposed in `index.ts` — same as rust crate-private symbols).
import { __testables as logoInternals } from "../src/logo.js";
import { QrMatrix } from "../src/qr-matrix.js";
import { __testables as renderInternals } from "../src/render.js";
import { demultiplyAlpha, rasterizeSvgTo512 } from "../src/svg.js";

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

  it("encode_ur_string (M1 — alphanumeric mode)", () => {
    // UR strings are uppercase alphanumeric by spec. Rust's `qrcode`
    // crate auto-selects Alphanumeric mode for "UR:BYTES/HDCXDWINVEZM"
    // (21 chars, fits in Version 1 Low's 25-char Alphanumeric capacity)
    // and produces a 21×21 matrix. The earlier TS port forced Byte
    // mode, which can only fit 17 bytes in Version 1 Low and
    // therefore rolled to Version 2 (25×25).
    //
    // Byte-identity with Rust requires us to pick the same mode.
    // This pin enforces that: any regression to Byte-mode-by-default
    // surfaces here as 25 instead of the Rust-correct 21.
    const ur = "UR:BYTES/HDCXDWINVEZM";
    const m = QrMatrix.encode(new TextEncoder().encode(ur), CorrectionLevel.Low);
    expect(m.width()).toBe(21);
  });

  it("encode binary payload uses Byte mode", () => {
    // Mixed-case / non-alphanumeric input falls through to Byte
    // mode in both Rust and TS. A 17-byte Latin-1 binary payload
    // fits in Version 1 Low (max 17 bytes) at 21×21.
    const bytes = new Uint8Array([
      0x91, 0x6e, 0xc6, 0x5c, 0xf7, 0x7c, 0xad, 0xf5, 0x5c, 0xd7, 0xf9, 0xcd, 0xa1, 0xa1, 0x03,
      0x00, 0x26,
    ]);
    expect(bytes.length).toBe(17);
    const m = QrMatrix.encode(bytes, CorrectionLevel.Low);
    expect(m.width()).toBe(21);
  });

  it("encode all-numeric payload uses Numeric mode", () => {
    // 41-digit numeric payload fits in Version 1 Low's Numeric
    // capacity (41 digits) at 21×21. Same 41-byte payload would
    // overflow Byte mode (max 17) into Version 3 (29×29), so this
    // pin proves Numeric is being selected.
    const numeric = "12345678901234567890123456789012345678901";
    expect(numeric.length).toBe(41);
    const m = QrMatrix.encode(new TextEncoder().encode(numeric), CorrectionLevel.Low);
    expect(m.width()).toBe(21);
  });

  it("encode lowercase falls through to Byte mode", () => {
    // The QR Alphanumeric set is uppercase only. A 21-char lowercase
    // payload picks Byte mode and rolls to Version 2 (25×25).
    const lowercase = "ur:bytes/hdcxdwinvezm";
    expect(lowercase.length).toBe(21);
    const m = QrMatrix.encode(new TextEncoder().encode(lowercase), CorrectionLevel.Low);
    expect(m.width()).toBe(25);
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

// svg.ts — M3 sub-pixel-accurate centering
describe("svg M3 — centering", () => {
  // For a 333×200 SVG, scale = min(512/333, 512/200) = 1.5375...
  // tx = (512 - 333 * 1.5375) / 2 ≈ 0.005...   (≈ 0)
  // ty = (512 - 200 * 1.5375) / 2 = 102.25     (sub-pixel!)
  //
  // The earlier integer-floor centering would land at row 102 with
  // a hard 1-pixel shift relative to Rust. The M3 fix uses
  // sub-pixel-accurate bilinear compositing so:
  //   - row 101 still has zero coverage (above the rendered SVG),
  //   - row 102 has partial coverage (≈ 0.75 weight from the
  //     bilinear sampler at the y=102.25 boundary),
  //   - row 103+ has full coverage where the source has pixels.
  //
  // We assert: a 333×200 fully-opaque red rectangle SVG produces a
  // 512×512 RGBA buffer where the top edge of the rendered region
  // shows anti-aliased alpha (a partial value, not just 0/255). The
  // earlier integer-offset centering would have produced a sharp
  // 0→255 edge there; the M3 fix produces an intermediate alpha.
  it("renders non-square SVG with sub-pixel-accurate vertical centering", async () => {
    const svgText = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 333 200">
  <rect x="0" y="0" width="333" height="200" fill="rgb(255, 0, 0)"/>
</svg>`;
    const svg = new TextEncoder().encode(svgText);
    const out = await rasterizeSvgTo512(svg);
    expect(out.length).toBe(512 * 512 * 4);

    // Helper: alpha of pixel at (col, row).
    const alphaAt = (col: number, row: number): number => out[(row * 512 + col) * 4 + 3];

    // Row 0 — well above the rendered SVG region — fully transparent.
    expect(alphaAt(256, 0)).toBe(0);
    // Row 511 — well below — fully transparent.
    expect(alphaAt(256, 511)).toBe(0);

    // Find the top-most row with a non-zero alpha at the horizontal
    // center column. The Rust-correct top edge is between rows 102
    // and 103 (because ty = 102.25), so the first non-zero row
    // should be 102 (with partial alpha from the bilinear sampler).
    let firstNonzero = -1;
    for (let y = 0; y < 200; y++) {
      if (alphaAt(256, y) > 0) {
        firstNonzero = y;
        break;
      }
    }
    expect(firstNonzero).toBeGreaterThanOrEqual(101);
    expect(firstNonzero).toBeLessThanOrEqual(103);

    // The top-edge pixel must have a partial alpha (anti-aliased
    // boundary). With the old integer-floor centering, the first
    // non-zero row would jump straight to 255; the M3 fix keeps
    // it intermediate so this assertion would have failed.
    const topEdgeAlpha = alphaAt(256, firstNonzero);
    expect(topEdgeAlpha).toBeGreaterThan(0);
    expect(topEdgeAlpha).toBeLessThan(255);

    // Two rows below the top edge the SVG is fully opaque.
    expect(alphaAt(256, firstNonzero + 2)).toBeGreaterThan(240);
  });
});
