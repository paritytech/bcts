/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::animate`.
 */

import { MultipartEncoder, type UR } from "@bcts/uniform-resources";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

import { Color } from "./color.js";
import { CorrectionLevel } from "./correction.js";
import { MurError } from "./error.js";
import type { Logo } from "./logo.js";
import { QrMatrix, checkQrDensity } from "./qr-matrix.js";
import { type RenderedImage, renderFromMatrix } from "./render.js";

/** Parameters for multipart animated QR generation. */
export interface AnimateParams {
  /** Maximum fragment length for fountain coding (default 40). */
  maxFragmentLen?: number;
  /**
   * Error correction level. `null`/undefined = auto: Low without logo,
   * High with logo.
   */
  correction?: CorrectionLevel | null;
  /** Target image size in pixels (default 512). */
  size?: number;
  /** Foreground color (default black). */
  foreground?: Color;
  /** Background color (default white). */
  background?: Color;
  /** Quiet zone modules around the QR code (default 1). */
  quietZone?: number;
  /** Optional logo overlay. */
  logo?: Logo | null;
  /** Frames per second (default 8.0). */
  fps?: number;
  /** Number of complete cycles through all fragments (default 3). */
  cycles?: number;
  /**
   * If set, use exactly this many frames instead of `partsCount * cycles`.
   * Throws `InsufficientFrames` if fewer than the fountain-coded fragment
   * count.
   */
  frameCount?: number | null;
  /**
   * If set, check each frame's QR module count against this limit. Throws
   * `QrCodeTooDense` if exceeded.
   */
  maxModules?: number | null;
}

interface ResolvedParams {
  maxFragmentLen: number;
  correction: CorrectionLevel | null;
  size: number;
  foreground: Color;
  background: Color;
  quietZone: number;
  logo: Logo | null;
  fps: number;
  cycles: number;
  frameCount: number | null;
  maxModules: number | null;
}

function resolveParams(p: AnimateParams): ResolvedParams {
  return {
    maxFragmentLen: p.maxFragmentLen ?? 40,
    correction: p.correction ?? null,
    size: p.size ?? 512,
    foreground: p.foreground ?? Color.BLACK,
    background: p.background ?? Color.WHITE,
    quietZone: p.quietZone ?? 1,
    logo: p.logo ?? null,
    fps: p.fps ?? 8.0,
    cycles: p.cycles ?? 3,
    frameCount: p.frameCount ?? null,
    maxModules: p.maxModules ?? null,
  };
}

function effectiveCorrection(p: ResolvedParams): CorrectionLevel {
  if (p.correction) return p.correction;
  return p.logo ? CorrectionLevel.High : CorrectionLevel.Low;
}

/** A single frame of a multipart QR animation. */
export class QrFrame {
  /** The rendered RGBA image for this frame. */
  readonly image: RenderedImage;
  /** The part index (0-based). */
  readonly index: number;

  constructor(image: RenderedImage, index: number) {
    this.image = image;
    this.index = index;
  }
}

/**
 * Generate all frames for a multipart UR animation.
 *
 * Cycles through the fountain-coded parts `params.cycles` times.
 */
export function generateFrames(ur: UR, params: AnimateParams = {}): QrFrame[] {
  const p = resolveParams(params);
  let encoder: MultipartEncoder;
  try {
    encoder = new MultipartEncoder(ur, p.maxFragmentLen);
  } catch (e) {
    throw MurError.ur(e instanceof Error ? e.message : String(e));
  }
  const partsCount = encoder.partsCount();
  const totalFrames = p.frameCount !== null ? p.frameCount : partsCount * p.cycles;

  if (totalFrames < partsCount) {
    throw MurError.insufficientFrames(totalFrames, partsCount);
  }

  const correction = effectiveCorrection(p);
  const frames: QrFrame[] = new Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    let part: string;
    try {
      part = encoder.nextPart();
    } catch (e) {
      throw MurError.ur(e instanceof Error ? e.message : String(e));
    }
    const index = encoder.currentIndex();
    const upper = part.toUpperCase();
    const matrix = QrMatrix.encode(new TextEncoder().encode(upper), correction);

    if (i === 0 && p.maxModules !== null) {
      checkQrDensity(matrix.width(), p.maxModules);
    }

    const image = renderFromMatrix(matrix, p.size, p.foreground, p.background, p.quietZone, p.logo);
    frames[i] = new QrFrame(image, index);
  }

  return frames;
}

/**
 * Encode frames into an animated GIF.
 *
 * For QR codes without logos, uses a small global palette (2–4 colors).
 * For QR codes with logos, uses per-frame quantization.
 *
 * **Parity caveat (M2 in `PARITY_OUTSTANDING.md`).** Rust's
 * `bc-mur` uses the [`gif`](https://crates.io/crates/gif) crate;
 * this port uses [`gifenc`](https://www.npmjs.com/package/gifenc).
 * The two encoders produce **byte-different** GIFs for identical
 * input frames because:
 * - palette laid out differently (`gif` flattens RGB triplets into
 *   a `Vec<u8>`; `gifenc` keeps an array of `[r,g,b]` triplets and
 *   may pad to a different power-of-two table size),
 * - many-color quantization uses different algorithms (`gif`
 *   delegates to `color_quant::NeuQuant`; `gifenc` uses its own
 *   palette quantizer),
 * - LZW compression dictionary order can differ.
 *
 * The output is **visually equivalent** (same frames, same delays,
 * infinite loop, same palette colors when ≤256 unique colors), but
 * not byte-identical. Replacing the encoder is a large undertaking
 * (audit recommends accepting divergence).
 *
 * The structural invariants we *do* enforce — and that the
 * `tests/integration.test.ts > "gif structure (M2)"` test pins — are:
 * - `GIF89a` magic at byte 0.
 * - `NETSCAPE2.0` application extension present (= multi-frame
 *   animated GIF).
 * - Loop count `0x0000` (= repeat forever) per the `repeat: 0`
 *   argument below.
 * - One image-separator byte (`0x2c`) per frame.
 */
export function encodeAnimatedGif(frames: readonly QrFrame[], fps: number): Uint8Array {
  if (frames.length === 0) {
    throw MurError.invalidParameter("no frames to encode");
  }

  const width = frames[0].image.width;
  const height = frames[0].image.height;
  // Both impls compute centiseconds the same way:
  //   Rust: `(100.0 / fps).round() as u16` → cs.
  //   gifenc internally does `Math.round(delay_ms / 10)` → cs.
  // So passing `delayCs * 10` ms here yields the same per-frame
  // centisecond delay Rust writes (`gif::Frame.delay`).
  const delayCs = Math.round(100 / fps);

  let gif;
  try {
    gif = GIFEncoder();
  } catch (e) {
    throw MurError.gifEncode(`GIF init: ${e instanceof Error ? e.message : String(e)}`);
  }

  for (const frame of frames) {
    const rgba = frame.image.pixels;
    const { palette, indexed } = quantizeFrame(rgba);
    try {
      gif.writeFrame(indexed, width, height, {
        palette,
        // gifenc expects `delay` in milliseconds and divides by 10
        // internally to write centiseconds — `delayCs * 10` here
        // round-trips to the same `delayCs` Rust writes.
        delay: delayCs * 10,
        // `repeat: 0` → NETSCAPE2.0 loop-count = 0 = repeat forever
        // (mirrors Rust `encoder.set_repeat(gif::Repeat::Infinite)`).
        // gifenc only emits the NETSCAPE block on the first frame,
        // so the per-frame `repeat: 0` is harmless on subsequent
        // frames.
        repeat: 0,
      });
    } catch (e) {
      throw MurError.gifEncode(`GIF write frame: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  try {
    gif.finish();
  } catch (e) {
    throw MurError.gifEncode(`GIF finalize: ${e instanceof Error ? e.message : String(e)}`);
  }
  return gif.bytes();
}

/** Write frames as numbered PNG files (Node-only — uses fs). */
export async function writeFramePngs(frames: readonly QrFrame[], outputDir: string): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.mkdir(outputDir, { recursive: true });
  for (let i = 0; i < frames.length; i++) {
    const file = path.join(outputDir, `${String(i).padStart(4, "0")}.png`);
    const png = frames[i].image.toPng();
    await fs.writeFile(file, png);
  }
}

interface QuantizedFrame {
  palette: [number, number, number][];
  indexed: Uint8Array;
}

/**
 * Quantize an RGBA frame to a 256-color indexed palette.
 *
 * Uses a small unique-color palette when possible (≤256 colors), otherwise
 * falls back to gifenc's quantizer for many-color frames (e.g. with logos).
 */
function quantizeFrame(rgba: Uint8Array): QuantizedFrame {
  const uniqueKeys = new Set<number>();
  const uniqueColors: [number, number, number, number][] = [];
  let exceeded = false;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      uniqueColors.push([r, g, b, a]);
      if (uniqueColors.length > 256) {
        exceeded = true;
        break;
      }
    }
  }

  if (!exceeded) {
    const palette = uniqueColors.map((c) => [c[0], c[1], c[2]] as [number, number, number]);
    const lookup = new Map<number, number>();
    uniqueColors.forEach((c, i) => {
      const key = ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0;
      lookup.set(key, i);
    });
    const indexed = new Uint8Array(rgba.length / 4);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      const key = ((rgba[i] << 24) | (rgba[i + 1] << 16) | (rgba[i + 2] << 8) | rgba[i + 3]) >>> 0;
      indexed[j] = lookup.get(key) ?? 0;
    }
    return { palette, indexed };
  }

  // Many colors — quantize via gifenc.
  const palette = quantize(rgba, 256, { format: "rgb565" }) as [number, number, number][];
  const indexed = applyPalette(rgba, palette, "rgb565");
  return { palette, indexed };
}
