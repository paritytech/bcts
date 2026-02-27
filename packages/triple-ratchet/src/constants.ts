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

/** Type byte prefix for Kyber public keys in signature verification. */
export const KYBER_KEY_TYPE_BYTE = 0x08;
