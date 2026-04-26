/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-crypto-rust/src/memzero.rs

/**
 * Any of the integer-/float-valued typed arrays that JavaScript exposes.
 * Maps to Rust's `&mut [T]` parameter on `bc_crypto::memzero<T>`.
 */
export type NumericTypedArray =
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;

/**
 * Securely zero out a typed array.
 *
 * Mirrors Rust `bc_crypto::memzero<T>(s: &mut [T])`. The Rust impl uses
 * `std::ptr::write_volatile()` to guarantee the writes survive optimization;
 * JavaScript has no equivalent primitive, so this is **best-effort** — JIT
 * compilers may still elide the loop, though the post-hoc verification
 * check forces the engine to keep the writes observable.
 *
 * For truly sensitive cryptographic operations, consider using the Web
 * Crypto API's `crypto.subtle` with non-extractable keys when possible, as
 * it provides stronger guarantees than what can be achieved with pure
 * JavaScript.
 *
 * Accepts any of the standard numeric typed arrays — `Uint8Array`,
 * `Uint8ClampedArray`, `Uint16Array`, `Uint32Array`, `Int8Array`,
 * `Int16Array`, `Int32Array`, `Float32Array`, `Float64Array` — matching
 * Rust's generic `&mut [T]`. (`BigInt64Array` / `BigUint64Array` are
 * excluded because their elements are `bigint`, not `number`; if that
 * support is needed, add a dedicated overload.)
 */
export function memzero(data: NumericTypedArray): void {
  const len = data.length;
  for (let i = 0; i < len; i++) {
    data[i] = 0;
  }
  // Force a side effect to prevent optimization.
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
