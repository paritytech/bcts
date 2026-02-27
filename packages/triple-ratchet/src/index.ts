/**
 * @bcts/triple-ratchet
 *
 * Triple Ratchet protocol for TypeScript.
 *
 * Implements Signal Protocol v4: X3DH + ML-KEM (Kyber) hybrid key agreement
 * with SPQR post-quantum ratchet.
 */

// Session initialization (PQXDH)
export {
  deriveKeys,
  spqrChainParams,
  initializeAliceSession,
  initializeBobSession,
} from "./session-init.js";

// Session state
export {
  TripleRatchetSessionState,
  TripleRatchetSessionUsability,
  hasUsableTripleRatchetSession,
} from "./session-state.js";
export type { TripleRatchetSessionUsabilityFlags } from "./session-state.js";

// Protocol messages
export {
  TripleRatchetSignalMessage,
  TripleRatchetPreKeySignalMessage,
} from "./protocol.js";

// Message keys
export { deriveMessageKeys } from "./message-keys.js";

// Stores
export {
  KyberPreKeyRecord,
  InMemoryKyberPreKeyStore,
} from "./stores.js";
export type {
  KyberPreKeyStore,
  PQXDHPreKeyBundle,
} from "./stores.js";

// Types
export type {
  AlicePQXDHParameters,
  BobPQXDHParameters,
  KyberKeyPair,
  KyberCiphertext,
  PQXDHDerivedKeys,
  PQRatchetState,
  PQRatchetMessage,
  InitialPQRKey,
  PreKeysUsed,
  TripleRatchetChainParams,
} from "./types.js";

// Session cipher (encrypt/decrypt)
export {
  tripleRatchetEncrypt,
  tripleRatchetDecrypt,
} from "./session-cipher.js";

// PreKey bundle processing
export { processPreKeyBundle } from "./session.js";

// Error types
export { TripleRatchetError, TripleRatchetErrorCode } from "./error.js";

// Constants
export {
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
  KDF_LABEL_PQXDH,
  KDF_LABEL_MESSAGE_KEYS,
  DISCONTINUITY_BYTES,
  KYBER_KEY_TYPE_BYTE,
  KYBER1024_RAW_LENGTH,
  KYBER1024_PREFIXED_LENGTH,
  stripKemPrefix,
  addKemPrefix,
} from "./constants.js";
