/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * SVG rendering helpers (web/Node compatible via resvg-wasm).
 */

import { initWasm, Resvg } from "@resvg/resvg-wasm";

import { MurError } from "./error.js";

let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module used for SVG rasterization.
 *
 * In Node.js, the WASM file is auto-resolved from this package's
 * dependency tree.
 *
 * In a browser, the caller must pass an `InitInput` (URL, Response,
 * BufferSource, WebAssembly.Module, or a Promise of one) before invoking
 * any SVG-rendering API.
 */
export function initSvgRenderer(wasm?: Parameters<typeof initWasm>[0]): Promise<void> {
  initPromise ??= (async () => {
    if (wasm) {
      await initWasm(wasm);
      return;
    }
    // Try to auto-load from Node.
    const wasmBytes = await loadWasmFromNode();
    await initWasm(wasmBytes);
  })().catch((e: unknown) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
}

async function loadWasmFromNode(): Promise<Uint8Array> {
  const isNode = typeof process !== "undefined" && process.versions?.node !== undefined;
  if (!isNode) {
    throw MurError.svgRender(
      "SVG renderer not initialized — call initSvgRenderer(wasmBytes) first",
    );
  }
  const fs = await import("node:fs/promises");
  const { createRequire } = await import("node:module");
  const requireFn = createRequire(import.meta.url);
  const path = requireFn.resolve("@resvg/resvg-wasm/index_bg.wasm");
  return new Uint8Array(await fs.readFile(path));
}

/**
 * Rasterize SVG data to a 512×512 straight-alpha RGBA buffer (centered,
 * preserving aspect ratio).
 *
 * Mirrors Rust `bc-mur::Logo::from_svg`
 * (`logo.rs:53-97`):
 *   let scale = (512/w).min(512/h);
 *   let tx = (512 - w * scale) / 2;
 *   let ty = (512 - h * scale) / 2;
 *   let transform = Transform::from_scale(scale, scale)
 *       .post_translate(tx, ty);
 *   resvg::render(&tree, transform, &mut pixmap)
 *
 * Rust uses tiny_skia which handles **float** sub-pixel positioning
 * via anti-aliased rasterization. resvg-wasm has no direct Transform
 * input, so we mirror the same effect by:
 *
 *  1. Rendering the SVG at the target `scale` via
 *     `fitTo: { mode: "zoom", value: scale }` to get an aspect-correct
 *     `w_r × h_r` buffer.
 *  2. Compositing it onto the 512×512 canvas with **sub-pixel-accurate
 *     bilinear sampling** at the float offset `(tx, ty)`.
 *
 * The earlier port placed the rendered buffer at integer-floored
 * offsets (`Math.floor((512 - w_r) / 2)`), which introduced a
 * 0–1-pixel hard shift relative to Rust's anti-aliased boundary
 * whenever `w * scale` (or `h * scale`) wasn't an integer. The
 * bilinear-blit below removes that shift — see M3 in
 * `PARITY_OUTSTANDING.md`.
 */
export async function rasterizeSvgTo512(svg: Uint8Array): Promise<Uint8Array> {
  await initSvgRenderer();
  const renderSize = 512;

  // Step 1 — probe the intrinsic SVG dimensions.
  let probe;
  try {
    probe = new Resvg(svg, {
      fitTo: { mode: "original" },
      background: "rgba(0, 0, 0, 0)",
    });
  } catch (e) {
    throw MurError.svgRender(`SVG parse: ${e instanceof Error ? e.message : String(e)}`);
  }
  const intrinsicW = probe.width;
  const intrinsicH = probe.height;
  probe.free();

  // Step 2 — compute Rust's scale + float offsets.
  const sx = renderSize / intrinsicW;
  const sy = renderSize / intrinsicH;
  const scale = Math.min(sx, sy);
  const tx = (renderSize - intrinsicW * scale) / 2;
  const ty = (renderSize - intrinsicH * scale) / 2;

  // Step 3 — render at the chosen zoom.
  let scaledResvg;
  try {
    scaledResvg = new Resvg(svg, {
      fitTo: { mode: "zoom", value: scale },
      background: "rgba(0, 0, 0, 0)",
    });
  } catch (e) {
    throw MurError.svgRender(`SVG parse: ${e instanceof Error ? e.message : String(e)}`);
  }
  const rendered = scaledResvg.render();
  const w = rendered.width;
  const h = rendered.height;
  const premulRgba = rendered.pixels.slice();
  rendered.free();
  scaledResvg.free();

  // Step 4 — demultiply alpha (resvg outputs premultiplied RGBA).
  const straight = demultiplyAlpha(premulRgba);

  // Step 5 — sub-pixel-accurate bilinear composite into 512×512.
  // For each output pixel `(X, Y)` we sample the source buffer at
  // `(X - tx, Y - ty)`, which is a float coordinate; bilinear sampling
  // gives Rust-equivalent anti-aliased boundaries when `tx`/`ty`
  // aren't integers.
  return compositeBilinearAtOffset(straight, w, h, tx, ty, renderSize);
}

/**
 * Composite a `srcW × srcH` straight-alpha RGBA buffer onto a fresh
 * `targetSize × targetSize` transparent canvas at float offset
 * `(tx, ty)`, sampling the source bilinearly.
 *
 * Mirrors the sub-pixel-accurate placement that Rust's tiny_skia gets
 * for free via `Transform::post_translate(tx, ty)`.
 */
function compositeBilinearAtOffset(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  tx: number,
  ty: number,
  targetSize: number,
): Uint8Array {
  const out = new Uint8Array(targetSize * targetSize * 4);

  for (let Y = 0; Y < targetSize; Y++) {
    const yf = Y - ty;
    if (yf <= -1 || yf >= srcH) continue;

    const y0 = Math.floor(yf);
    const yFrac = yf - y0;
    const y1 = y0 + 1;

    for (let X = 0; X < targetSize; X++) {
      const xf = X - tx;
      if (xf <= -1 || xf >= srcW) continue;

      const x0 = Math.floor(xf);
      const xFrac = xf - x0;
      const x1 = x0 + 1;

      // Bilinear weights for the 2×2 neighbourhood. Out-of-bounds
      // neighbours are treated as transparent (RGBA = 0,0,0,0).
      const w00 = (1 - xFrac) * (1 - yFrac);
      const w10 = xFrac * (1 - yFrac);
      const w01 = (1 - xFrac) * yFrac;
      const w11 = xFrac * yFrac;

      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      if (x0 >= 0 && x0 < srcW && y0 >= 0 && y0 < srcH) {
        const i = (y0 * srcW + x0) * 4;
        r += src[i] * w00;
        g += src[i + 1] * w00;
        b += src[i + 2] * w00;
        a += src[i + 3] * w00;
      }
      if (x1 >= 0 && x1 < srcW && y0 >= 0 && y0 < srcH) {
        const i = (y0 * srcW + x1) * 4;
        r += src[i] * w10;
        g += src[i + 1] * w10;
        b += src[i + 2] * w10;
        a += src[i + 3] * w10;
      }
      if (x0 >= 0 && x0 < srcW && y1 >= 0 && y1 < srcH) {
        const i = (y1 * srcW + x0) * 4;
        r += src[i] * w01;
        g += src[i + 1] * w01;
        b += src[i + 2] * w01;
        a += src[i + 3] * w01;
      }
      if (x1 >= 0 && x1 < srcW && y1 >= 0 && y1 < srcH) {
        const i = (y1 * srcW + x1) * 4;
        r += src[i] * w11;
        g += src[i + 1] * w11;
        b += src[i + 2] * w11;
        a += src[i + 3] * w11;
      }

      const o = (Y * targetSize + X) * 4;
      out[o] = Math.round(r) & 0xff;
      out[o + 1] = Math.round(g) & 0xff;
      out[o + 2] = Math.round(b) & 0xff;
      out[o + 3] = Math.round(a) & 0xff;
    }
  }

  return out;
}

/** Convert premultiplied RGBA to straight RGBA (mirror of rust `demultiply_alpha`). */
export function demultiplyAlpha(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    } else if (a === 255) {
      out[i] = data[i]!;
      out[i + 1] = data[i + 1]!;
      out[i + 2] = data[i + 2]!;
      out[i + 3] = 255;
    } else {
      out[i] = Math.floor((data[i] * 255 + Math.floor(a / 2)) / a) & 0xff;
      out[i + 1] = Math.floor((data[i + 1] * 255 + Math.floor(a / 2)) / a) & 0xff;
      out[i + 2] = Math.floor((data[i + 2] * 255 + Math.floor(a / 2)) / a) & 0xff;
      out[i + 3] = a;
    }
  }
  return out;
}
