/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Low-level utility functions for SPQR.
 */

/**
 * Constant-time comparison of two byte arrays.
 * Returns true if they are equal, false otherwise.
 *
 * Uses a XOR accumulator to avoid early-exit timing leaks.
 *
 * Limitation: Unlike Rust (#[inline(never)] + black_box), JavaScript
 * cannot fully prevent JIT optimizations. In Node.js environments,
 * callers requiring stronger guarantees should use
 * crypto.timingSafeEqual directly.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/** Convert a bigint to 8-byte big-endian Uint8Array */
export function bigintToBE8(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, value, false);
  return buf;
}

/** Convert an 8-byte big-endian Uint8Array to bigint */
export function be8ToBigint(buf: Uint8Array): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, 8);
  return view.getBigUint64(0, false);
}

/** Convert a number to 4-byte big-endian Uint8Array */
export function uint32ToBE4(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint32(0, value, false);
  return buf;
}

/** Concatenate multiple Uint8Arrays */
export function concat(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}
