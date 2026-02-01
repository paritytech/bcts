/**
 * CBOR bignum (tags 2 and 3) support.
 *
 * This module provides conversion between CBOR and JavaScript BigInt types,
 * implementing RFC 8949 §3.4.3 (Bignums) with dCBOR/CDE canonical encoding rules.
 *
 * Encoding:
 * - `biguintToCbor` always encodes as tag 2 (positive bignum) with a byte
 *   string content.
 * - `bigintToCbor` encodes as tag 2 for non-negative values or tag 3
 *   (negative bignum) for negative values.
 * - No numeric reduction is performed: values are always encoded as bignums,
 *   even if they would fit in normal CBOR integers.
 *
 * Decoding:
 * - Accepts CBOR integers (major types 0 and 1) and converts them to bigints.
 * - Accepts tag 2 (positive bignum) and tag 3 (negative bignum) with byte
 *   string content.
 * - Enforces shortest-form canonical representation for bignum magnitudes.
 * - Rejects floating-point values.
 *
 * @module bignum
 */

import { type Cbor, MajorType, toTaggedValue } from "./cbor";
import { CborError } from "./error";

// CBOR tag values (local constants matching tags.ts, avoiding circular import)
const TAG_2_POSITIVE_BIGNUM = 2;
const TAG_3_NEGATIVE_BIGNUM = 3;

/**
 * Validates that a bignum magnitude byte string is in shortest canonical form.
 *
 * Matches Rust's `validate_bignum_magnitude()`.
 *
 * Rules:
 * - For positive bignums (tag 2): empty byte string represents zero;
 *   non-empty must not have leading zero bytes.
 * - For negative bignums (tag 3): byte string must not be empty
 *   (magnitude zero is encoded as `0x00`); must not have leading zero bytes
 *   except when the magnitude is zero (single `0x00`).
 *
 * @param bytes - The magnitude byte string to validate
 * @param isNegative - Whether this is for a negative bignum (tag 3)
 * @throws CborError with type NonCanonicalNumeric on validation failure
 */
export function validateBignumMagnitude(bytes: Uint8Array, isNegative: boolean): void {
  if (isNegative) {
    // Tag 3: byte string must not be empty
    if (bytes.length === 0) {
      throw new CborError({ type: "NonCanonicalNumeric" });
    }
    // No leading zeros unless the entire magnitude is zero (single 0x00 byte)
    if (bytes.length > 1 && bytes[0] === 0) {
      throw new CborError({ type: "NonCanonicalNumeric" });
    }
  } else {
    // Tag 2: empty byte string is valid (represents zero)
    // Non-empty must not have leading zeros
    if (bytes.length > 0 && bytes[0] === 0) {
      throw new CborError({ type: "NonCanonicalNumeric" });
    }
  }
}

/**
 * Strips leading zero bytes from a byte array, returning the minimal
 * representation.
 *
 * Matches Rust's `strip_leading_zeros()`.
 *
 * @param bytes - The byte array to strip
 * @returns A subarray with leading zeros removed
 */
export function stripLeadingZeros(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length && bytes[start] === 0) {
    start++;
  }
  return bytes.subarray(start);
}

/**
 * Convert a non-negative bigint to a big-endian byte array.
 *
 * Zero returns an empty Uint8Array.
 *
 * @param value - A non-negative bigint value
 * @returns Big-endian byte representation
 */
export function bigintToBytes(value: bigint): Uint8Array {
  if (value === 0n) return new Uint8Array(0);
  const hex = value.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert a big-endian byte array to a bigint.
 *
 * Empty array returns 0n.
 *
 * @param bytes - Big-endian byte representation
 * @returns The bigint value
 */
export function bytesToBigint(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n;
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/**
 * Encode a non-negative bigint as a CBOR tag 2 (positive bignum).
 *
 * Matches Rust's `From<BigUint> for CBOR`.
 *
 * The value is always encoded as a bignum regardless of size.
 * Zero is encoded as tag 2 with an empty byte string.
 *
 * @param value - A non-negative bigint (must be >= 0n)
 * @returns CBOR tagged value
 * @throws CborError with type OutOfRange if value is negative
 */
export function biguintToCbor(value: bigint): Cbor {
  if (value < 0n) {
    throw new CborError({ type: "OutOfRange" });
  }
  const bytes = bigintToBytes(value);
  const stripped = stripLeadingZeros(bytes);
  return toTaggedValue(TAG_2_POSITIVE_BIGNUM, stripped);
}

/**
 * Encode a bigint as a CBOR tag 2 or tag 3 bignum.
 *
 * Matches Rust's `From<BigInt> for CBOR`.
 *
 * - Non-negative values use tag 2 (positive bignum).
 * - Negative values use tag 3 (negative bignum), where the encoded
 *   magnitude is `|value| - 1` per RFC 8949.
 *
 * @param value - Any bigint value
 * @returns CBOR tagged value
 */
export function bigintToCbor(value: bigint): Cbor {
  if (value >= 0n) {
    return biguintToCbor(value);
  }
  // Negative: use tag 3 with magnitude = |value| - 1
  // For value = -1, magnitude = 1, so n = 0 -> encode as 0x00
  // For value = -2, magnitude = 2, so n = 1 -> encode as 0x01
  const magnitude = -value;
  const n = magnitude - 1n;
  const bytes = bigintToBytes(n);
  const stripped = stripLeadingZeros(bytes);
  // For n = 0 (value = -1), bigintToBytes returns empty, but we need 0x00
  const contentBytes = stripped.length === 0 ? new Uint8Array([0]) : stripped;
  return toTaggedValue(TAG_3_NEGATIVE_BIGNUM, contentBytes);
}

/**
 * Decode a BigUint from an untagged CBOR byte string.
 *
 * Matches Rust's `biguint_from_untagged_cbor()`.
 *
 * This function is intended for use in tag summarizers where the tag has
 * already been stripped. It expects a CBOR byte string representing the
 * big-endian magnitude of a positive bignum (tag 2 content).
 *
 * Enforces canonical encoding: no leading zero bytes (except empty for zero).
 *
 * @param cbor - A CBOR value that should be a byte string
 * @returns Non-negative bigint
 * @throws CborError with type WrongType if not a byte string
 * @throws CborError with type NonCanonicalNumeric if encoding is non-canonical
 */
export function biguintFromUntaggedCbor(cbor: Cbor): bigint {
  if (cbor.type !== MajorType.ByteString) {
    throw new CborError({ type: "WrongType" });
  }
  const bytes = cbor.value as Uint8Array;
  validateBignumMagnitude(bytes, false);
  return bytesToBigint(bytes);
}

/**
 * Decode a BigInt from an untagged CBOR byte string for a negative bignum.
 *
 * Matches Rust's `bigint_from_negative_untagged_cbor()`.
 *
 * This function is intended for use in tag summarizers where the tag has
 * already been stripped. It expects a CBOR byte string representing `n` where
 * the actual value is `-1 - n` (tag 3 content per RFC 8949).
 *
 * Enforces canonical encoding: no leading zero bytes (except single `0x00`
 * for -1).
 *
 * @param cbor - A CBOR value that should be a byte string
 * @returns Negative bigint
 * @throws CborError with type WrongType if not a byte string
 * @throws CborError with type NonCanonicalNumeric if encoding is non-canonical
 */
export function bigintFromNegativeUntaggedCbor(cbor: Cbor): bigint {
  if (cbor.type !== MajorType.ByteString) {
    throw new CborError({ type: "WrongType" });
  }
  const bytes = cbor.value as Uint8Array;
  validateBignumMagnitude(bytes, true);
  const n = bytesToBigint(bytes);
  const magnitude = n + 1n;
  return -magnitude;
}

/**
 * Convert CBOR to a non-negative bigint.
 *
 * Matches Rust's `TryFrom<CBOR> for BigUint`.
 *
 * Accepts:
 * - Major type 0 (unsigned integer)
 * - Tag 2 (positive bignum) with canonical byte string
 *
 * Rejects:
 * - Major type 1 (negative integer) -> OutOfRange
 * - Tag 3 (negative bignum) -> OutOfRange
 * - Floating-point values -> WrongType
 * - Non-canonical bignum encodings -> NonCanonicalNumeric
 *
 * @param cbor - The CBOR value to convert
 * @returns Non-negative bigint
 * @throws CborError
 */
export function cborToBiguint(cbor: Cbor): bigint {
  switch (cbor.type) {
    case MajorType.Unsigned:
      return BigInt(cbor.value);
    case MajorType.Negative:
      throw new CborError({ type: "OutOfRange" });
    case MajorType.Tagged: {
      const tagValue = Number(cbor.tag);
      if (tagValue === TAG_2_POSITIVE_BIGNUM) {
        const inner = cbor.value;
        if (inner.type !== MajorType.ByteString) {
          throw new CborError({ type: "WrongType" });
        }
        const bytes = inner.value as Uint8Array;
        validateBignumMagnitude(bytes, false);
        return bytesToBigint(bytes);
      } else if (tagValue === TAG_3_NEGATIVE_BIGNUM) {
        throw new CborError({ type: "OutOfRange" });
      }
      throw new CborError({ type: "WrongType" });
    }
    case MajorType.Simple:
      // Covers floats (Simple::Float) - reject them
      throw new CborError({ type: "WrongType" });
    default:
      throw new CborError({ type: "WrongType" });
  }
}

/**
 * Convert CBOR to a bigint (any sign).
 *
 * Matches Rust's `TryFrom<CBOR> for BigInt`.
 *
 * Accepts:
 * - Major type 0 (unsigned integer)
 * - Major type 1 (negative integer)
 * - Tag 2 (positive bignum) with canonical byte string
 * - Tag 3 (negative bignum) with canonical byte string
 *
 * Rejects:
 * - Floating-point values -> WrongType
 * - Non-canonical bignum encodings -> NonCanonicalNumeric
 *
 * @param cbor - The CBOR value to convert
 * @returns A bigint value
 * @throws CborError
 */
export function cborToBigint(cbor: Cbor): bigint {
  switch (cbor.type) {
    case MajorType.Unsigned:
      return BigInt(cbor.value);
    case MajorType.Negative: {
      // CBOR negative: value stored is n where actual = -1 - n
      const n = BigInt(cbor.value);
      const magnitude = n + 1n;
      return -magnitude;
    }
    case MajorType.Tagged: {
      const tagValue = Number(cbor.tag);
      if (tagValue === TAG_2_POSITIVE_BIGNUM) {
        const inner = cbor.value;
        if (inner.type !== MajorType.ByteString) {
          throw new CborError({ type: "WrongType" });
        }
        const bytes = inner.value as Uint8Array;
        validateBignumMagnitude(bytes, false);
        const mag = bytesToBigint(bytes);
        if (mag === 0n) {
          return 0n;
        }
        return mag;
      } else if (tagValue === TAG_3_NEGATIVE_BIGNUM) {
        const inner = cbor.value;
        if (inner.type !== MajorType.ByteString) {
          throw new CborError({ type: "WrongType" });
        }
        const bytes = inner.value as Uint8Array;
        validateBignumMagnitude(bytes, true);
        const n = bytesToBigint(bytes);
        const magnitude = n + 1n;
        return -magnitude;
      }
      throw new CborError({ type: "WrongType" });
    }
    case MajorType.Simple:
      // Covers floats (Simple::Float) - reject them
      throw new CborError({ type: "WrongType" });
    default:
      throw new CborError({ type: "WrongType" });
  }
}
