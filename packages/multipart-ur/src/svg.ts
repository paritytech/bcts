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
export function initSvgRenderer(
  wasm?: Parameters<typeof initWasm>[0],
): Promise<void> {
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
  const isNode =
    typeof process !== "undefined" &&
    process.versions?.node !== undefined;
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
 */
export async function rasterizeSvgTo512(svg: Uint8Array): Promise<Uint8Array> {
  await initSvgRenderer();
  const renderSize = 512;

  // Use Resvg to read intrinsic size, then render at the right zoom and
  // center the output into a 512×512 transparent canvas.
  let resvg;
  try {
    resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: renderSize },
      background: "rgba(0, 0, 0, 0)",
    });
  } catch (e) {
    throw MurError.svgRender(
      `SVG parse: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Recompute fitTo using the smaller dimension to ensure aspect-preserving
  // fit within 512×512.
  const intrinsicW = resvg.width;
  const intrinsicH = resvg.height;
  resvg.free();

  const sx = renderSize / intrinsicW;
  const sy = renderSize / intrinsicH;
  const scale = Math.min(sx, sy);

  let scaledResvg;
  try {
    scaledResvg = new Resvg(svg, {
      fitTo: { mode: "zoom", value: scale },
      background: "rgba(0, 0, 0, 0)",
    });
  } catch (e) {
    throw MurError.svgRender(
      `SVG parse: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const rendered = scaledResvg.render();
  const w = rendered.width;
  const h = rendered.height;
  const premulRgba = rendered.pixels.slice();
  rendered.free();
  scaledResvg.free();

  // Demultiply alpha (resvg outputs premultiplied RGBA).
  const straight = demultiplyAlpha(premulRgba);

  // Center into 512×512 transparent buffer.
  const out = new Uint8Array(renderSize * renderSize * 4);
  const offsetX = Math.floor((renderSize - w) / 2);
  const offsetY = Math.floor((renderSize - h) / 2);
  for (let y = 0; y < h; y++) {
    const dstRow = (offsetY + y) * renderSize + offsetX;
    const srcRow = y * w;
    out.set(
      straight.subarray(srcRow * 4, (srcRow + w) * 4),
      dstRow * 4,
    );
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
