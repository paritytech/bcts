/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * SSH-DSA digital signature algorithm (FIPS 186-4 §4) with RFC 6979
 * deterministic k generation.
 *
 * Mirrors the Rust `dsa` crate (RustCrypto, used by `ssh-key` 0.6.7) so
 * signatures are byte-identical given the same key + message + hash.
 *
 * Used only for SSH-DSA (`ssh-dss`):
 *   - q is 160 bits
 *   - hash is SHA-1 (also used as HMAC hash for RFC 6979)
 *   - signature is fixed 40 bytes: r (20) || s (20)
 *
 * Note: DSA with q=160 / SHA-1 is cryptographically deprecated. We
 * support it only for parity with Rust's `bc-components-rust` SSH
 * keygen path, which itself is feature-gated and primarily used in
 * legacy-interop tests. Do NOT use this module for new keys.
 */

import { sha1 } from "@noble/hashes/legacy.js";
import { hmac } from "@noble/hashes/hmac.js";

// ----------------------------------------------------------------------------
// Modular-arithmetic helpers (BigInt — not constant-time, matches Rust `dsa`)
// ----------------------------------------------------------------------------

function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = base % mod;
  if (b < 0n) b += mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

function modinv(a: bigint, m: bigint): bigint {
  // Extended Euclidean. Assumes gcd(a, m) = 1.
  let oldR = ((a % m) + m) % m;
  let r = m;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) {
    throw new Error("dsa: modular inverse does not exist");
  }
  return ((oldS % m) + m) % m;
}

function bytesToBigint(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

function bigintToBytesFixed(v: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let n = v;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  if (n !== 0n) {
    throw new Error(`dsa: integer does not fit in ${len} bytes`);
  }
  return out;
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrs) {
    out.set(a, pos);
    pos += a.length;
  }
  return out;
}

// ----------------------------------------------------------------------------
// RFC 6979 §3.2 — deterministic k generation
// ----------------------------------------------------------------------------

/**
 * `bits2int` per RFC 6979 §2.3.2: interpret the input bits as a big-endian
 * integer, truncating the rightmost bits if the bit length exceeds qlen.
 */
function bits2int(input: Uint8Array, qlenBits: number): bigint {
  let v = bytesToBigint(input);
  const inputBits = input.length * 8;
  if (inputBits > qlenBits) {
    v >>= BigInt(inputBits - qlenBits);
  }
  return v;
}

/**
 * `int2octets` per RFC 6979 §2.3.3: integer → fixed-length bytes (qlen/8).
 */
function int2octets(v: bigint, rolen: number): Uint8Array {
  return bigintToBytesFixed(v, rolen);
}

/**
 * `bits2octets` per RFC 6979 §2.3.4: bits2int reduced mod q, then int2octets.
 */
function bits2octets(input: Uint8Array, q: bigint, qlenBits: number, rolen: number): Uint8Array {
  const z1 = bits2int(input, qlenBits);
  let z2 = z1 - q;
  if (z2 < 0n) z2 = z1;
  return int2octets(z2 % q, rolen);
}

/**
 * Derive a deterministic per-signature nonce `k` per RFC 6979 §3.2 using
 * HMAC-SHA-1 (the hash paired with DSA-1024/q-160).
 */
function rfc6979Nonce(
  q: bigint,
  x: Uint8Array,
  hashedMessage: Uint8Array,
): bigint {
  const qlenBits = q.toString(2).length;
  const rolen = Math.ceil(qlenBits / 8);
  const hlen = 20; // SHA-1 output length

  const xOct = int2octets(bytesToBigint(x), rolen);
  const h1Oct = bits2octets(hashedMessage, q, qlenBits, rolen);

  // Step a-b: V = 0x01..., K = 0x00...
  let V = new Uint8Array(hlen).fill(0x01);
  let K = new Uint8Array(hlen).fill(0x00);

  // Step c: K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1))
  K = hmac(sha1, K, concatBytes(V, new Uint8Array([0x00]), xOct, h1Oct));
  // Step d: V = HMAC_K(V)
  V = hmac(sha1, K, V);
  // Step e: K = HMAC_K(V || 0x01 || int2octets(x) || bits2octets(h1))
  K = hmac(sha1, K, concatBytes(V, new Uint8Array([0x01]), xOct, h1Oct));
  // Step f: V = HMAC_K(V)
  V = hmac(sha1, K, V);

  // Step g: loop until a valid k is found
  for (let iter = 0; iter < 1024; iter++) {
    let T = new Uint8Array(0);
    while (T.length < rolen) {
      V = hmac(sha1, K, V);
      T = concatBytes(T, V);
    }
    const k = bits2int(T, qlenBits);
    if (k >= 1n && k < q) return k;
    K = hmac(sha1, K, concatBytes(V, new Uint8Array([0x00])));
    V = hmac(sha1, K, V);
  }
  throw new Error("dsa: RFC 6979 failed to produce a valid k after 1024 iterations");
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export interface DsaPublicParams {
  p: Uint8Array;
  q: Uint8Array;
  g: Uint8Array;
  y: Uint8Array;
}

export interface DsaSignParams extends DsaPublicParams {
  /** Private exponent (canonical positive bytes, no sign byte). */
  x: Uint8Array;
  /** Hash digest of the message (SHA-1 for SSH-DSA). */
  messageDigest: Uint8Array;
}

export interface DsaVerifyParams extends DsaPublicParams {
  messageDigest: Uint8Array;
  /** 40-byte signature (r || s), each 20 bytes for q=160. */
  signature: Uint8Array;
}

/**
 * Sign `messageDigest` with the DSA private key, returning a fixed-length
 * `r || s` signature. Uses RFC 6979 deterministic `k` so signatures match
 * Rust's `dsa` crate byte-for-byte.
 *
 * Output length is `2 * (qlen / 8)` = 40 bytes for SSH-DSA-1024.
 */
export function dsaSign(params: DsaSignParams): Uint8Array {
  const p = bytesToBigint(params.p);
  const q = bytesToBigint(params.q);
  const g = bytesToBigint(params.g);
  const x = bytesToBigint(params.x);
  const qlenBits = q.toString(2).length;
  const rolen = Math.ceil(qlenBits / 8);

  // Loop in case (r, s) hits the (rare) degenerate case where r=0 or s=0.
  // RFC 6979 §3.2 defines the next-k recovery as continuing the HMAC
  // chain — but for q=160 + SHA-1 the probability of this is ~2^-160, so
  // we treat it as fatal here (matching Rust `dsa` crate behaviour).
  const k = rfc6979Nonce(q, params.x, params.messageDigest);
  const r = modpow(g, k, p) % q;
  if (r === 0n) {
    throw new Error("dsa: degenerate signature with r=0");
  }
  const z = bits2int(params.messageDigest, qlenBits);
  const kInv = modinv(k, q);
  const s = (kInv * (z + x * r)) % q;
  if (s === 0n) {
    throw new Error("dsa: degenerate signature with s=0");
  }

  const out = new Uint8Array(rolen * 2);
  out.set(bigintToBytesFixed(r, rolen), 0);
  out.set(bigintToBytesFixed(s, rolen), rolen);
  return out;
}

/**
 * Verify a DSA `r || s` signature against the message digest and public key.
 * Returns `true` iff the signature is valid; never throws on bad input.
 */
export function dsaVerify(params: DsaVerifyParams): boolean {
  try {
    const p = bytesToBigint(params.p);
    const q = bytesToBigint(params.q);
    const g = bytesToBigint(params.g);
    const y = bytesToBigint(params.y);
    const qlenBits = q.toString(2).length;
    const rolen = Math.ceil(qlenBits / 8);
    if (params.signature.length !== rolen * 2) return false;
    const r = bytesToBigint(params.signature.subarray(0, rolen));
    const s = bytesToBigint(params.signature.subarray(rolen));
    if (r <= 0n || r >= q) return false;
    if (s <= 0n || s >= q) return false;
    const w = modinv(s, q);
    const z = bits2int(params.messageDigest, qlenBits);
    const u1 = (z * w) % q;
    const u2 = (r * w) % q;
    const v = ((modpow(g, u1, p) * modpow(y, u2, p)) % p) % q;
    return v === r;
  } catch {
    return false;
  }
}
