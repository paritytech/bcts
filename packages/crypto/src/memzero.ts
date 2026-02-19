/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-crypto-rust/src/memzero.rs

/**
 * Securely zero out a typed array.
 *
 * **IMPORTANT: This is a best-effort implementation.** Unlike the Rust reference
 * implementation which uses `std::ptr::write_volatile()` for guaranteed volatile
 * writes, JavaScript engines and JIT compilers can still potentially optimize
 * away these zeroing operations. The check at the end helps prevent optimization,
 * but it is not foolproof.
 *
 * For truly sensitive cryptographic operations, consider using the Web Crypto API's
 * `crypto.subtle` with non-extractable keys when possible, as it provides stronger
 * guarantees than what can be achieved with pure JavaScript.
 *
 * This function attempts to prevent the compiler from optimizing away
 * the zeroing operation by using a verification check after the zeroing loop.
 */
export function memzero(data: Uint8Array | Uint32Array): void {
  const len = data.length;
  for (let i = 0; i < len; i++) {
    data[i] = 0;
  }
  // Force a side effect to prevent optimization
  if (data.length > 0 && data[0] !== 0) {
    throw new Error("memzero failed");
  }
}

/**
 * Securely zero out an array of Uint8Arrays.
 */
export function memzeroVecVecU8(arrays: Uint8Array[]): void {
  for (const arr of arrays) {
    memzero(arr);
  }
}
