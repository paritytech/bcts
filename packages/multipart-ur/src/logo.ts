/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::logo`.
 */

import * as jpeg from "jpeg-js";
import { decode as decodePng } from "fast-png";

import { MurError } from "./error.js";
import { rasterizeSvgTo512 } from "./svg.js";

/** Shape used to clear the center area behind the logo. */
export enum LogoClearShape {
  Square = "Square",
  Circle = "Circle",
}

export function logoClearShapeToString(shape: LogoClearShape): string {
  switch (shape) {
    case LogoClearShape.Square:
      return "square";
    case LogoClearShape.Circle:
      return "circle";
  }
}

export function logoClearShapeFromString(s: string): LogoClearShape {
  switch (s.toLowerCase()) {
    case "square":
      return LogoClearShape.Square;
    case "circle":
      return LogoClearShape.Circle;
    default:
      throw new Error(`unknown clear shape: ${s} (expected square or circle)`);
  }
}

/** A pre-rendered logo for compositing onto QR codes. */
export class Logo {
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** Fraction of QR width to occupy (0.01–0.99, default 0.25). */
  readonly fraction: number;
  /** Number of clear-border modules around the logo (0–5, default 1). */
  readonly clearBorder: number;
  /** Shape of the cleared center area. */
  readonly clearShape: LogoClearShape;

  private constructor(
    pixels: Uint8Array,
    width: number,
    height: number,
    fraction: number,
    clearBorder: number,
    clearShape: LogoClearShape,
  ) {
    this.pixels = pixels;
    this.width = width;
    this.height = height;
    this.fraction = fraction;
    this.clearBorder = clearBorder;
    this.clearShape = clearShape;
  }

  /**
   * Create a logo from SVG data, rendered at 512×512 via resvg-wasm
   * (web/Node compatible, no system deps).
   */
  static async fromSvg(
    svgData: Uint8Array,
    fraction: number,
    clearBorder: number,
    clearShape: LogoClearShape,
  ): Promise<Logo> {
    const f = validateFraction(fraction);
    const cb = validateClearBorder(clearBorder);
    const pixels = await rasterizeSvgTo512(svgData);
    return new Logo(pixels, 512, 512, f, cb, clearShape);
  }

  /** Create a logo from raw RGBA pixels. */
  static fromRgba(
    pixels: Uint8Array,
    width: number,
    height: number,
    fraction: number,
    clearBorder: number,
    clearShape: LogoClearShape,
  ): Logo {
    const f = validateFraction(fraction);
    const cb = validateClearBorder(clearBorder);
    if (pixels.length !== width * height * 4) {
      throw MurError.invalidParameter(
        `pixel buffer size ${pixels.length} doesn't match ${width}x${height}x4`,
      );
    }
    return new Logo(pixels, width, height, f, cb, clearShape);
  }

  /** Create a logo from PNG or JPEG image bytes. */
  static fromImageBytes(
    data: Uint8Array,
    fraction: number,
    clearBorder: number,
    clearShape: LogoClearShape,
  ): Logo {
    const f = validateFraction(fraction);
    const cb = validateClearBorder(clearBorder);

    let width: number;
    let height: number;
    let pixels: Uint8Array;

    if (isPng(data)) {
      try {
        const decoded = decodePng(data);
        width = decoded.width;
        height = decoded.height;
        pixels = ensureRgba8(
          new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
          decoded.channels ?? 4,
          decoded.depth ?? 8,
        );
      } catch (e) {
        throw MurError.imageEncode(
          `failed to decode image: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else if (isJpeg(data)) {
      try {
        const decoded = jpeg.decode(data, { useTArray: true });
        width = decoded.width;
        height = decoded.height;
        pixels = decoded.data instanceof Uint8Array ? decoded.data : new Uint8Array(decoded.data);
      } catch (e) {
        throw MurError.imageEncode(
          `failed to decode image: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      throw MurError.imageEncode(
        "failed to decode image: unrecognized format (expected PNG or JPEG)",
      );
    }

    return new Logo(pixels, width, height, f, cb, clearShape);
  }
}

function validateFraction(f: number): number {
  if (!(f >= 0.01 && f <= 0.99)) {
    throw MurError.invalidParameter(`logo fraction must be 0.01–0.99, got ${f}`);
  }
  return f;
}

function validateClearBorder(b: number): number {
  if (b > 5 || b < 0 || !Number.isInteger(b)) {
    throw MurError.invalidParameter(`clear_border must be 0–5, got ${b}`);
  }
  return b;
}

function isPng(data: Uint8Array): boolean {
  return (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  );
}

function isJpeg(data: Uint8Array): boolean {
  return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
}

function ensureRgba8(data: Uint8Array, channels: number, depth: number): Uint8Array {
  if (depth !== 8) {
    throw MurError.imageEncode(`unsupported PNG bit depth: ${depth} (expected 8)`);
  }
  if (channels === 4) {
    return data;
  }
  if (channels === 3) {
    const px = data.length / 3;
    const out = new Uint8Array(px * 4);
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out[j] = data[i]!;
      out[j + 1] = data[i + 1]!;
      out[j + 2] = data[i + 2]!;
      out[j + 3] = 255;
    }
    return out;
  }
  if (channels === 2) {
    const px = data.length / 2;
    const out = new Uint8Array(px * 4);
    for (let i = 0, j = 0; i < data.length; i += 2, j += 4) {
      const v = data[i];
      out[j] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = data[i + 1]!;
    }
    return out;
  }
  if (channels === 1) {
    const out = new Uint8Array(data.length * 4);
    for (let i = 0, j = 0; i < data.length; i++, j += 4) {
      const v = data[i];
      out[j] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = 255;
    }
    return out;
  }
  throw MurError.imageEncode(`unsupported PNG channel count: ${channels}`);
}

/**
 * Internal test-only exports mirroring the rust `#[cfg(test)] mod tests`
 * block's access to private helpers. Not re-exported from `index.ts`.
 *
 * @internal
 */
export const __testables = { validateFraction, validateClearBorder };
