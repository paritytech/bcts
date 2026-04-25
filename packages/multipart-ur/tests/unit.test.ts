/**
 * Port of inline `#[cfg(test)] mod tests` blocks in the Rust source.
 */
import { describe, expect, it } from "vitest";

import {
  Color,
  CorrectionLevel,
  QrMatrix,
  renderQr,
  renderUrQr,
} from "../src/index.js";
import { demultiplyAlpha } from "../src/svg.js";

// color.rs
describe("color", () => {
  it("parse_hex_6", () => {
    const c = Color.fromHex("#FF8000");
    expect(c.equals(Color.new(255, 128, 0, 255))).toBe(true);
  });

  it("parse_hex_8", () => {
    const c = Color.fromHex("#FF800080");
    expect(c.equals(Color.new(255, 128, 0, 128))).toBe(true);
  });

  it("parse_hex_3", () => {
    const c = Color.fromHex("#F80");
    expect(c.equals(Color.new(0xff, 0x88, 0x00, 255))).toBe(true);
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
    const m = QrMatrix.encode(
      new TextEncoder().encode("HELLO"),
      CorrectionLevel.Low,
    );
    expect(m.width).toBe(21);
  });

  it("encode_ur_string", () => {
    const ur = "UR:BYTES/HDCXDWINVEZM";
    const m = QrMatrix.encode(
      new TextEncoder().encode(ur),
      CorrectionLevel.Low,
    );
    expect(m.width).toBeGreaterThanOrEqual(21);
  });
});

// logo.rs
describe("logo internals", () => {
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
