// Ported from bc-crypto-rust/src/hash.rs

import { sha256 as nobleSha256, sha512 as nobleSha512 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { hkdf } from "@noble/hashes/hkdf.js";

// Constants
export const CRC32_SIZE = 4;
export const SHA256_SIZE = 32;
export const SHA512_SIZE = 64;

// CRC-32 lookup table (IEEE polynomial 0xedb88320)
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  CRC32_TABLE[i] = crc >>> 0;
}

/**
 * Calculate CRC-32 checksum
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Calculate CRC-32 checksum and return as a 4-byte big-endian array
 */
export function crc32Data(data: Uint8Array): Uint8Array {
  return crc32DataOpt(data, false);
}

/**
 * Calculate CRC-32 checksum and return as a 4-byte array
 * @param data - Input data
 * @param littleEndian - If true, returns little-endian; otherwise big-endian
 */
export function crc32DataOpt(data: Uint8Array, littleEndian: boolean): Uint8Array {
  const checksum = crc32(data);
  const result = new Uint8Array(4);
  const view = new DataView(result.buffer);
  view.setUint32(0, checksum, littleEndian);
  return result;
}

/**
 * Calculate SHA-256 hash
 */
export function sha256(data: Uint8Array): Uint8Array {
  return nobleSha256(data);
}

/**
 * Calculate double SHA-256 hash (SHA-256 of SHA-256)
 * This is the standard Bitcoin hashing function
 */
export function doubleSha256(message: Uint8Array): Uint8Array {
  return sha256(sha256(message));
}

/**
 * Calculate SHA-512 hash
 */
export function sha512(data: Uint8Array): Uint8Array {
  return nobleSha512(data);
}

/**
 * Calculate HMAC-SHA-256
 */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  return hmac(nobleSha256, key, message);
}

/**
 * Calculate HMAC-SHA-512
 */
export function hmacSha512(key: Uint8Array, message: Uint8Array): Uint8Array {
  return hmac(nobleSha512, key, message);
}

/**
 * Derive a key using PBKDF2 with HMAC-SHA-256
 */
export function pbkdf2HmacSha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLen: number,
): Uint8Array {
  return pbkdf2(nobleSha256, password, salt, { c: iterations, dkLen: keyLen });
}

/**
 * Derive a key using PBKDF2 with HMAC-SHA-512
 */
export function pbkdf2HmacSha512(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLen: number,
): Uint8Array {
  return pbkdf2(nobleSha512, password, salt, { c: iterations, dkLen: keyLen });
}

/**
 * Derive a key using HKDF with HMAC-SHA-256
 */
export function hkdfHmacSha256(
  keyMaterial: Uint8Array,
  salt: Uint8Array,
  keyLen: number,
): Uint8Array {
  return hkdf(nobleSha256, keyMaterial, salt, undefined, keyLen);
}

/**
 * Derive a key using HKDF with HMAC-SHA-512
 */
export function hkdfHmacSha512(
  keyMaterial: Uint8Array,
  salt: Uint8Array,
  keyLen: number,
): Uint8Array {
  return hkdf(nobleSha512, keyMaterial, salt, undefined, keyLen);
}
