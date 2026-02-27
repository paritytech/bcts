/**
 * Protocol constants for the triple ratchet (PQXDH + SPQR).
 *
 * Version 4 of the Signal Protocol: X25519 + ML-KEM (Kyber) hybrid.
 */

// Re-export double-ratchet constants that remain unchanged
export {
  MAX_FORWARD_JUMPS,
  MAX_MESSAGE_KEYS,
  MAX_RECEIVER_CHAINS,
  ARCHIVED_STATES_MAX_LENGTH,
  MAX_UNACKNOWLEDGED_SESSION_AGE_MS,
  MAC_LENGTH,
  KEY_TYPE_DJB,
} from "@bcts/double-ratchet";

/** Wire protocol version 4 (PQXDH + SPQR triple ratchet). */
export const CIPHERTEXT_MESSAGE_CURRENT_VERSION = 4;

/** Previous wire protocol version 3 (X3DH-only, no longer accepted for new sessions). */
export const CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION = 3;

/**
 * HKDF info label for PQXDH key derivation.
 *
 * Used in session initialization to derive root key, chain key, and PQR auth key.
 * Produces 96 bytes: rootKey[0:32] + chainKey[32:64] + pqrAuthKey[64:96].
 *
 * Must match: libsignal/rust/protocol/src/ratchet.rs `derive_keys`
 */
export const KDF_LABEL_PQXDH = "WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024";

/**
 * HKDF info label for message key derivation.
 *
 * Same as double-ratchet, but in the triple ratchet the PQ key is used as the
 * HKDF salt (instead of undefined).
 *
 * Must match: libsignal/rust/protocol/src/ratchet/keys.rs `MessageKeys::derive_keys`
 */
export const KDF_LABEL_MESSAGE_KEYS = "WhisperMessageKeys";

/** 32 bytes of 0xFF used as discontinuity bytes in X3DH/PQXDH secret input. */
export const DISCONTINUITY_BYTES = new Uint8Array(32).fill(0xff);

/**
 * 30 days in seconds — matches Rust `MAX_UNACKNOWLEDGED_SESSION_AGE`.
 *
 * Used for pending prekey staleness checks. Rust stores PendingPreKey
 * timestamps as seconds since epoch; we convert `Date.now()` (ms) to
 * seconds at the storage boundary so the serialized value matches Rust.
 */
export const MAX_UNACKNOWLEDGED_SESSION_AGE_SECS = 30 * 24 * 60 * 60;

/** Type byte prefix for Kyber public keys (matches Rust kem::KeyType::Kyber1024). */
export const KYBER_KEY_TYPE_BYTE = 0x08;

/** Raw ML-KEM-1024 public key / ciphertext length (bytes). */
export const KYBER1024_RAW_LENGTH = 1568;

/** Prefixed ML-KEM-1024 public key / ciphertext length (1 type byte + raw bytes). */
export const KYBER1024_PREFIXED_LENGTH = 1569;

/**
 * Strip the 0x08 KEM type prefix if present, returning raw bytes
 * suitable for `@noble/post-quantum` ML-KEM operations.
 *
 * Handles both raw (1568-byte) and prefixed (1569-byte, 0x08 prefix) inputs.
 *
 * Reference: libsignal/rust/protocol/src/kem.rs (Ciphertext::deserialize)
 */
export function stripKemPrefix(data: Uint8Array): Uint8Array {
  if (data.length === KYBER1024_PREFIXED_LENGTH && data[0] === KYBER_KEY_TYPE_BYTE) {
    return data.slice(1);
  }
  if (data.length === KYBER1024_RAW_LENGTH) {
    return data;
  }
  throw new Error(
    `Invalid KEM data length: ${data.length}, expected ${KYBER1024_RAW_LENGTH} or ${KYBER1024_PREFIXED_LENGTH}`,
  );
}

/**
 * Add the 0x08 KEM type prefix for wire serialization, matching
 * Rust libsignal's `kem::PublicKey::serialize()` / `kem::SerializedCiphertext`.
 *
 * If the data is already prefixed, returns it as-is.
 *
 * Reference: libsignal/rust/protocol/src/kem.rs (PublicKey::serialize)
 */
export function addKemPrefix(data: Uint8Array): Uint8Array {
  if (data.length === KYBER1024_PREFIXED_LENGTH && data[0] === KYBER_KEY_TYPE_BYTE) {
    return data;
  }
  const prefixed = new Uint8Array(1 + data.length);
  prefixed[0] = KYBER_KEY_TYPE_BYTE;
  prefixed.set(data, 1);
  return prefixed;
}
