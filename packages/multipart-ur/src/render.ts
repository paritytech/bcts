/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::render`.
 */

import { encode as encodePng } from "fast-png";
import * as jpeg from "jpeg-js";

import { Color } from "./color.js";
import { type CorrectionLevel } from "./correction.js";
import { MurError } from "./error.js";
import { type Logo, LogoClearShape } from "./logo.js";
import { QrMatrix } from "./qr-matrix.js";

/** An RGBA pixel buffer with encoding methods. */
export class RenderedImage {
  /** RGBA pixels, row-major, 4 bytes per pixel. */
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;

  constructor(pixels: Uint8Array, width: number, height: number) {
    this.pixels = pixels;
    this.width = width;
    this.height = height;
  }

  /** Encode as PNG. */
  toPng(): Uint8Array {
    try {
      return encodePng({
        width: this.width,
        height: this.height,
        data: this.pixels,
        depth: 8,
        channels: 4,
      });
    } catch (e) {
      throw MurError.imageEncode(
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  /** Encode as JPEG at the given quality (1–100). */
  toJpeg(quality: number): Uint8Array {
    try {
      const result = jpeg.encode(
        { data: this.pixels, width: this.width, height: this.height },
        quality,
      );
      return result.data instanceof Uint8Array
        ? result.data
        : new Uint8Array(result.data);
    } catch (e) {
      throw MurError.imageEncode(
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}

/**
 * Render a single-frame QR code from raw bytes.
 *
 * - `message`: bytes to encode in the QR code
 * - `correction`: error correction level
 * - `size`: target image size in pixels (square)
 * - `fg` / `bg`: foreground and background colors
 * - `quietZone`: number of background-colored modules around the QR code
 *   (default 1)
 * - `logo`: optional logo overlay
 */
export function renderQr(
  message: Uint8Array,
  correction: CorrectionLevel,
  size: number,
  fg: Color,
  bg: Color,
  quietZone: number,
  logo: Logo | null,
): RenderedImage {
  const matrix = QrMatrix.encode(message, correction);
  return renderFromMatrix(matrix, size, fg, bg, quietZone, logo);
}

/**
 * Render a single-frame QR code from a UR string.
 *
 * The UR string is automatically uppercased for QR alphanumeric mode
 * efficiency.
 */
export function renderUrQr(
  urString: string,
  correction: CorrectionLevel,
  size: number,
  fg: Color,
  bg: Color,
  quietZone: number,
  logo: Logo | null,
): RenderedImage {
  const upper = urString.toUpperCase();
  return renderQr(
    new TextEncoder().encode(upper),
    correction,
    size,
    fg,
    bg,
    quietZone,
    logo,
  );
}

/**
 * Paint the QR matrix into a pixel buffer with module-aligned rendering,
 * then composite the logo if present.
 */
export function renderFromMatrix(
  matrix: QrMatrix,
  size: number,
  fg: Color,
  bg: Color,
  quietZone: number,
  logo: Logo | null,
): RenderedImage {
  const qrModules = matrix.width;
  const totalModules = qrModules + 2 * quietZone;
  const pixelsPerModule = Math.max(1, Math.floor(size / totalModules));
  const compositingSize = totalModules * pixelsPerModule;
  const qzPx = quietZone * pixelsPerModule;

  // Allocate RGBA buffer, fill with background.
  const pixels = new Uint8Array(compositingSize * compositingSize * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = bg.r;
    pixels[i + 1] = bg.g;
    pixels[i + 2] = bg.b;
    pixels[i + 3] = bg.a;
  }

  // Paint QR modules offset by quiet zone.
  for (let row = 0; row < qrModules; row++) {
    for (let col = 0; col < qrModules; col++) {
      const color = matrix.isDark(col, row) ? fg : bg;
      const px = qzPx + col * pixelsPerModule;
      const py = qzPx + row * pixelsPerModule;
      fillRect(
        pixels,
        compositingSize,
        px,
        py,
        pixelsPerModule,
        pixelsPerModule,
        color,
      );
    }
  }

  // Logo overlay.
  if (logo) {
    compositeLogo(
      pixels,
      compositingSize,
      qrModules,
      pixelsPerModule,
      qzPx,
      bg,
      logo,
    );
  }

  // Scale to final requested size if different.
  const finalPixels =
    compositingSize !== size
      ? nearestNeighborScale(
          pixels,
          compositingSize,
          compositingSize,
          size,
          size,
        )
      : pixels;

  return new RenderedImage(finalPixels, size, size);
}

/** Fill a rectangle in the RGBA buffer. */
function fillRect(
  pixels: Uint8Array,
  stride: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const offset = (row * stride + col) * 4;
      pixels[offset] = color.r;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.b;
      pixels[offset + 3] = color.a;
    }
  }
}

/**
 * Composite the logo into the center of the QR code.
 *
 * `qzPx` is the quiet-zone offset in pixels so the logo centers on the
 * QR data area, not the entire image.
 */
function compositeLogo(
  pixels: Uint8Array,
  compositingSize: number,
  moduleCount: number,
  pixelsPerModule: number,
  qzPx: number,
  bg: Color,
  logo: Logo,
): void {
  const layout = new LogoLayout(moduleCount, logo.fraction, logo.clearBorder);

  if (layout.logoModules === 0) {
    return;
  }

  const clearColor = bg.isTransparent() ? Color.WHITE : bg;

  const centerModule = moduleCount / 2;
  const qrPx = moduleCount * pixelsPerModule;

  const startModule = Math.floor((moduleCount - layout.clearedModules) / 2);

  switch (logo.clearShape) {
    case LogoClearShape.Square: {
      const clearPixels = layout.clearedModules * pixelsPerModule;
      const clearOrigin = qzPx + Math.floor((qrPx - clearPixels) / 2);
      fillRect(
        pixels,
        compositingSize,
        clearOrigin,
        clearOrigin,
        clearPixels,
        clearPixels,
        clearColor,
      );
      break;
    }
    case LogoClearShape.Circle: {
      const radius = layout.clearedModules / 2;
      for (let row = 0; row < layout.clearedModules; row++) {
        for (let col = 0; col < layout.clearedModules; col++) {
          const mx = startModule + col + 0.5;
          const my = startModule + row + 0.5;
          const dx = mx - centerModule;
          const dy = my - centerModule;
          if (dx * dx + dy * dy <= radius * radius) {
            const px = qzPx + (startModule + col) * pixelsPerModule;
            const py = qzPx + (startModule + row) * pixelsPerModule;
            fillRect(
              pixels,
              compositingSize,
              px,
              py,
              pixelsPerModule,
              pixelsPerModule,
              clearColor,
            );
          }
        }
      }
      break;
    }
  }

  // Draw the logo centered within the QR data area.
  const logoPixels = layout.logoModules * pixelsPerModule;
  const logoOrigin = qzPx + Math.floor((qrPx - logoPixels) / 2);

  const scaled = bilinearScale(
    logo.pixels,
    logo.width,
    logo.height,
    logoPixels,
    logoPixels,
  );

  // Alpha-composite the scaled logo onto the QR.
  for (let row = 0; row < logoPixels; row++) {
    for (let col = 0; col < logoPixels; col++) {
      const srcOffset = (row * logoPixels + col) * 4;
      const dstX = logoOrigin + col;
      const dstY = logoOrigin + row;
      const dstOffset = (dstY * compositingSize + dstX) * 4;

      const sa = scaled[srcOffset + 3];
      if (sa === 0) continue;
      if (sa === 255) {
        pixels[dstOffset] = scaled[srcOffset]!;
        pixels[dstOffset + 1] = scaled[srcOffset + 1]!;
        pixels[dstOffset + 2] = scaled[srcOffset + 2]!;
        pixels[dstOffset + 3] = 255;
      } else {
        const da = pixels[dstOffset + 3];
        const invSa = 255 - sa;
        const outA = sa + Math.floor((da * invSa) / 255);
        if (outA > 0) {
          for (let c = 0; c < 3; c++) {
            const sc = scaled[srcOffset + c];
            const dc = pixels[dstOffset + c];
            pixels[dstOffset + c] = Math.floor(
              (sc * sa + Math.floor((dc * da * invSa) / 255)) / outA,
            ) & 0xff;
          }
          pixels[dstOffset + 3] = Math.min(outA, 255);
        }
      }
    }
  }
}

/** Logo layout calculation — mirrors Swift `LogoLayout` / Kotlin `LogoLayout`. */
class LogoLayout {
  readonly logoModules: number;
  readonly clearedModules: number;

  constructor(moduleCount: number, fraction: number, clearBorder: number) {
    let logo = Math.round(moduleCount * fraction);
    if (logo % 2 === 0) {
      logo += 1;
    }
    let cleared = logo + 2 * clearBorder;
    const maxCleared = Math.floor(moduleCount * 0.4);
    if (cleared > maxCleared) {
      cleared = maxCleared;
      logo = Math.max(0, cleared - 2 * clearBorder);
    }
    if (logo % 2 === 0 && logo > 0) {
      logo -= 1;
    }
    this.logoModules = logo;
    this.clearedModules = cleared;
  }
}

/** Nearest-neighbor scale for crisp QR modules. */
export function nearestNeighborScale(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(Math.floor((y * srcH) / dstH), srcH - 1);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(Math.floor((x * srcW) / dstW), srcW - 1);
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = src[si]!;
      dst[di + 1] = src[si + 1]!;
      dst[di + 2] = src[si + 2]!;
      dst[di + 3] = src[si + 3]!;
    }
  }
  return dst;
}

/** Bilinear scale for smooth logo rendering. */
export function bilinearScale(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const fy = (y * (srcH - 1)) / Math.max(dstH - 1, 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const wy = fy - y0;

    for (let x = 0; x < dstW; x++) {
      const fx = (x * (srcW - 1)) / Math.max(dstW - 1, 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const wx = fx - x0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const di = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v =
          src[i00 + c] * (1 - wx) * (1 - wy) +
          src[i10 + c] * wx * (1 - wy) +
          src[i01 + c] * (1 - wx) * wy +
          src[i11 + c] * wx * wy;
        dst[di + c] = Math.round(v) & 0xff;
      }
    }
  }
  return dst;
}
