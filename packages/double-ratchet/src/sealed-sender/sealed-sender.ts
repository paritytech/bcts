// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * Sealed Sender -- anonymous delivery protocol.
 *
 * Implements Sealed Sender v1 and v2 key encapsulation mechanisms from the
 * Signal Protocol. The sender's identity is hidden from the server by
 * encrypting both the sender's public key and the message content using
 * ephemeral keys derived through X25519 DH.
 *
 * V1 (single-recipient):
 *   ECDH(ephemeral, recipientIdentity) -> AES-256-CTR + HMAC-SHA256
 *
 * V2 (single + multi-recipient):
 *   Random M -> derive ephemeral keys + AES-256-GCM-SIV for shared ciphertext
 *   Per-recipient: XOR-encrypt M using ECDH + HKDF, plus authentication tag
 *
 * Reference: libsignal/rust/protocol/src/sealed_sender.rs
 */

import { x25519RawAgreement } from "../crypto/agreement.js";
import { hkdfSha256, hmacSha256 } from "../crypto/kdf.js";
import { aes256GcmSivEncrypt, aes256GcmSivDecrypt } from "../crypto/aes-gcm-siv.js";
import { KeyPair } from "../keys/key-pair.js";
import type { IdentityKeyPair } from "../keys/identity-key.js";
import { SenderCertificate } from "./sender-certificate.js";
import { CiphertextMessageType } from "../protocol/ciphertext-message.js";
import {
  InvalidSealedSenderMessageError,
  UnknownSealedSenderVersionError,
  SealedSenderSelfSendError,
  InvalidRegistrationIdError,
} from "../error.js";
import {
  encodeBytesField,
  encodeUint32Field,
  concatProtoFields,
  parseProtoFields,
  encodeVarint,
  decodeVarint,
} from "../protocol/proto.js";
import type { RandomNumberGenerator } from "@bcts/rand";
import { ctr } from "@noble/ciphers/aes.js";
import { constantTimeEqual } from "../crypto/constant-time.js";

// ============================================================================
// Version constants
// ============================================================================

/** Sealed Sender v1 full version byte (high nibble = 1, low nibble = 1). */
const SEALED_SENDER_V1_FULL_VERSION = 0x11;
/** Major version number extracted from the high nibble. */
const SEALED_SENDER_V1_MAJOR_VERSION = 1;
/** Sealed Sender v2 major version. */
const SEALED_SENDER_V2_MAJOR_VERSION = 2;
/** V2 with UUID-only recipient format. */
const SEALED_SENDER_V2_UUID_FULL_VERSION = 0x22;
/** V2 with ServiceId (type byte + UUID) recipient format. */
const SEALED_SENDER_V2_SERVICE_ID_FULL_VERSION = 0x23;

// ============================================================================
// V2 constants (from libsignal sealed_sender_v2 module)
// ============================================================================

/** Length of the random message key M. */
const MESSAGE_KEY_LEN = 32;
/** Length of the AES-256-GCM-SIV cipher key. */
const CIPHER_KEY_LEN = 32;
/** Length of the per-recipient authentication tag. */
const AUTH_TAG_LEN = 16;
/** Length of a raw X25519 public key (no type prefix). */
const PUBLIC_KEY_LEN = 32;
/** Valid registration IDs fit in 14 bits. */
const VALID_REGISTRATION_ID_MASK = 0x3fff;
/** ServiceId fixed-width binary is 17 bytes (1 type + 16 UUID). */
const SERVICE_ID_FIXED_WIDTH_LEN = 17;

/** HKDF labels used in Sealed Sender v2. */
const LABEL_R = new TextEncoder().encode("Sealed Sender v2: r (2023-08)");
const LABEL_K = new TextEncoder().encode("Sealed Sender v2: K");
const LABEL_DH = new TextEncoder().encode("Sealed Sender v2: DH");
const LABEL_DH_S = new TextEncoder().encode("Sealed Sender v2: DH-sender");

// ============================================================================
// V1 constants
// ============================================================================

/** Salt prefix for v1 ephemeral key derivation. */
const UNIDENTIFIED_DELIVERY_PREFIX = new TextEncoder().encode("UnidentifiedDelivery");
/** HMAC truncation length (10 bytes, matches libsignal). */
const MAC_TRUNCATED_LENGTH = 10;

// ============================================================================
// ContentHint enum (Task 2.1)
// ============================================================================

/**
 * Indicates how the client should handle a sealed sender message if the
 * inner content cannot be decrypted.
 *
 * Matches proto ContentHint in sealed_sender.proto.
 */
export enum ContentHint {
  /** Sender will not resend; show an error immediately. */
  Default = 0,
  /** Sender will try to resend; delay error UI if possible. */
  Resendable = 1,
  /** Don't show error UI; this is implicit (typing, receipts). */
  Implicit = 2,
}

// ============================================================================
// UnidentifiedSenderMessageContent (Task 2.2)
// ============================================================================

/**
 * Proto message type values matching UnidentifiedSenderMessage.Message.Type.
 * These map to CiphertextMessageType but with a different numeric value
 * for the PREKEY_MESSAGE case (proto=1, CiphertextMessageType.PreKey=3).
 */
const PROTO_TYPE_PREKEY_MESSAGE = 1;
const PROTO_TYPE_MESSAGE = 2;
const PROTO_TYPE_SENDERKEY_MESSAGE = 7;
const PROTO_TYPE_PLAINTEXT_CONTENT = 8;

function ciphertextMessageTypeToProto(msgType: CiphertextMessageType): number {
  switch (msgType) {
    case CiphertextMessageType.PreKey:
      return PROTO_TYPE_PREKEY_MESSAGE;
    case CiphertextMessageType.Whisper:
      return PROTO_TYPE_MESSAGE;
    case CiphertextMessageType.SenderKey:
      return PROTO_TYPE_SENDERKEY_MESSAGE;
    case CiphertextMessageType.Plaintext:
      return PROTO_TYPE_PLAINTEXT_CONTENT;
    default:
      throw new InvalidSealedSenderMessageError(
        `Unknown ciphertext message type: ${msgType as number}`,
      );
  }
}

function protoTypeToCiphertextMessageType(protoType: number): CiphertextMessageType {
  switch (protoType) {
    case PROTO_TYPE_PREKEY_MESSAGE:
      return CiphertextMessageType.PreKey;
    case PROTO_TYPE_MESSAGE:
      return CiphertextMessageType.Whisper;
    case PROTO_TYPE_SENDERKEY_MESSAGE:
      return CiphertextMessageType.SenderKey;
    case PROTO_TYPE_PLAINTEXT_CONTENT:
      return CiphertextMessageType.Plaintext;
    default:
      throw new InvalidSealedSenderMessageError(`Unknown proto message type: ${protoType}`);
  }
}

/**
 * The inner content of a sealed sender message, containing the encrypted
 * message, sender certificate, content hint, and optional group ID.
 *
 * Serialized as UnidentifiedSenderMessage.Message protobuf.
 *
 * Reference: libsignal sealed_sender.rs UnidentifiedSenderMessageContent
 */
export class UnidentifiedSenderMessageContent {
  readonly msgType: CiphertextMessageType;
  readonly senderCertificate: SenderCertificate;
  readonly content: Uint8Array;
  readonly contentHint: ContentHint;
  readonly groupId: Uint8Array | null;

  private _serialized: Uint8Array | null = null;

  constructor(
    msgType: CiphertextMessageType,
    senderCertificate: SenderCertificate,
    content: Uint8Array,
    contentHint: ContentHint = ContentHint.Default,
    groupId: Uint8Array | null = null,
  ) {
    this.msgType = msgType;
    this.senderCertificate = senderCertificate;
    this.content = content;
    this.contentHint = contentHint;
    this.groupId = groupId;
  }

  /**
   * Serialize to protobuf bytes matching UnidentifiedSenderMessage.Message.
   *
   * Fields:
   *   1: type (varint) -- proto message type
   *   2: senderCertificate (bytes) -- serialized SenderCertificate
   *   3: content (bytes) -- the encrypted inner message
   *   4: contentHint (varint) -- omitted when Default (0)
   *   5: groupId (bytes) -- omitted when null or empty
   */
  serialize(): Uint8Array {
    if (this._serialized != null) return this._serialized;

    const protoType = ciphertextMessageTypeToProto(this.msgType);
    const parts: Uint8Array[] = [
      encodeUint32Field(1, protoType),
      encodeBytesField(2, this.senderCertificate.serialized),
      encodeBytesField(3, this.content),
    ];

    // ContentHint: Default (0) is omitted, matching libsignal's to_proto()
    if (this.contentHint !== ContentHint.Default) {
      parts.push(encodeUint32Field(4, this.contentHint));
    }

    // groupId: omitted when null or empty
    if (this.groupId != null && this.groupId.length > 0) {
      parts.push(encodeBytesField(5, this.groupId));
    }

    this._serialized = concatProtoFields(...parts);
    return this._serialized;
  }

  /**
   * Deserialize from protobuf bytes.
   */
  static deserialize(data: Uint8Array): UnidentifiedSenderMessageContent {
    const fields = parseProtoFields(data);

    const protoType = fields.varints.get(1);
    const senderCertBytes = fields.bytes.get(2);
    const content = fields.bytes.get(3);

    if (protoType === undefined || senderCertBytes == null || content == null) {
      throw new InvalidSealedSenderMessageError("Invalid USMC: missing required fields");
    }

    const msgType = protoTypeToCiphertextMessageType(protoType);
    const senderCertificate = SenderCertificate.deserialize(senderCertBytes);

    const contentHintRaw = fields.varints.get(4);
    let contentHint = ContentHint.Default;
    if (contentHintRaw !== undefined) {
      if (
        contentHintRaw === (ContentHint.Resendable as number) ||
        contentHintRaw === (ContentHint.Implicit as number)
      ) {
        contentHint = contentHintRaw;
      }
    }

    const groupId = fields.bytes.get(5) ?? null;

    const usmc = new UnidentifiedSenderMessageContent(
      msgType,
      senderCertificate,
      content,
      contentHint,
      groupId,
    );
    usmc._serialized = Uint8Array.from(data);
    return usmc;
  }
}

// ============================================================================
// Sealed Sender V2 key derivation helpers
// ============================================================================

/**
 * Derive ephemeral key pair and cipher key from random bytes M.
 * Matches libsignal's sealed_sender_v2::DerivedKeys.
 */
function v2DeriveKeys(m: Uint8Array): { e: KeyPair; k: Uint8Array } {
  const r = hkdfSha256(m, undefined, LABEL_R, 32);
  const e = KeyPair.fromPrivateKey(r);
  const k = hkdfSha256(m, undefined, LABEL_K, CIPHER_KEY_LEN);
  return { e, k };
}

/**
 * Encrypt or decrypt a message key M using ECDH-based XOR cipher.
 * Matches libsignal's sealed_sender_v2::apply_agreement_xor.
 */
function v2ApplyAgreementXor(
  ourKeys: KeyPair,
  theirKey: Uint8Array,
  direction: "sending" | "receiving",
  input: Uint8Array,
): Uint8Array {
  const agreement = x25519RawAgreement(ourKeys.privateKey, theirKey);

  let agreementKeyInput: Uint8Array;
  if (direction === "sending") {
    agreementKeyInput = concatBytes(agreement, ourKeys.publicKey, theirKey);
  } else {
    agreementKeyInput = concatBytes(agreement, theirKey, ourKeys.publicKey);
  }

  const mask = hkdfSha256(agreementKeyInput, undefined, LABEL_DH, MESSAGE_KEY_LEN);

  const result = new Uint8Array(MESSAGE_KEY_LEN);
  for (let i = 0; i < MESSAGE_KEY_LEN; i++) {
    result[i] = mask[i] ^ input[i];
  }
  return result;
}

/**
 * Compute an authentication tag for encrypted_message_key.
 * Matches libsignal's sealed_sender_v2::compute_authentication_tag.
 */
function v2ComputeAuthenticationTag(
  ourIdentity: IdentityKeyPair,
  theirIdentityPublicKey: Uint8Array,
  direction: "sending" | "receiving",
  ephemeralPubKey: Uint8Array,
  encryptedMessageKey: Uint8Array,
): Uint8Array {
  const agreement = x25519RawAgreement(ourIdentity.privateKey, theirIdentityPublicKey);

  const ourPubSerialized = serializePublicKey(ourIdentity.identityKey.publicKey);
  const theirPubSerialized = serializePublicKey(theirIdentityPublicKey);

  let agreementKeyInput: Uint8Array;
  if (direction === "sending") {
    agreementKeyInput = concatBytes(
      agreement,
      ephemeralPubKey,
      encryptedMessageKey,
      ourPubSerialized,
      theirPubSerialized,
    );
  } else {
    agreementKeyInput = concatBytes(
      agreement,
      ephemeralPubKey,
      encryptedMessageKey,
      theirPubSerialized,
      ourPubSerialized,
    );
  }

  return hkdfSha256(agreementKeyInput, undefined, LABEL_DH_S, AUTH_TAG_LEN);
}

// ============================================================================
// Public interfaces
// ============================================================================

export interface SealedSenderDecryptionResult {
  senderUuid: string;
  senderE164: string | undefined;
  senderDeviceId: number;
  paddedMessage: Uint8Array;
  contentHint?: ContentHint;
  groupId?: Uint8Array;
}

/**
 * Recipient information for multi-recipient sealed sender.
 */
export interface SealedSenderRecipient {
  /** ServiceId as fixed-width binary (17 bytes: 1 type + 16 UUID). */
  serviceIdFixedWidthBinary: Uint8Array;
  /** Array of device entries. */
  devices: {
    deviceId: number;
    registrationId: number;
  }[];
  /** Recipient's identity public key (32 bytes). */
  identityKey: Uint8Array;
}

/**
 * Parsed per-recipient data from a multi-recipient sent message.
 */
export interface SealedSenderV2SentRecipient {
  /** ServiceId string representation. */
  serviceIdString: string;
  /** ServiceId as fixed-width binary. */
  serviceIdFixedWidthBinary: Uint8Array;
  /** Array of (deviceId, registrationId) tuples. */
  devices: { deviceId: number; registrationId: number }[];
  /** The C_i (encrypted message key) -- 32 bytes. Empty if excluded. */
  cBytes: Uint8Array;
  /** The AT_i (authentication tag) -- 16 bytes. Empty if excluded. */
  atBytes: Uint8Array;
}

// ============================================================================
// V1 helpers
// ============================================================================

function deriveEphemeralKeysFromSecret(
  sharedSecret: Uint8Array,
  recipientIdentityPubSerialized: Uint8Array,
  ephemeralPubSerialized: Uint8Array,
): { chainKey: Uint8Array; cipherKey: Uint8Array; macKey: Uint8Array } {
  const salt = concatBytes(
    UNIDENTIFIED_DELIVERY_PREFIX,
    recipientIdentityPubSerialized,
    ephemeralPubSerialized,
  );
  const derived = hkdfSha256(sharedSecret, salt, new Uint8Array(0), 96);
  return {
    chainKey: derived.slice(0, 32),
    cipherKey: derived.slice(32, 64),
    macKey: derived.slice(64, 96),
  };
}

function deriveStaticKeysFromSecret(
  sharedSecret: Uint8Array,
  chainKey: Uint8Array,
  encryptedStatic: Uint8Array,
): { cipherKey: Uint8Array; macKey: Uint8Array } {
  const salt = concatBytes(chainKey, encryptedStatic);
  const derived = hkdfSha256(sharedSecret, salt, new Uint8Array(0), 96);
  return {
    cipherKey: derived.slice(32, 64),
    macKey: derived.slice(64, 96),
  };
}

function aes256CtrHmacEncrypt(
  plaintext: Uint8Array,
  cipherKey: Uint8Array,
  macKey: Uint8Array,
): Uint8Array {
  const zeroNonce = new Uint8Array(16);
  const cipher = ctr(cipherKey, zeroNonce);
  const ciphertext = cipher.encrypt(plaintext);
  const mac = hmacSha256(macKey, ciphertext);
  const truncatedMac = mac.slice(0, MAC_TRUNCATED_LENGTH);
  return concatBytes(ciphertext, truncatedMac);
}

function aes256CtrHmacDecrypt(
  data: Uint8Array,
  cipherKey: Uint8Array,
  macKey: Uint8Array,
): Uint8Array {
  if (data.length < MAC_TRUNCATED_LENGTH) {
    throw new InvalidSealedSenderMessageError("Ciphertext too short for MAC");
  }
  const ciphertext = data.slice(0, data.length - MAC_TRUNCATED_LENGTH);
  const theirMac = data.slice(data.length - MAC_TRUNCATED_LENGTH);
  const ourMac = hmacSha256(macKey, ciphertext);
  const ourTruncated = ourMac.slice(0, MAC_TRUNCATED_LENGTH);
  if (!constantTimeEqual(ourTruncated, theirMac)) {
    throw new InvalidSealedSenderMessageError("MAC verification failed");
  }
  const zeroNonce = new Uint8Array(16);
  const cipher = ctr(cipherKey, zeroNonce);
  return cipher.decrypt(ciphertext);
}

function serializePublicKey(key: Uint8Array): Uint8Array {
  const result = new Uint8Array(33);
  result[0] = 0x05;
  result.set(key, 1);
  return result;
}

function deserializePublicKey(data: Uint8Array): Uint8Array {
  if (data.length === 33 && data[0] === 0x05) {
    return data.slice(1);
  }
  if (data.length === 32) {
    return data;
  }
  throw new InvalidSealedSenderMessageError("Invalid public key length");
}

// ============================================================================
// Sealed Sender V1 Encrypt
// ============================================================================

/**
 * Encrypt a message using sealed sender v1 (anonymous delivery).
 */
export function sealedSenderEncrypt(
  senderIdentityKeyPair: IdentityKeyPair,
  recipientIdentityPublicKey: Uint8Array,
  senderCertificate: SenderCertificate,
  innerMessage: Uint8Array,
  rng: RandomNumberGenerator,
): Uint8Array {
  const ephemeralKeyPair = KeyPair.generate(rng);
  const recipientPubSerialized = serializePublicKey(recipientIdentityPublicKey);
  const ephemeralPubSerialized = serializePublicKey(ephemeralKeyPair.publicKey);

  const ephSecret = x25519RawAgreement(ephemeralKeyPair.privateKey, recipientIdentityPublicKey);
  const ephKeys = deriveEphemeralKeysFromSecret(
    ephSecret,
    recipientPubSerialized,
    ephemeralPubSerialized,
  );

  const senderPubSerialized = serializePublicKey(senderIdentityKeyPair.identityKey.publicKey);
  const encryptedStatic = aes256CtrHmacEncrypt(
    senderPubSerialized,
    ephKeys.cipherKey,
    ephKeys.macKey,
  );

  const staticSecret = x25519RawAgreement(
    senderIdentityKeyPair.privateKey,
    recipientIdentityPublicKey,
  );
  const staticKeys = deriveStaticKeysFromSecret(staticSecret, ephKeys.chainKey, encryptedStatic);

  // Build USMC with type Whisper (proto value 2)
  const usmc = concatProtoFields(
    encodeUint32Field(1, 2),
    encodeBytesField(2, senderCertificate.serialized),
    encodeBytesField(3, innerMessage),
  );

  const encryptedMessage = aes256CtrHmacEncrypt(usmc, staticKeys.cipherKey, staticKeys.macKey);

  const proto = concatProtoFields(
    encodeBytesField(1, ephemeralPubSerialized),
    encodeBytesField(2, encryptedStatic),
    encodeBytesField(3, encryptedMessage),
  );

  return concatBytes(new Uint8Array([SEALED_SENDER_V1_FULL_VERSION]), proto);
}

// ============================================================================
// Sealed Sender V2 Single-Recipient Encrypt (Task 2.4)
// ============================================================================

/**
 * Encrypt a USMC for a single recipient using Sealed Sender V2.
 *
 * Wire format (ReceivedMessage):
 *   version_byte(0x22) || C(32) || AT(16) || E.pub(32) || encrypted_message
 */
export function sealedSenderEncryptV2(
  usmc: UnidentifiedSenderMessageContent,
  recipientIdentityPublicKey: Uint8Array,
  senderIdentityKeyPair: IdentityKeyPair,
  rng: RandomNumberGenerator,
): Uint8Array {
  const m = rng.randomData(MESSAGE_KEY_LEN);
  const { e, k } = v2DeriveKeys(m);

  const c = v2ApplyAgreementXor(e, recipientIdentityPublicKey, "sending", m);

  const at = v2ComputeAuthenticationTag(
    senderIdentityKeyPair,
    recipientIdentityPublicKey,
    "sending",
    e.publicKey,
    c,
  );

  const zeroNonce = new Uint8Array(12);
  const encryptedMessage = aes256GcmSivEncrypt(k, zeroNonce, usmc.serialize());

  return concatBytes(
    new Uint8Array([SEALED_SENDER_V2_UUID_FULL_VERSION]),
    c,
    at,
    e.publicKey,
    encryptedMessage,
  );
}

// ============================================================================
// Sealed Sender Decrypt (V1 + V2) (Task 2.4)
// ============================================================================

/**
 * Decrypt a sealed sender message to obtain the USMC.
 * Handles both V1 and V2 formats.
 */
export function sealedSenderDecryptToUsmc(
  ciphertext: Uint8Array,
  identityKeyPair: IdentityKeyPair,
): UnidentifiedSenderMessageContent {
  if (ciphertext.length < 2) {
    throw new InvalidSealedSenderMessageError("Message too short");
  }

  const versionByte = ciphertext[0];
  const majorVersion = versionByte >> 4;

  if (majorVersion === 0 || majorVersion === SEALED_SENDER_V1_MAJOR_VERSION) {
    return decryptV1ToUsmc(ciphertext, identityKeyPair);
  } else if (majorVersion === SEALED_SENDER_V2_MAJOR_VERSION) {
    return decryptV2ToUsmc(ciphertext, identityKeyPair);
  } else {
    throw new UnknownSealedSenderVersionError(majorVersion);
  }
}

function decryptV1ToUsmc(
  ciphertext: Uint8Array,
  identityKeyPair: IdentityKeyPair,
): UnidentifiedSenderMessageContent {
  const protoData = ciphertext.slice(1);
  const fields = parseProtoFields(protoData);

  const ephemeralPublicBytes = fields.bytes.get(1);
  const encryptedStatic = fields.bytes.get(2);
  const encryptedMessage = fields.bytes.get(3);

  if (ephemeralPublicBytes == null || encryptedStatic == null || encryptedMessage == null) {
    throw new InvalidSealedSenderMessageError("Missing required fields");
  }

  const ephemeralPublic = deserializePublicKey(ephemeralPublicBytes);
  const recipientPubSerialized = serializePublicKey(identityKeyPair.identityKey.publicKey);

  const ephSecret = x25519RawAgreement(identityKeyPair.privateKey, ephemeralPublic);
  const ephKeys = deriveEphemeralKeysFromSecret(
    ephSecret,
    recipientPubSerialized,
    ephemeralPublicBytes,
  );

  let senderPubSerialized: Uint8Array;
  try {
    senderPubSerialized = aes256CtrHmacDecrypt(encryptedStatic, ephKeys.cipherKey, ephKeys.macKey);
  } catch {
    throw new InvalidSealedSenderMessageError("Failed to decrypt sealed sender v1 message key");
  }

  const senderPublicKey = deserializePublicKey(senderPubSerialized);

  const staticSecret = x25519RawAgreement(identityKeyPair.privateKey, senderPublicKey);
  const staticKeys = deriveStaticKeysFromSecret(staticSecret, ephKeys.chainKey, encryptedStatic);

  let messageBytes: Uint8Array;
  try {
    messageBytes = aes256CtrHmacDecrypt(encryptedMessage, staticKeys.cipherKey, staticKeys.macKey);
  } catch {
    throw new InvalidSealedSenderMessageError(
      "Failed to decrypt sealed sender v1 message contents",
    );
  }

  const usmc = UnidentifiedSenderMessageContent.deserialize(messageBytes);

  if (
    !constantTimeEqual(senderPubSerialized, serializePublicKey(usmc.senderCertificate.identityKey))
  ) {
    throw new InvalidSealedSenderMessageError("sender certificate key does not match message key");
  }

  return usmc;
}

/**
 * Decrypt a V2 sealed sender message to USMC.
 * ReceivedMessage: version(1) || C(32) || AT(16) || E.pub(32) || encrypted
 */
function decryptV2ToUsmc(
  ciphertext: Uint8Array,
  identityKeyPair: IdentityKeyPair,
): UnidentifiedSenderMessageContent {
  const minLen = 1 + MESSAGE_KEY_LEN + AUTH_TAG_LEN + PUBLIC_KEY_LEN;
  if (ciphertext.length < minLen) {
    throw new InvalidSealedSenderMessageError("V2 message too short");
  }

  let offset = 1;
  const encryptedMessageKey = ciphertext.slice(offset, offset + MESSAGE_KEY_LEN);
  offset += MESSAGE_KEY_LEN;
  const authenticationTag = ciphertext.slice(offset, offset + AUTH_TAG_LEN);
  offset += AUTH_TAG_LEN;
  const ephemeralPublic = ciphertext.slice(offset, offset + PUBLIC_KEY_LEN);
  offset += PUBLIC_KEY_LEN;
  const encryptedMessage = ciphertext.slice(offset);

  const recipientKeyPair = new KeyPair(
    identityKeyPair.privateKey,
    identityKeyPair.identityKey.publicKey,
  );
  const m = v2ApplyAgreementXor(
    recipientKeyPair,
    ephemeralPublic,
    "receiving",
    encryptedMessageKey,
  );

  const { e, k } = v2DeriveKeys(m);
  if (!constantTimeEqual(e.publicKey, ephemeralPublic)) {
    throw new InvalidSealedSenderMessageError(
      "derived ephemeral key did not match key provided in message",
    );
  }

  const zeroNonce = new Uint8Array(12);
  let messageBytes: Uint8Array;
  try {
    messageBytes = aes256GcmSivDecrypt(k, zeroNonce, encryptedMessage);
  } catch {
    throw new InvalidSealedSenderMessageError("failed to decrypt inner message");
  }

  const usmc = UnidentifiedSenderMessageContent.deserialize(messageBytes);

  const at = v2ComputeAuthenticationTag(
    identityKeyPair,
    usmc.senderCertificate.identityKey,
    "receiving",
    ephemeralPublic,
    encryptedMessageKey,
  );
  if (!constantTimeEqual(authenticationTag, at)) {
    throw new InvalidSealedSenderMessageError(
      "sender certificate key does not match authentication tag",
    );
  }

  return usmc;
}

// ============================================================================
// Sealed Sender Decrypt -- public API (V1 + V2)
// ============================================================================

/**
 * Decrypt a sealed sender message (V1 or V2).
 */
export function sealedSenderDecrypt(
  ciphertext: Uint8Array,
  identityKeyPair: IdentityKeyPair,
  trustRootPublicKey: Uint8Array,
  now: number,
): SealedSenderDecryptionResult {
  const usmc = sealedSenderDecryptToUsmc(ciphertext, identityKeyPair);

  if (!usmc.senderCertificate.validate(trustRootPublicKey, now)) {
    throw new InvalidSealedSenderMessageError("trust root validation failed");
  }

  if (
    constantTimeEqual(usmc.senderCertificate.identityKey, identityKeyPair.identityKey.publicKey)
  ) {
    throw new SealedSenderSelfSendError();
  }

  const result: SealedSenderDecryptionResult = {
    senderUuid: usmc.senderCertificate.senderUuid,
    senderE164: usmc.senderCertificate.senderE164,
    senderDeviceId: usmc.senderCertificate.senderDeviceId,
    paddedMessage: usmc.content,
    contentHint: usmc.contentHint,
  };
  if (usmc.groupId != null) result.groupId = usmc.groupId;
  return result;
}

// ============================================================================
// Sealed Sender V2 Multi-Recipient Encrypt (Task 2.5)
// ============================================================================

/**
 * Options for multi-recipient sealed sender encryption.
 */
export interface SealedSenderMultiRecipientEncryptOptions {
  usmc: UnidentifiedSenderMessageContent;
  recipients: SealedSenderRecipient[];
  excludedRecipients?: Uint8Array[];
  senderIdentityKeyPair: IdentityKeyPair;
  rng: RandomNumberGenerator;
}

/**
 * Encrypt a message for multiple recipients using Sealed Sender V2.
 *
 * Sent message wire format:
 *   version_byte(0x23) || varint(count) ||
 *   per_recipient_data... ||
 *   e_pub(32) || encrypted_message
 *
 * Reference: libsignal sealed_sender_multi_recipient_encrypt
 */
export function sealedSenderMultiRecipientEncrypt(
  options: SealedSenderMultiRecipientEncryptOptions,
): Uint8Array {
  const { usmc, recipients, excludedRecipients = [], senderIdentityKeyPair, rng } = options;

  const m = rng.randomData(MESSAGE_KEY_LEN);
  const { e, k } = v2DeriveKeys(m);

  const zeroNonce = new Uint8Array(12);
  const ciphertext = aes256GcmSivEncrypt(k, zeroNonce, usmc.serialize());

  const parts: Uint8Array[] = [];

  parts.push(new Uint8Array([SEALED_SENDER_V2_SERVICE_ID_FULL_VERSION]));

  const totalCount = recipients.length + excludedRecipients.length;
  parts.push(encodeVarint(totalCount));

  for (const recipient of recipients) {
    parts.push(recipient.serviceIdFixedWidthBinary);

    for (let i = 0; i < recipient.devices.length; i++) {
      const device = recipient.devices[i];
      const hasMore = i < recipient.devices.length - 1;

      const regId = device.registrationId;
      if ((regId & VALID_REGISTRATION_ID_MASK) !== regId) {
        throw new InvalidRegistrationIdError(
          `${serviceIdToString(recipient.serviceIdFixedWidthBinary)}.${device.deviceId}`,
          regId,
        );
      }

      parts.push(new Uint8Array([device.deviceId]));

      let regIdWithHasMore = regId & VALID_REGISTRATION_ID_MASK;
      if (hasMore) {
        regIdWithHasMore |= 0x8000;
      }
      const regIdBytes = new Uint8Array(2);
      regIdBytes[0] = (regIdWithHasMore >> 8) & 0xff;
      regIdBytes[1] = regIdWithHasMore & 0xff;
      parts.push(regIdBytes);
    }

    const c = v2ApplyAgreementXor(e, recipient.identityKey, "sending", m);
    parts.push(c);

    const at = v2ComputeAuthenticationTag(
      senderIdentityKeyPair,
      recipient.identityKey,
      "sending",
      e.publicKey,
      c,
    );
    parts.push(at);
  }

  for (const excludedServiceId of excludedRecipients) {
    parts.push(excludedServiceId);
    parts.push(new Uint8Array([0]));
  }

  parts.push(e.publicKey);
  parts.push(ciphertext);

  return concatBytes(...parts);
}

// ============================================================================
// SealedSenderMultiRecipientMessage parser (Task 2.6)
// ============================================================================

/**
 * Parser for Sealed Sender V2 sent messages (multi-recipient format).
 */
export class SealedSenderMultiRecipientMessage {
  readonly version: number;
  readonly recipients: Map<string, SealedSenderV2SentRecipient>;
  private readonly sharedBytes: Uint8Array;

  private constructor(
    version: number,
    recipients: Map<string, SealedSenderV2SentRecipient>,
    sharedBytes: Uint8Array,
  ) {
    this.version = version;
    this.recipients = recipients;
    this.sharedBytes = sharedBytes;
  }

  /**
   * Parse a sent-format multi-recipient message.
   */
  static parse(data: Uint8Array): SealedSenderMultiRecipientMessage {
    if (data.length === 0) {
      throw new InvalidSealedSenderMessageError("Message was empty");
    }

    const version = data[0];
    if (
      version !== SEALED_SENDER_V2_UUID_FULL_VERSION &&
      version !== SEALED_SENDER_V2_SERVICE_ID_FULL_VERSION
    ) {
      throw new UnknownSealedSenderVersionError(version);
    }

    let offset = 1;
    const [recipientCount, countEnd] = decodeVarint(data, offset);
    offset = countEnd;

    const recipients = new Map<string, SealedSenderV2SentRecipient>();

    for (let i = 0; i < recipientCount; i++) {
      let serviceIdBytes: Uint8Array;
      let serviceIdString: string;

      if (version === SEALED_SENDER_V2_UUID_FULL_VERSION) {
        if (offset + 16 > data.length) {
          throw new InvalidSealedSenderMessageError("Message truncated at service ID");
        }
        const uuidBytes = data.slice(offset, offset + 16);
        offset += 16;
        serviceIdBytes = new Uint8Array(17);
        serviceIdBytes[0] = 0x01;
        serviceIdBytes.set(uuidBytes, 1);
        serviceIdString = formatUuidFromBytes(uuidBytes);
      } else {
        if (offset + SERVICE_ID_FIXED_WIDTH_LEN > data.length) {
          throw new InvalidSealedSenderMessageError("Message truncated at service ID");
        }
        serviceIdBytes = data.slice(offset, offset + SERVICE_ID_FIXED_WIDTH_LEN);
        offset += SERVICE_ID_FIXED_WIDTH_LEN;
        serviceIdString = formatServiceIdString(serviceIdBytes);
      }

      const devices: {
        deviceId: number;
        registrationId: number;
      }[] = [];
      let hasDevices = true;

      for (;;) {
        if (offset >= data.length) {
          throw new InvalidSealedSenderMessageError("Message truncated at device list");
        }
        const deviceId = data[offset];
        offset += 1;

        if (deviceId === 0) {
          if (devices.length > 0) {
            throw new InvalidSealedSenderMessageError(
              "Invalid encoding: device ID 0 after devices",
            );
          }
          hasDevices = false;
          break;
        }

        if (offset + 2 > data.length) {
          throw new InvalidSealedSenderMessageError("Message truncated at registration ID");
        }
        const regIdAndMore = (data[offset] << 8) | data[offset + 1];
        offset += 2;

        const registrationId = regIdAndMore & VALID_REGISTRATION_ID_MASK;
        const hasMore = (regIdAndMore & 0x8000) !== 0;

        devices.push({ deviceId, registrationId });

        if (!hasMore) {
          break;
        }
      }

      let cBytes = new Uint8Array(0);
      let atBytes = new Uint8Array(0);

      if (hasDevices && devices.length > 0) {
        const keyMaterialLen = MESSAGE_KEY_LEN + AUTH_TAG_LEN;
        if (offset + keyMaterialLen > data.length) {
          throw new InvalidSealedSenderMessageError("Message truncated at key material");
        }
        cBytes = data.slice(offset, offset + MESSAGE_KEY_LEN);
        offset += MESSAGE_KEY_LEN;
        atBytes = data.slice(offset, offset + AUTH_TAG_LEN);
        offset += AUTH_TAG_LEN;
      }

      const existing = recipients.get(serviceIdString);
      if (existing != null) {
        if (existing.devices.length === 0 || devices.length === 0) {
          throw new InvalidSealedSenderMessageError("recipient redundantly encoded as empty");
        }
        existing.devices.push(...devices);
      } else {
        recipients.set(serviceIdString, {
          serviceIdString,
          serviceIdFixedWidthBinary: serviceIdBytes,
          devices,
          cBytes,
          atBytes,
        });
      }
    }

    if (offset + PUBLIC_KEY_LEN > data.length) {
      throw new InvalidSealedSenderMessageError("Message truncated at ephemeral public key");
    }

    const sharedBytes = data.slice(offset);

    return new SealedSenderMultiRecipientMessage(version, recipients, sharedBytes);
  }

  /**
   * Get the map of recipients keyed by ServiceId string.
   */
  recipientsByServiceIdString(): Map<string, SealedSenderV2SentRecipient> {
    return this.recipients;
  }

  /**
   * Extract the received-format message for a specific recipient.
   * ReceivedMessage: version(0x22) || C(32) || AT(16) || E.pub(32) || msg
   */
  messageForRecipient(recipient: SealedSenderV2SentRecipient): Uint8Array {
    return concatBytes(
      new Uint8Array([SEALED_SENDER_V2_UUID_FULL_VERSION]),
      recipient.cBytes,
      recipient.atBytes,
      this.sharedBytes,
    );
  }
}

/**
 * Convert a multi-recipient sent message to received format for
 * the single included recipient.
 */
export function sealedSenderMultiRecipientMessageForSingleRecipient(
  sentMessage: Uint8Array,
): Uint8Array {
  const parsed = SealedSenderMultiRecipientMessage.parse(sentMessage);
  const recipients = Array.from(parsed.recipients.values());
  const included = recipients.filter((r) => r.devices.length > 0);

  if (included.length !== 1) {
    throw new InvalidSealedSenderMessageError(
      `Expected exactly one included recipient, found ${included.length}`,
    );
  }

  return parsed.messageForRecipient(included[0]);
}

// ============================================================================
// Utility functions
// ============================================================================

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const a of arrays) totalLen += a.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function formatUuidFromBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function formatServiceIdString(bytes: Uint8Array): string {
  const type = bytes[0];
  const uuid = formatUuidFromBytes(bytes.slice(1));
  if (type === 0x01) return uuid;
  if (type === 0x02) return `PNI:${uuid}`;
  return `Unknown(${type}):${uuid}`;
}

function serviceIdToString(bytes: Uint8Array): string {
  return formatServiceIdString(bytes);
}

/**
 * Create a ServiceId fixed-width binary from a UUID string.
 * Defaults to ACI (type 0x01).
 */
export function serviceIdFromUuid(uuid: string, type = 0x01): Uint8Array {
  const clean = uuid.replace(/-/g, "");
  if (clean.length !== 32) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  const result = new Uint8Array(17);
  result[0] = type;
  for (let i = 0; i < 16; i++) {
    result[i + 1] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}
