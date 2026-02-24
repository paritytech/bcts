/**
 * Signal Protocol constants.
 * Values from libsignal/rust/protocol/src/consts.rs
 */

export const MAX_FORWARD_JUMPS = 25_000;
export const MAX_MESSAGE_KEYS = 2_000;
export const MAX_RECEIVER_CHAINS = 5;
export const ARCHIVED_STATES_MAX_LENGTH = 40;

/** Current wire protocol version (v4, with Kyber/PQXDH support). */
export const CIPHERTEXT_MESSAGE_CURRENT_VERSION = 4;
/** Version 3 — pre-Kyber, backward-compatible version. */
export const CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION = 3;

/** MAC length in bytes (truncated HMAC-SHA256). */
export const MAC_LENGTH = 8;

/** Signal public key type prefix byte for X25519. */
export const KEY_TYPE_DJB = 0x05;

/** 30 days in milliseconds — stale unacknowledged session threshold. */
export const MAX_UNACKNOWLEDGED_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum sender key states to keep (for group messaging). */
export const MAX_SENDER_KEY_STATES = 5;

/** Current sender key message version. */
export const SENDERKEY_MESSAGE_CURRENT_VERSION = 3;

/** Revoked server certificate key IDs. */
export const REVOKED_SERVER_CERTIFICATE_KEY_IDS: ReadonlySet<number> = new Set([0xDEADC357]);
