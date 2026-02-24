/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Hash type enum for key derivation functions
 *
 * This enum represents the supported hash algorithms for HKDF and PBKDF2.
 *
 * CDDL:
 * ```cddl
 * HashType = SHA256 / SHA512
 * SHA256 = 0
 * SHA512 = 1
 * ```
 *
 * Ported from bc-components-rust/src/encrypted_key/hash_type.rs
 */

import { type Cbor, cbor, expectNumber } from "@bcts/dcbor";

/**
 * Enum representing supported hash types for key derivation.
 */
export enum HashType {
  /** SHA-256 hash algorithm */
  SHA256 = 0,
  /** SHA-512 hash algorithm */
  SHA512 = 1,
}

/**
 * Convert HashType to its string representation.
 */
export function hashTypeToString(hashType: HashType): string {
  switch (hashType) {
    case HashType.SHA256:
      return "SHA256";
    case HashType.SHA512:
      return "SHA512";
    default:
      throw new Error(`Unknown HashType: ${String(hashType)}`);
  }
}

/**
 * Convert HashType to CBOR.
 */
export function hashTypeToCbor(hashType: HashType): Cbor {
  return cbor(hashType);
}

/**
 * Parse HashType from CBOR.
 */
export function hashTypeFromCbor(cborValue: Cbor): HashType {
  const value = expectNumber(cborValue);
  switch (value) {
    case 0:
      return HashType.SHA256;
    case 1:
      return HashType.SHA512;
    default:
      throw new Error(`Invalid HashType: ${value}`);
  }
}
