/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-rand-rust/src/secure_random.rs

import type { RandomNumberGenerator } from "./random-number-generator.js";

/**
 * Detects the crypto API available in the current environment.
 * Works in both Node.js and browser environments.
 */
function getCrypto(): Crypto {
  // Browser environment
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto !== null &&
    globalThis.crypto !== undefined
  ) {
    return globalThis.crypto;
  }
  // Node.js environment - globalThis.crypto is also available in Node.js >= 15
  if (typeof globalThis.crypto !== "undefined") {
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
  crypto.getRandomValues(data);
}

/**
 * Returns the next cryptographically strong random 64-bit unsigned integer.
 */
export function nextU64(): bigint {
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
   */
  nextU32(): number {
    const data = new Uint8Array(4);
    fillRandomData(data);
    const view = new DataView(data.buffer);
    return view.getUint32(0, true) >>> 0; // little-endian, unsigned
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
