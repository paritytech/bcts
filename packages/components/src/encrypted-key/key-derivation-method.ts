/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Key derivation method enum
 *
 * This enum represents the supported key derivation methods for encrypting keys.
 *
 * CDDL:
 * ```cddl
 * KeyDerivationMethod = HKDF / PBKDF2 / Scrypt / Argon2id / SSHAgent
 * HKDF = 0
 * PBKDF2 = 1
 * Scrypt = 2
 * Argon2id = 3
 * SSHAgent = 4
 * ```
 *
 * Ported from bc-components-rust/src/encrypted_key/key_derivation_method.rs
 */

import { type Cbor, expectNumber } from "@bcts/dcbor";

/**
 * Enum representing supported key derivation methods.
 */
export enum KeyDerivationMethod {
  /** HKDF (HMAC-based Key Derivation Function) - RFC 5869 */
  HKDF = 0,
  /** PBKDF2 (Password-Based Key Derivation Function 2) - RFC 8018 */
  PBKDF2 = 1,
  /** Scrypt - RFC 7914 */
  Scrypt = 2,
  /** Argon2id - RFC 9106 (default, most secure for passwords) */
  Argon2id = 3,
  /** SSH Agent - Uses SSH agent for key derivation */
  SSHAgent = 4,
}

/**
 * Returns the default key derivation method (Argon2id).
 */
export function defaultKeyDerivationMethod(): KeyDerivationMethod {
  return KeyDerivationMethod.Argon2id;
}

/**
 * Returns the zero-based index of the key derivation method.
 */
export function keyDerivationMethodIndex(method: KeyDerivationMethod): number {
  return method;
}

/**
 * Attempts to create a KeyDerivationMethod from a zero-based index.
 */
export function keyDerivationMethodFromIndex(index: number): KeyDerivationMethod | undefined {
  switch (index) {
    case 0:
      return KeyDerivationMethod.HKDF;
    case 1:
      return KeyDerivationMethod.PBKDF2;
    case 2:
      return KeyDerivationMethod.Scrypt;
    case 3:
      return KeyDerivationMethod.Argon2id;
    case 4:
      return KeyDerivationMethod.SSHAgent;
    default:
      return undefined;
  }
}

/**
 * Convert KeyDerivationMethod to its string representation.
 */
export function keyDerivationMethodToString(method: KeyDerivationMethod): string {
  switch (method) {
    case KeyDerivationMethod.HKDF:
      return "HKDF";
    case KeyDerivationMethod.PBKDF2:
      return "PBKDF2";
    case KeyDerivationMethod.Scrypt:
      return "Scrypt";
    case KeyDerivationMethod.Argon2id:
      return "Argon2id";
    case KeyDerivationMethod.SSHAgent:
      return "SSHAgent";
    default:
      throw new Error(`Unknown KeyDerivationMethod: ${String(method)}`);
  }
}

/**
 * Parse KeyDerivationMethod from CBOR.
 */
export function keyDerivationMethodFromCbor(cborValue: Cbor): KeyDerivationMethod {
  const value = expectNumber(cborValue);
  const method = keyDerivationMethodFromIndex(Number(value));
  if (method === undefined) {
    throw new Error(`Invalid KeyDerivationMethod index: ${value}`);
  }
  return method;
}
