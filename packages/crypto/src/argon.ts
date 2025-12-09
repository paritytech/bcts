// Ported from bc-crypto-rust/src/argon.rs

import { argon2id } from "@noble/hashes/argon2";

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
  return argon2id(password, salt, {
    t: 3, // iterations
    m: 65536, // memory in KiB (64 MiB)
    p: 4, // parallelism
    dkLen: outputLen,
  });
}
