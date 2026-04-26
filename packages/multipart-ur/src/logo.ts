/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::logo`.
 */

import * as jpeg from "jpeg-js";
import { decode as decodePng } from "fast-png";
import { GifReader } from "omggif";

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

  /**
   * Create a logo from raster image bytes.
   *
   * Mirrors Rust `image::load_from_memory` in
   * `bc-mur::logo::Logo::from_image_bytes` — accepts the same set of
   * formats: **PNG, JPEG, GIF, BMP, WebP** (lossy + lossless). The
   * format is detected from the magic bytes; the bytes are decoded
   * to RGBA8 and stored in the `Logo`. For animated GIFs the first
   * frame is used (matching `image::load_from_memory`'s behaviour
   * when the GIF feature is enabled but no animation API is invoked).
   *
   * @throws {MurError.imageEncode} if the magic bytes don't match
   *   any supported format, or if decoding fails.
   */
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

    try {
      if (isPng(data)) {
        const decoded = decodePng(data);
        width = decoded.width;
        height = decoded.height;
        pixels = ensureRgba8(
          new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
          decoded.channels ?? 4,
          decoded.depth ?? 8,
        );
      } else if (isJpeg(data)) {
        const decoded = jpeg.decode(data, { useTArray: true });
        width = decoded.width;
        height = decoded.height;
        pixels = decoded.data instanceof Uint8Array ? decoded.data : new Uint8Array(decoded.data);
      } else if (isGif(data)) {
        ({ width, height, pixels } = decodeGif(data));
      } else if (isBmp(data)) {
        ({ width, height, pixels } = decodeBmp(data));
      } else if (isWebp(data)) {
        // WebP needs an async WASM decoder (`webp-wasm`); use
        // `Logo.fromImageBytesAsync` instead. The sync API can't
        // decode WebP without bundling a synchronous decoder.
        throw new Error(
          "WebP decoding requires the async API — use `Logo.fromImageBytesAsync` instead",
        );
      } else {
        throw new Error(
          "unrecognized format (expected PNG, JPEG, GIF, or BMP)",
        );
      }
    } catch (e) {
      throw MurError.imageEncode(
        `failed to decode image: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return new Logo(pixels, width, height, f, cb, clearShape);
  }

  /**
   * Async counterpart of {@link Logo.fromImageBytes} that adds
   * **WebP** support via `webp-wasm`. Falls through to the sync
   * decoder for PNG / JPEG / GIF / BMP.
   *
   * Mirrors Rust `image::load_from_memory`'s full WebP coverage —
   * since TS lacks a sync WebP decoder, the async API is the
   * Rust-equivalent path for WebP inputs.
   *
   * @example
   * ```ts
   * const bytes = await fs.readFile("logo.webp");
   * const logo = await Logo.fromImageBytesAsync(bytes, 0.25, 1, LogoClearShape.Square);
   * ```
   */
  static async fromImageBytesAsync(
    data: Uint8Array,
    fraction: number,
    clearBorder: number,
    clearShape: LogoClearShape,
  ): Promise<Logo> {
    if (!isWebp(data)) {
      // Defer to the sync decoder for non-WebP formats.
      return Logo.fromImageBytes(data, fraction, clearBorder, clearShape);
    }

    const f = validateFraction(fraction);
    const cb = validateClearBorder(clearBorder);

    let imageData: { data: Uint8Array | Uint8ClampedArray; width: number; height: number };
    try {
      const webp = await import("webp-wasm");
      // `webp-wasm` returns a Promise<ImageData> with `data`/`width`/`height`.
      imageData = (await webp.decode(data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ) as ArrayBuffer)) as unknown as {
        data: Uint8ClampedArray;
        width: number;
        height: number;
      };
    } catch (e) {
      throw MurError.imageEncode(
        `failed to decode image: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const pixels =
      imageData.data instanceof Uint8Array
        ? imageData.data
        : new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
    return new Logo(pixels, imageData.width, imageData.height, f, cb, clearShape);
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

/** GIF87a / GIF89a magic bytes. */
function isGif(data: Uint8Array): boolean {
  return (
    data.length >= 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38 &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  );
}

/** BMP magic bytes — `BM`. */
function isBmp(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x42 && data[1] === 0x4d;
}

/** WebP magic bytes — `RIFF....WEBP`. */
function isWebp(data: Uint8Array): boolean {
  return (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  );
}

/**
 * Decode a GIF to RGBA8 (first frame for animated GIFs, mirroring
 * Rust's `image::load_from_memory` GIF behaviour).
 */
function decodeGif(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  const reader = new GifReader(data);
  const width = reader.width;
  const height = reader.height;
  const pixels = new Uint8Array(width * height * 4);
  // GifReader.decodeAndBlitFrameRGBA writes RGBA8 directly.
  reader.decodeAndBlitFrameRGBA(0, pixels);
  return { width, height, pixels };
}

/**
 * Decode an uncompressed 24-bit or 32-bit BMP to RGBA8.
 *
 * Mirrors Rust's `image::codecs::bmp` BMP decoder for the common
 * (and dominant) 24/32-bit BI_RGB case. RLE / 16bpp / 1bpp BMPs
 * surface as a decode error — those are vanishingly rare in
 * practice and the audit explicitly accepts the BI_RGB subset.
 */
function decodeBmp(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  if (data.length < 54) {
    throw new Error("BMP too small (expected at least 54 header bytes)");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const dataOffset = view.getUint32(10, true);
  const dibSize = view.getUint32(14, true);
  if (dibSize < 40) {
    throw new Error(`unsupported BMP DIB header size: ${dibSize}`);
  }
  const width = view.getInt32(18, true);
  const heightSigned = view.getInt32(22, true);
  const height = Math.abs(heightSigned);
  const topDown = heightSigned < 0;
  const bpp = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  if (compression !== 0) {
    throw new Error(`unsupported BMP compression: ${compression} (only BI_RGB is supported)`);
  }
  if (bpp !== 24 && bpp !== 32) {
    throw new Error(`unsupported BMP bit depth: ${bpp} (expected 24 or 32)`);
  }
  const bytesPerPixel = bpp / 8;
  // BMP rows are padded to 4-byte boundaries.
  const rowStride = Math.ceil((width * bpp) / 32) * 4;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    const srcOffset = dataOffset + srcRow * rowStride;
    if (srcOffset + width * bytesPerPixel > data.length) {
      throw new Error("BMP truncated row data");
    }
    for (let x = 0; x < width; x++) {
      const px = srcOffset + x * bytesPerPixel;
      const dst = (y * width + x) * 4;
      // BMP stores pixels as B, G, R[, A].
      pixels[dst] = data[px + 2]!; // R
      pixels[dst + 1] = data[px + 1]!; // G
      pixels[dst + 2] = data[px]!; // B
      pixels[dst + 3] = bpp === 32 ? data[px + 3]! : 255;
    }
  }
  return { width, height, pixels };
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
