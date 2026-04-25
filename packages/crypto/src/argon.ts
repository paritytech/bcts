/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-crypto-rust/src/argon.rs

import { argon2id as nobleArgon2id } from "@noble/hashes/argon2.js";

/**
 * Derive a key using Argon2id with default parameters.
 *
 * Mirrors Rust `bc_crypto::argon2id` which calls `Argon2::default()`. The
 * upstream `argon2` crate's defaults are `t = 2` iterations, `m = 19 * 1024
 * = 19456` KiB of memory, `p = 1` lane (per `argon2-0.5.x/src/params.rs`).
 *
 * @param password - Password or passphrase
 * @param salt - Salt value (must be at least 8 bytes)
 * @param outputLen - Desired output length
 * @returns Derived key
 */
export function argon2id(password: Uint8Array, salt: Uint8Array, outputLen: number): Uint8Array {
  return argon2idHashOpt(password, salt, outputLen, 2, 19456, 1);
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
  return nobleArgon2id(password, salt, {
    t: iterations,
    m: memory,
    p: parallelism,
    dkLen: outputLen,
  });
}
