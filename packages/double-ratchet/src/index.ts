// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * @bcts/double-ratchet — Signal Protocol Double Ratchet implementation.
 *
 * Wire-compatible with Signal Protocol version 3 (X3DH).
 */

// Error types
export {
  RatchetError,
  SessionNotFoundError,
  InvalidMessageError,
  DuplicateMessageError,
  UntrustedIdentityError,
  InvalidKeyError,
  InvalidSessionError,
  SignatureValidationError,
  InvalidKeyIdError,
  InvalidStateError,
  NoKeyPairError,
  InvalidRegistrationIdError,
  UnknownSealedSenderServerCertificateIdError,
  InvalidProtocolAddressError,
  UnrecognizedMessageVersionError,
  InvalidProtobufError,
  LegacyCiphertextVersionError,
  UnrecognizedCiphertextVersionError,
  CiphertextMessageTooShortError,
  InvalidMacKeyLengthError,
  NoSenderKeyStateError,
  InvalidSenderKeySessionError,
  InvalidSealedSenderMessageError,
  UnknownSealedSenderVersionError,
  SealedSenderSelfSendError,
  FingerprintVersionMismatchError,
  FingerprintParsingError,
} from "./error.js";

// Constants
export {
  MAX_FORWARD_JUMPS,
  MAX_MESSAGE_KEYS,
  MAX_RECEIVER_CHAINS,
  ARCHIVED_STATES_MAX_LENGTH,
  MAX_UNACKNOWLEDGED_SESSION_AGE_MS,
  MAC_LENGTH,
  KEY_TYPE_DJB,
  MAX_SENDER_KEY_STATES,
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
  SENDERKEY_MESSAGE_CURRENT_VERSION,
  REVOKED_SERVER_CERTIFICATE_KEY_IDS,
} from "./constants.js";

// Key types
export { KeyPair } from "./keys/key-pair.js";
export {
  IdentityKey,
  IdentityKeyPair,
  createAlternateIdentitySignature,
  verifyAlternateIdentitySignature,
} from "./keys/identity-key.js";
export { PreKeyRecord, SignedPreKeyRecord } from "./keys/pre-key.js";
export { PreKeyBundle } from "./keys/pre-key-bundle.js";

// Ratchet primitives
export { ChainKey } from "./ratchet/chain-key.js";
export { MessageKeys, MessageKeyGeneratorFactory } from "./ratchet/message-keys.js";
export type { MessageKeyGenerator } from "./ratchet/message-keys.js";
export { RootKey } from "./ratchet/root-key.js";

// Protocol messages
export { SignalMessage } from "./protocol/signal-message.js";
export { PreKeySignalMessage } from "./protocol/pre-key-signal-message.js";
export {
  CiphertextMessageType,
  ciphertextMessageType,
  ciphertextMessageSerialize,
  ciphertextMessageFrom,
} from "./protocol/ciphertext-message.js";
export type {
  CiphertextMessage,
  CiphertextMessageConvertible,
} from "./protocol/ciphertext-message.js";
export { PlaintextContent } from "./protocol/plaintext-content.js";
export { DecryptionErrorMessage } from "./protocol/decryption-error-message.js";

// Session management
export { SessionState, SessionUsabilityRequirements } from "./session/session-state.js";
export type { PendingPreKey, PendingKyberPreKey } from "./session/session-state.js";
export { SessionRecord } from "./session/session-record.js";

// High-level API
export { messageEncrypt, messageDecrypt } from "./session/session-cipher.js";
export { processPreKeyBundle } from "./x3dh/process-prekey-bundle.js";

// Group messaging (Sender Keys / Group Cipher)
export { SenderChainKey } from "./group/sender-chain-key.js";
export { SenderMessageKey } from "./group/sender-message-key.js";
export { SenderKeyState } from "./group/sender-key-state.js";
export { SenderKeyRecord } from "./group/sender-key-record.js";
export {
  groupEncrypt,
  groupDecrypt,
  createSenderKeyDistributionMessage,
  processSenderKeyDistributionMessage,
} from "./group/group-cipher.js";

// Protocol messages — Sender Key
export { SenderKeyMessage } from "./protocol/sender-key-message.js";
export { SenderKeyDistributionMessage } from "./protocol/sender-key-distribution-message.js";

// Storage interfaces
export { ProtocolAddress } from "./storage/interfaces.js";
export type {
  SessionStore,
  PreKeyStore,
  SignedPreKeyStore,
  IdentityKeyStore,
  SenderKeyStore,
  ProtocolStore,
  Direction,
  DistributionId,
} from "./storage/interfaces.js";
export { generateDistributionId, createDistributionId } from "./storage/interfaces.js";
export { InMemorySignalProtocolStore } from "./storage/in-memory-store.js";

// Fingerprint / Safety Numbers
export {
  Fingerprint,
  DisplayableFingerprint,
  ScannableFingerprint,
} from "./fingerprint/fingerprint.js";

// Sealed Sender (anonymous delivery)
export { ServerCertificate } from "./sealed-sender/server-certificate.js";
export {
  lookupKnownServerCertificate,
  isKnownServerCertificateId,
  getKnownCertificateTrustRoot,
} from "./sealed-sender/server-certificate.js";
export { SenderCertificate } from "./sealed-sender/sender-certificate.js";
export {
  ContentHint,
  UnidentifiedSenderMessageContent,
  sealedSenderEncrypt,
  sealedSenderEncryptV2,
  sealedSenderDecrypt,
  sealedSenderDecryptToUsmc,
  sealedSenderMultiRecipientEncrypt,
  SealedSenderMultiRecipientMessage,
  sealedSenderMultiRecipientMessageForSingleRecipient,
  serviceIdFromUuid,
} from "./sealed-sender/sealed-sender.js";
export type {
  SealedSenderDecryptionResult,
  SealedSenderRecipient,
  SealedSenderV2SentRecipient,
  SealedSenderMultiRecipientEncryptOptions,
} from "./sealed-sender/sealed-sender.js";

// Crypto primitives (for advanced use)
export { aes256CbcEncrypt, aes256CbcDecrypt } from "./crypto/aes-cbc.js";
export { aes256GcmSivEncrypt, aes256GcmSivDecrypt } from "./crypto/aes-gcm-siv.js";
export { hkdfSha256, hmacSha256 } from "./crypto/kdf.js";
export { x25519RawAgreement, isCanonicalPublicKey } from "./crypto/agreement.js";
export { xeddsaSign, xeddsaVerify } from "./crypto/xeddsa.js";
export {
  IncrementalMac,
  IncrementalMacValidator,
  calculateChunkSize,
} from "./crypto/incremental-mac.js";
export { constantTimeEqual } from "./crypto/constant-time.js";
