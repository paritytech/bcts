/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-rand-rust/src/secure_random.rs

import type { RandomNumberGenerator } from "./random-number-generator.js";

/**
 * Returns the Web Crypto API for the current environment. Available natively
 * in browsers and in Node.js >= 15 via `globalThis.crypto`.
 */
function getCrypto(): Crypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto != null) {
    return globalThis.crypto;
  }
  throw new Error("No crypto API available in this environment");
}

/**
 * Generate a Uint8Array of cryptographically strong random bytes of the given size.
 */
export function randomData(size: number): Uint8Array {
  const data = new Uint8Array(size);
  fillRandomData(data);
  return data;
}

/**
 * Fill the given Uint8Array with cryptographically strong random bytes.
 */
export function fillRandomData(data: Uint8Array): void {
  const crypto = getCrypto();
  crypto.getRandomValues(data as Uint8Array<ArrayBuffer>);
}

/**
 * Returns the next cryptographically strong random 64-bit unsigned integer.
 *
 * This mirrors Rust's module-private `secure_random::next_u64()` and is not
 * re-exported from the package surface (matches Rust `lib.rs` behavior).
 */
function nextU64(): bigint {
  const data = new Uint8Array(8);
  fillRandomData(data);
  const view = new DataView(data.buffer);
  return view.getBigUint64(0, true); // little-endian
}

/**
 * A random number generator that can be used as a source of
 * cryptographically-strong randomness.
 *
 * Uses the Web Crypto API (crypto.getRandomValues) which is available
 * in both browsers and Node.js >= 15.
 */
export class SecureRandomNumberGenerator implements RandomNumberGenerator {
  /**
   * Returns the next random 32-bit unsigned integer.
   *
   * Mirrors Rust's `next_u32` impl which returns `next_u64() as u32` —
   * the low 32 bits of a 64-bit draw.
   */
  nextU32(): number {
    return Number(this.nextU64() & 0xffffffffn) >>> 0;
  }

  /**
   * Returns the next random 64-bit unsigned integer as a bigint.
   */
  nextU64(): bigint {
    return nextU64();
  }

  /**
   * Fills the given Uint8Array with random bytes.
   */
  fillBytes(dest: Uint8Array): void {
    fillRandomData(dest);
  }

  /**
   * Returns a Uint8Array of random bytes of the given size.
   */
  randomData(size: number): Uint8Array {
    return randomData(size);
  }

  /**
   * Fills the given Uint8Array with random bytes.
   */
  fillRandomData(data: Uint8Array): void {
    fillRandomData(data);
  }
}

/**
 * Returns a thread-local cryptographically-strong RNG. Mirrors Rust's
 * `thread_rng()`. In TypeScript there are no thread-locals, so this returns
 * a fresh `SecureRandomNumberGenerator` — every instance backs onto the
 * same Web Crypto source, so the effect is equivalent.
 */
export function threadRng(): SecureRandomNumberGenerator {
  return new SecureRandomNumberGenerator();
}
