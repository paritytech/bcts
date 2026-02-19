/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Random number generation utilities
 * Ported from seedtool-cli-rust/src/random.rs
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";

/** SHA256 output size in bytes */
const SHA256_SIZE = 32;

/**
 * Deterministic random number generator.
 * Matches Rust DeterministicRandomNumberGenerator struct.
 *
 * Uses HKDF-HMAC-SHA256 to generate deterministic random data
 * from a seed, with an incrementing salt for each call.
 */
export class DeterministicRandomNumberGenerator {
  private readonly seed: Uint8Array;
  private salt: bigint;

  /**
   * Create a new deterministic RNG from a 32-byte seed.
   */
  constructor(seed: Uint8Array) {
    if (seed.length !== SHA256_SIZE) {
      throw new Error(`Seed must be ${SHA256_SIZE} bytes, got ${seed.length}`);
    }
    this.seed = new Uint8Array(seed);
    this.salt = 0n;
  }

  /**
   * Create a new deterministic RNG from a seed string.
   * The string is hashed with SHA256 to produce the seed.
   * Matches Rust new_with_seed function.
   */
  static newWithSeed(seedString: string): DeterministicRandomNumberGenerator {
    const encoder = new TextEncoder();
    const seed = sha256(encoder.encode(seedString));
    return new DeterministicRandomNumberGenerator(seed);
  }

  /**
   * Generate deterministic random data.
   * Matches Rust deterministic_random_data method.
   *
   * Each call increments the salt and uses HKDF to derive
   * the requested number of bytes.
   */
  deterministicRandomData(size: number): Uint8Array {
    this.salt += 1n;

    // Convert salt to little-endian bytes
    const saltBytes = new Uint8Array(8);
    const view = new DataView(saltBytes.buffer);
    // Split into low and high 32-bit parts for BigInt handling
    const low = Number(this.salt & 0xffffffffn);
    const high = Number((this.salt >> 32n) & 0xffffffffn);
    view.setUint32(0, low, true); // little-endian
    view.setUint32(4, high, true);

    return hkdfHmacSha256(this.seed, saltBytes, size);
  }

  /**
   * Clone the RNG state.
   */
  clone(): DeterministicRandomNumberGenerator {
    const rng = new DeterministicRandomNumberGenerator(this.seed);
    rng.salt = this.salt;
    return rng;
  }
}

/**
 * HKDF-HMAC-SHA256 key derivation.
 * Matches Rust hkdf_hmac_sha256 function from bc-crypto.
 */
export function hkdfHmacSha256(ikm: Uint8Array, salt: Uint8Array, length: number): Uint8Array {
  // @noble/hashes hkdf takes (hash, ikm, salt, info, length)
  // Use empty info for our use case
  return hkdf(sha256, ikm, salt, new Uint8Array(0), length);
}

/**
 * Generate deterministic random data from entropy using SHA256.
 * If n <= 32, returns the first n bytes of SHA256(entropy).
 * Matches Rust sha256_deterministic_random function.
 *
 * @param entropy - The entropy bytes to hash
 * @param n - Number of bytes to return (must be <= 32)
 * @throws Error if n > 32
 */
export function sha256DeterministicRandom(entropy: Uint8Array, n: number): Uint8Array {
  const seed = sha256(entropy);
  if (n <= seed.length) {
    return seed.slice(0, n);
  } else {
    throw new Error("Random number generator limits reached.");
  }
}

/**
 * Generate deterministic random data from a string using SHA256.
 * Matches Rust sha256_deterministic_random_string function.
 *
 * @param str - The string to hash
 * @param n - Number of bytes to return (must be <= 32)
 * @throws Error if n > 32
 */
export function sha256DeterministicRandomString(str: string, n: number): Uint8Array {
  const encoder = new TextEncoder();
  const entropy = encoder.encode(str);
  return sha256DeterministicRandom(entropy, n);
}

/**
 * Generate deterministic random data from entropy using HKDF.
 * This can generate any length output.
 * Matches Rust deterministic_random function.
 *
 * @param entropy - The entropy bytes
 * @param n - Number of bytes to return
 */
export function deterministicRandom(entropy: Uint8Array, n: number): Uint8Array {
  const seed = sha256(entropy);
  return hkdfHmacSha256(seed, new Uint8Array(0), n);
}
