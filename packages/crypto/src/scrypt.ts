// Ported from bc-crypto-rust/src/scrypt.rs

import { scrypt as nobleScrypt } from "@noble/hashes/scrypt.js";

/**
 * Derive a key using Scrypt with recommended parameters.
 * Uses N=2^15 (32768), r=8, p=1 as recommended defaults.
 *
 * @param password - Password or passphrase
 * @param salt - Salt value
 * @param outputLen - Desired output length
 * @returns Derived key
 */
export function scrypt(password: Uint8Array, salt: Uint8Array, outputLen: number): Uint8Array {
  return scryptOpt(password, salt, outputLen, 15, 8, 1);
}

/**
 * Derive a key using Scrypt with custom parameters.
 *
 * @param password - Password or passphrase
 * @param salt - Salt value
 * @param outputLen - Desired output length
 * @param logN - Log2 of the CPU/memory cost parameter N (must be <64)
 * @param r - Block size parameter (must be >0)
 * @param p - Parallelization parameter (must be >0)
 * @returns Derived key
 */
export function scryptOpt(
  password: Uint8Array,
  salt: Uint8Array,
  outputLen: number,
  logN: number,
  r: number,
  p: number,
): Uint8Array {
  if (logN >= 64) {
    throw new Error("logN must be <64");
  }
  if (r === 0) {
    throw new Error("r must be >0");
  }
  if (p === 0) {
    throw new Error("p must be >0");
  }

  const N = 1 << logN; // 2^logN

  return nobleScrypt(password, salt, { N, r, p, dkLen: outputLen });
}
