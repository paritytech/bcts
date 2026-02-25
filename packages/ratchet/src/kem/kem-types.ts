/**
 * KEM (Key Encapsulation Mechanism) types for PQXDH v4.
 *
 * Signal Protocol v4 uses Kyber/ML-KEM-1024 for post-quantum key exchange.
 * Type bytes match libsignal's `kem.rs` definitions.
 *
 * All KEM keys and ciphertexts are serialized with a 1-byte type prefix:
 *   [type_byte][raw_data]
 */

import { ml_kem768, ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { BadKEMKeyLengthError, BadKEMCiphertextLengthError } from "../error.js";

// ---------------------------------------------------------------------------
// KEM key size constants (from libsignal kem.rs Parameters trait)
// ---------------------------------------------------------------------------

/** 1-byte type prefix in serialized form */
export const KEM_TYPE_PREFIX_SIZE = 1;

// Kyber-768 sizes (ML-KEM-768)
export const KYBER768_PUBLIC_KEY_SIZE = 1184;
export const KYBER768_SECRET_KEY_SIZE = 2400;
export const KYBER768_CIPHERTEXT_SIZE = 1088;
export const KYBER768_SHARED_SECRET_SIZE = 32;

// Kyber-1024 / ML-KEM-1024 sizes
export const KYBER1024_PUBLIC_KEY_SIZE = 1568;
export const KYBER1024_SECRET_KEY_SIZE = 3168;
export const KYBER1024_CIPHERTEXT_SIZE = 1568;
export const KYBER1024_SHARED_SECRET_SIZE = 32;

/** KEM type identifiers from libsignal */
export enum KemType {
  /** CRYSTALS-Kyber-768 */
  Kyber768 = 0x07,
  /** CRYSTALS-Kyber-1024 (original NIST Round 3) */
  Kyber1024 = 0x08,
  /** ML-KEM-1024 (FIPS 203 standardized) */
  MLKEM1024 = 0x0a,
}

/** Default KEM type matching libsignal's current default */
export const DEFAULT_KEM_TYPE = KemType.Kyber1024;

export interface KemKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface KemEncapsulationResult {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
}

// ---------------------------------------------------------------------------
// Serialization helpers (type-byte prefix)
// ---------------------------------------------------------------------------

/**
 * Serialize a KEM public key with a 1-byte type prefix.
 */
export function kemSerializePublicKey(publicKey: Uint8Array, kemType: KemType): Uint8Array {
  const result = new Uint8Array(1 + publicKey.length);
  result[0] = kemType;
  result.set(publicKey, 1);
  return result;
}

/**
 * Deserialize a type-prefixed KEM public key.
 */
export function kemDeserializePublicKey(data: Uint8Array): {
  kemType: KemType;
  publicKey: Uint8Array;
} {
  if (data.length < 2) throw new Error("KEM public key too short");
  const kemType = data[0] as KemType;
  if (
    kemType !== KemType.Kyber768 &&
    kemType !== KemType.Kyber1024 &&
    kemType !== KemType.MLKEM1024
  ) {
    throw new Error(`Unknown KEM type: 0x${kemType.toString(16)}`);
  }
  return { kemType, publicKey: data.slice(1) };
}

/**
 * Serialize a KEM ciphertext with a 1-byte type prefix.
 */
export function kemSerializeCiphertext(ciphertext: Uint8Array, kemType: KemType): Uint8Array {
  const result = new Uint8Array(1 + ciphertext.length);
  result[0] = kemType;
  result.set(ciphertext, 1);
  return result;
}

/**
 * Deserialize a type-prefixed KEM ciphertext.
 */
export function kemDeserializeCiphertext(data: Uint8Array): {
  kemType: KemType;
  ciphertext: Uint8Array;
} {
  if (data.length < 2) throw new Error("KEM ciphertext too short");
  const kemType = data[0] as KemType;
  if (
    kemType !== KemType.Kyber768 &&
    kemType !== KemType.Kyber1024 &&
    kemType !== KemType.MLKEM1024
  ) {
    throw new Error(`Unknown KEM type: 0x${kemType.toString(16)}`);
  }
  return { kemType, ciphertext: data.slice(1) };
}

// ---------------------------------------------------------------------------
// Size look-ups per KEM type
// ---------------------------------------------------------------------------

function expectedPublicKeySize(kemType: KemType): number {
  return kemType === KemType.Kyber768 ? KYBER768_PUBLIC_KEY_SIZE : KYBER1024_PUBLIC_KEY_SIZE;
}

function expectedSecretKeySize(kemType: KemType): number {
  return kemType === KemType.Kyber768 ? KYBER768_SECRET_KEY_SIZE : KYBER1024_SECRET_KEY_SIZE;
}

function expectedCiphertextSize(kemType: KemType): number {
  return kemType === KemType.Kyber768 ? KYBER768_CIPHERTEXT_SIZE : KYBER1024_CIPHERTEXT_SIZE;
}

function kemTypeName(kemType: KemType): string {
  switch (kemType) {
    case KemType.Kyber768:
      return "Kyber768";
    case KemType.Kyber1024:
      return "Kyber1024";
    case KemType.MLKEM1024:
      return "MLKEM1024";
  }
}

// ---------------------------------------------------------------------------
// Core KEM operations (ML-KEM-1024 backing for both Kyber1024 and MLKEM1024)
// ---------------------------------------------------------------------------

/**
 * Generate a KEM key pair.
 * Kyber768 uses ML-KEM-768; Kyber1024 and MLKEM1024 use ML-KEM-1024.
 */
export function kemGenerateKeyPair(kemType: KemType = DEFAULT_KEM_TYPE): KemKeyPair {
  const name = kemTypeName(kemType);
  if (kemType === KemType.Kyber768) {
    const { publicKey, secretKey } = ml_kem768.keygen();
    if (publicKey.length !== KYBER768_PUBLIC_KEY_SIZE) {
      throw new BadKEMKeyLengthError(name, publicKey.length);
    }
    if (secretKey.length !== KYBER768_SECRET_KEY_SIZE) {
      throw new BadKEMKeyLengthError(name, secretKey.length);
    }
    return { publicKey, secretKey };
  }
  const { publicKey, secretKey } = ml_kem1024.keygen();
  if (publicKey.length !== KYBER1024_PUBLIC_KEY_SIZE) {
    throw new BadKEMKeyLengthError(name, publicKey.length);
  }
  if (secretKey.length !== KYBER1024_SECRET_KEY_SIZE) {
    throw new BadKEMKeyLengthError(name, secretKey.length);
  }
  return { publicKey, secretKey };
}

/**
 * Encapsulate a shared secret using a raw (unprefixed) KEM public key.
 */
export function kemEncapsulate(
  publicKey: Uint8Array,
  kemType: KemType = DEFAULT_KEM_TYPE,
): KemEncapsulationResult {
  const name = kemTypeName(kemType);
  const expectedPk = expectedPublicKeySize(kemType);
  if (publicKey.length !== expectedPk) {
    throw new BadKEMKeyLengthError(name, publicKey.length);
  }
  if (kemType === KemType.Kyber768) {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
    return { ciphertext: cipherText, sharedSecret };
  }
  const { cipherText, sharedSecret } = ml_kem1024.encapsulate(publicKey);
  return { ciphertext: cipherText, sharedSecret };
}

/**
 * Decapsulate a shared secret using a raw (unprefixed) ciphertext and KEM secret key.
 */
export function kemDecapsulate(
  ciphertext: Uint8Array,
  secretKey: Uint8Array,
  kemType: KemType = DEFAULT_KEM_TYPE,
): Uint8Array {
  const name = kemTypeName(kemType);
  const expectedSk = expectedSecretKeySize(kemType);
  if (secretKey.length !== expectedSk) {
    throw new BadKEMKeyLengthError(name, secretKey.length);
  }
  const expectedCt = expectedCiphertextSize(kemType);
  if (ciphertext.length !== expectedCt) {
    throw new BadKEMCiphertextLengthError(name, ciphertext.length);
  }
  if (kemType === KemType.Kyber768) {
    return ml_kem768.decapsulate(ciphertext, secretKey);
  }
  return ml_kem1024.decapsulate(ciphertext, secretKey);
}
