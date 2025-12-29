// Ported from bc-crypto-rust/src/argon.rs

import { argon2id } from "@noble/hashes/argon2.js";

/**
 * Derive a key using Argon2id with default parameters.
 *
 * @param password - Password or passphrase
 * @param salt - Salt value (must be at least 8 bytes)
 * @param outputLen - Desired output length
 * @returns Derived key
 */
export function argon2idHash(
  password: Uint8Array,
  salt: Uint8Array,
  outputLen: number,
): Uint8Array {
  // Use default parameters similar to the Rust implementation
  return argon2idHashOpt(password, salt, outputLen, 3, 65536, 4);
}

/**
 * Derive a key using Argon2id with custom parameters.
 *
 * @param password - Password or passphrase
 * @param salt - Salt value (must be at least 8 bytes)
 * @param outputLen - Desired output length
 * @param iterations - Number of iterations (t)
 * @param memory - Memory in KiB (m)
 * @param parallelism - Degree of parallelism (p)
 * @returns Derived key
 */
export function argon2idHashOpt(
  password: Uint8Array,
  salt: Uint8Array,
  outputLen: number,
  iterations: number,
  memory: number,
  parallelism: number,
): Uint8Array {
  return argon2id(password, salt, {
    t: iterations,
    m: memory,
    p: parallelism,
    dkLen: outputLen,
  });
}
