/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Protocol constants for SPQR.
 * Values must match the Rust implementation exactly.
 */

/** Size of each erasure-coded chunk in bytes */
export const CHUNK_SIZE = 32;

/** Number of parallel polynomials per chunk (32 bytes / 2 bytes per GF16) */
export const NUM_POLYS = 16;

/** GF(2^16) irreducible polynomial */
export const GF_POLY = 0x1100b;

/** ML-KEM-768 split public key header size */
export const HEADER_SIZE = 64;

/** ML-KEM-768 remaining public key (encapsulation key) */
export const ENCAPSULATION_KEY_SIZE = 1152;

/** ML-KEM-768 secret key size */
export const DECAPSULATION_KEY_SIZE = 2400;

/** ML-KEM-768 first ciphertext size */
export const CIPHERTEXT1_SIZE = 960;

/** ML-KEM-768 second ciphertext size */
export const CIPHERTEXT2_SIZE = 128;

/** ML-KEM-768 full public key size */
export const PUBLIC_KEY_SIZE = 1184;

/** ML-KEM-768 full ciphertext size */
export const FULL_CIPHERTEXT_SIZE = 1088;

/** libcrux incremental encapsulation state size */
export const ENCAPSULATION_STATE_SIZE = 2080;

/** KEM shared secret size */
export const SHARED_SECRET_SIZE = 32;

/** HMAC-SHA256 MAC size */
export const MAC_SIZE = 32;

/** Default max key index jump */
export const DEFAULT_MAX_JUMP = 25000;

/** Default max out-of-order keys stored */
export const DEFAULT_MAX_OOO_KEYS = 2000;

/** Default chain parameters */
export const DEFAULT_CHAIN_PARAMS = {
  maxJump: DEFAULT_MAX_JUMP,
  maxOooKeys: DEFAULT_MAX_OOO_KEYS,
} as const;

/** Number of epochs to keep prior to the current send epoch */
export const EPOCHS_TO_KEEP_PRIOR_TO_SEND_EPOCH = 1;

/** Size of a key entry in KeyHistory: 4 bytes (index BE32) + 32 bytes (key) */
export const KEY_ENTRY_SIZE = 36;

// ---- HKDF Labels (must match Rust exactly) ----

/** Chain initialization label (NOTE: two spaces before "Start") */
export const LABEL_CHAIN_START = "Signal PQ Ratchet V1 Chain  Start";

/** Chain epoch advancement label */
export const LABEL_CHAIN_ADD_EPOCH = "Signal PQ Ratchet V1 Chain Add Epoch";

/** Per-message key derivation label */
export const LABEL_CHAIN_NEXT = "Signal PQ Ratchet V1 Chain Next";

/** Authenticator key ratchet label */
export const LABEL_AUTH_UPDATE = "Signal_PQCKA_V1_MLKEM768:Authenticator Update";

/** Ciphertext MAC label */
export const LABEL_CT_MAC = "Signal_PQCKA_V1_MLKEM768:ciphertext";

/** Header MAC label */
export const LABEL_HDR_MAC = "Signal_PQCKA_V1_MLKEM768:ekheader";

/** Epoch secret derivation label */
export const LABEL_SCKA_KEY = "Signal_PQCKA_V1_MLKEM768:SCKA Key";

/** 32-byte zero salt used in HKDF */
export const ZERO_SALT = new Uint8Array(32);
