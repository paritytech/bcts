// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * Extended protocol messages for the triple ratchet (PQXDH + SPQR).
 *
 * TripleRatchetSignalMessage extends SignalMessage with protobuf field 5 (pq_ratchet bytes).
 * TripleRatchetPreKeySignalMessage extends PreKeySignalMessage with Kyber fields 7/8.
 *
 * Wire format:
 *   [version_byte] [protobuf_body] [8-byte MAC]
 *   version_byte = (4 << 4) | 4 = 0x44 for v4
 */

import { hmacSha256 } from "@bcts/double-ratchet";
import type { IdentityKey } from "@bcts/double-ratchet";
import { TripleRatchetError, TripleRatchetErrorCode } from "./error.js";
import { MAC_LENGTH, CIPHERTEXT_MESSAGE_CURRENT_VERSION } from "./constants.js";
import {
  type TripleRatchetSignalMessageProto,
  type TripleRatchetPreKeySignalMessageProto,
  encodeTripleRatchetSignalMessage,
  decodeTripleRatchetSignalMessage,
  encodeTripleRatchetPreKeySignalMessage,
  decodeTripleRatchetPreKeySignalMessage,
} from "./proto.js";

// ---------------------------------------------------------------------------
// Constant-time comparison
// ---------------------------------------------------------------------------

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// MAC computation
//
// MAC = HMAC-SHA256(macKey, senderIdentity(33) || receiverIdentity(33) || message)[0:8]
// ---------------------------------------------------------------------------

function computeMac(
  senderIdentityKey: IdentityKey,
  receiverIdentityKey: IdentityKey,
  macKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  if (macKey.length !== 32) {
    throw new TripleRatchetError(
      `Invalid MAC key length: ${macKey.length}, expected 32`,
      TripleRatchetErrorCode.InvalidMessage,
    );
  }

  const senderSerialized = senderIdentityKey.serialize(); // 33 bytes
  const receiverSerialized = receiverIdentityKey.serialize(); // 33 bytes

  const macInput = new Uint8Array(
    senderSerialized.length + receiverSerialized.length + message.length,
  );
  macInput.set(senderSerialized, 0);
  macInput.set(receiverSerialized, senderSerialized.length);
  macInput.set(message, senderSerialized.length + receiverSerialized.length);

  const fullMac = hmacSha256(macKey, macInput);
  return fullMac.slice(0, MAC_LENGTH);
}

// ---------------------------------------------------------------------------
// TripleRatchetSignalMessage
// ---------------------------------------------------------------------------

export class TripleRatchetSignalMessage {
  readonly messageVersion: number;
  readonly senderRatchetKey: Uint8Array;
  readonly counter: number;
  readonly previousCounter: number;
  readonly ciphertext: Uint8Array;
  readonly serialized: Uint8Array;

  private readonly _pqRatchet: Uint8Array | undefined;

  private constructor(
    messageVersion: number,
    senderRatchetKey: Uint8Array,
    counter: number,
    previousCounter: number,
    ciphertext: Uint8Array,
    serialized: Uint8Array,
    pqRatchet: Uint8Array | undefined,
  ) {
    this.messageVersion = messageVersion;
    this.senderRatchetKey = senderRatchetKey;
    this.counter = counter;
    this.previousCounter = previousCounter;
    this.ciphertext = ciphertext;
    this.serialized = serialized;
    this._pqRatchet = pqRatchet;
  }

  /** SPQR ratchet message bytes, or undefined if not present. */
  get pqRatchet(): Uint8Array | undefined {
    return this._pqRatchet;
  }

  /**
   * Create a new TripleRatchetSignalMessage with computed MAC.
   *
   * @param messageVersion - Protocol version (4 for triple ratchet)
   * @param macKey - 32-byte MAC key from MessageKeys
   * @param senderRatchetKey - 32-byte sender ephemeral public key
   * @param counter - Current chain key index
   * @param previousCounter - Previous chain counter
   * @param ciphertext - AES-256-CBC encrypted message body
   * @param senderIdentityKey - Sender's identity key
   * @param receiverIdentityKey - Receiver's identity key
   * @param pqRatchet - SPQR ratchet message bytes (omitted from wire when undefined/empty)
   */
  static create(
    messageVersion: number,
    macKey: Uint8Array,
    senderRatchetKey: Uint8Array,
    counter: number,
    previousCounter: number,
    ciphertext: Uint8Array,
    senderIdentityKey: IdentityKey,
    receiverIdentityKey: IdentityKey,
    pqRatchet: Uint8Array | undefined,
  ): TripleRatchetSignalMessage {
    // Serialize ratchet key with 0x05 prefix (33 bytes on wire)
    const serializedRatchetKey = new Uint8Array(33);
    serializedRatchetKey[0] = 0x05;
    serializedRatchetKey.set(senderRatchetKey, 1);

    const proto: TripleRatchetSignalMessageProto = {
      ratchetKey: serializedRatchetKey,
      counter,
      previousCounter,
      ciphertext,
    };
    if (pqRatchet != null && pqRatchet.length > 0) {
      proto.pqRatchet = pqRatchet;
    }
    const protoEncoded = encodeTripleRatchetSignalMessage(proto);

    // version_byte = (messageVersion << 4) | CURRENT_VERSION
    const versionByte = ((messageVersion & 0xf) << 4) | CIPHERTEXT_MESSAGE_CURRENT_VERSION;
    const messageContent = new Uint8Array(1 + protoEncoded.length);
    messageContent[0] = versionByte;
    messageContent.set(protoEncoded, 1);

    const mac = computeMac(senderIdentityKey, receiverIdentityKey, macKey, messageContent);

    const serialized = new Uint8Array(messageContent.length + MAC_LENGTH);
    serialized.set(messageContent);
    serialized.set(mac, messageContent.length);

    return new TripleRatchetSignalMessage(
      messageVersion,
      senderRatchetKey,
      counter,
      previousCounter,
      ciphertext,
      serialized,
      pqRatchet != null && pqRatchet.length > 0 ? pqRatchet : undefined,
    );
  }

  /** Deserialize a TripleRatchetSignalMessage from wire bytes. */
  static deserialize(data: Uint8Array): TripleRatchetSignalMessage {
    if (data.length < MAC_LENGTH + 1) {
      throw new TripleRatchetError(
        `Message too short: ${data.length} bytes`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    const messageVersion = data[0] >> 4;
    if (messageVersion < CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new TripleRatchetError(
        `Legacy ciphertext version: ${messageVersion}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }
    if (messageVersion > CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new TripleRatchetError(
        `Unrecognized ciphertext version: ${messageVersion}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    const protoData = data.slice(1, data.length - MAC_LENGTH);
    const proto = decodeTripleRatchetSignalMessage(protoData);

    if (proto.ratchetKey == null) {
      throw new TripleRatchetError("Missing ratchet key", TripleRatchetErrorCode.InvalidMessage);
    }
    if (proto.counter === undefined) {
      throw new TripleRatchetError("Missing counter", TripleRatchetErrorCode.InvalidMessage);
    }
    if (proto.ciphertext == null) {
      throw new TripleRatchetError("Missing ciphertext", TripleRatchetErrorCode.InvalidMessage);
    }

    // Strip 0x05 prefix from ratchet key
    let senderRatchetKey: Uint8Array;
    if (proto.ratchetKey.length === 33 && proto.ratchetKey[0] === 0x05) {
      senderRatchetKey = proto.ratchetKey.slice(1);
    } else if (proto.ratchetKey.length === 32) {
      senderRatchetKey = proto.ratchetKey;
    } else {
      throw new TripleRatchetError(
        `Invalid ratchet key length: ${proto.ratchetKey.length}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    const pqRatchet =
      proto.pqRatchet != null && proto.pqRatchet.length > 0 ? proto.pqRatchet : undefined;

    return new TripleRatchetSignalMessage(
      messageVersion,
      senderRatchetKey,
      proto.counter,
      proto.previousCounter ?? 0,
      proto.ciphertext,
      Uint8Array.from(data),
      pqRatchet,
    );
  }

  /**
   * Verify the 8-byte truncated HMAC-SHA256 MAC.
   *
   * MAC = HMAC-SHA256(macKey, senderIdentity(33) || receiverIdentity(33) || content)[0:8]
   */
  verifyMac(
    senderIdentityKey: IdentityKey,
    receiverIdentityKey: IdentityKey,
    macKey: Uint8Array,
  ): boolean {
    const content = this.serialized.slice(0, this.serialized.length - MAC_LENGTH);
    const theirMac = this.serialized.slice(this.serialized.length - MAC_LENGTH);
    const ourMac = computeMac(senderIdentityKey, receiverIdentityKey, macKey, content);
    return constantTimeEqual(ourMac, theirMac);
  }
}

// ---------------------------------------------------------------------------
// TripleRatchetPreKeySignalMessage
// ---------------------------------------------------------------------------

export class TripleRatchetPreKeySignalMessage {
  readonly messageVersion: number;
  readonly registrationId: number;
  readonly preKeyId: number | undefined;
  readonly signedPreKeyId: number;
  readonly baseKey: Uint8Array;
  readonly identityKey: Uint8Array; // 33-byte serialized identity key
  readonly message: TripleRatchetSignalMessage;
  readonly serialized: Uint8Array;

  private readonly _kyberPreKeyId: number | undefined;
  private readonly _kyberCiphertext: Uint8Array | undefined;

  private constructor(
    messageVersion: number,
    registrationId: number,
    preKeyId: number | undefined,
    signedPreKeyId: number,
    baseKey: Uint8Array,
    identityKey: Uint8Array,
    message: TripleRatchetSignalMessage,
    serialized: Uint8Array,
    kyberPreKeyId: number | undefined,
    kyberCiphertext: Uint8Array | undefined,
  ) {
    this.messageVersion = messageVersion;
    this.registrationId = registrationId;
    this.preKeyId = preKeyId;
    this.signedPreKeyId = signedPreKeyId;
    this.baseKey = baseKey;
    this.identityKey = identityKey;
    this.message = message;
    this.serialized = serialized;
    this._kyberPreKeyId = kyberPreKeyId;
    this._kyberCiphertext = kyberCiphertext;
  }

  /** ML-KEM pre-key ID, or undefined if not present. */
  get kyberPreKeyId(): number | undefined {
    return this._kyberPreKeyId;
  }

  /** ML-KEM encapsulation ciphertext, or undefined if not present. */
  get kyberCiphertext(): Uint8Array | undefined {
    return this._kyberCiphertext;
  }

  /**
   * Create a new TripleRatchetPreKeySignalMessage.
   *
   * @param messageVersion - Protocol version (4)
   * @param registrationId - Sender registration ID
   * @param preKeyId - One-time EC pre-key ID (optional)
   * @param signedPreKeyId - Signed EC pre-key ID
   * @param baseKey - 32-byte ephemeral base key
   * @param identityKey - 33-byte serialized sender identity key (0x05 prefix)
   * @param message - Embedded TripleRatchetSignalMessage
   * @param kyberPreKeyId - ML-KEM pre-key ID (optional)
   * @param kyberCiphertext - ML-KEM encapsulation ciphertext (optional)
   */
  static create(
    messageVersion: number,
    registrationId: number,
    preKeyId: number | undefined,
    signedPreKeyId: number,
    baseKey: Uint8Array,
    identityKey: Uint8Array,
    message: TripleRatchetSignalMessage,
    kyberPreKeyId: number | undefined,
    kyberCiphertext: Uint8Array | undefined,
  ): TripleRatchetPreKeySignalMessage {
    // Serialize baseKey with 0x05 prefix (33 bytes on wire)
    const serializedBaseKey = new Uint8Array(33);
    serializedBaseKey[0] = 0x05;
    serializedBaseKey.set(baseKey, 1);

    const proto: TripleRatchetPreKeySignalMessageProto = {
      registrationId,
      signedPreKeyId,
      baseKey: serializedBaseKey,
      identityKey,
      message: message.serialized,
    };
    if (preKeyId !== undefined) {
      proto.preKeyId = preKeyId;
    }
    if (kyberPreKeyId !== undefined) {
      proto.kyberPreKeyId = kyberPreKeyId;
    }
    if (kyberCiphertext != null) {
      proto.kyberCiphertext = kyberCiphertext;
    }

    const protoEncoded = encodeTripleRatchetPreKeySignalMessage(proto);

    // version_byte = (messageVersion << 4) | CURRENT_VERSION
    const versionByte = ((messageVersion & 0xf) << 4) | CIPHERTEXT_MESSAGE_CURRENT_VERSION;
    const serialized = new Uint8Array(1 + protoEncoded.length);
    serialized[0] = versionByte;
    serialized.set(protoEncoded, 1);

    return new TripleRatchetPreKeySignalMessage(
      messageVersion,
      registrationId,
      preKeyId,
      signedPreKeyId,
      baseKey,
      identityKey,
      message,
      serialized,
      kyberPreKeyId,
      kyberCiphertext,
    );
  }

  /** Deserialize a TripleRatchetPreKeySignalMessage from wire bytes. */
  static deserialize(data: Uint8Array): TripleRatchetPreKeySignalMessage {
    if (data.length === 0) {
      throw new TripleRatchetError(
        "Empty TripleRatchetPreKeySignalMessage",
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    const messageVersion = data[0] >> 4;
    if (messageVersion < CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new TripleRatchetError(
        `Legacy ciphertext version: ${messageVersion}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }
    if (messageVersion > CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new TripleRatchetError(
        `Unrecognized ciphertext version: ${messageVersion}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    const proto = decodeTripleRatchetPreKeySignalMessage(data.slice(1));

    if (proto.baseKey == null) {
      throw new TripleRatchetError("Missing base key", TripleRatchetErrorCode.InvalidMessage);
    }
    if (proto.identityKey == null) {
      throw new TripleRatchetError("Missing identity key", TripleRatchetErrorCode.InvalidMessage);
    }
    if (proto.message == null) {
      throw new TripleRatchetError(
        "Missing embedded message",
        TripleRatchetErrorCode.InvalidMessage,
      );
    }
    if (proto.signedPreKeyId === undefined) {
      throw new TripleRatchetError(
        "Missing signed pre key ID",
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    // Strip 0x05 prefix from baseKey
    let baseKey: Uint8Array;
    if (proto.baseKey.length === 33 && proto.baseKey[0] === 0x05) {
      baseKey = proto.baseKey.slice(1);
    } else if (proto.baseKey.length === 32) {
      baseKey = proto.baseKey;
    } else {
      throw new TripleRatchetError(
        `Invalid base key length: ${proto.baseKey.length}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    // Validate kyber fields: for v4, both must be present or both absent
    if (
      messageVersion >= 4 &&
      (proto.kyberPreKeyId === undefined) !== (proto.kyberCiphertext == null)
    ) {
      throw new TripleRatchetError(
        "Kyber fields must be both present or both absent",
        TripleRatchetErrorCode.InvalidMessage,
      );
    }

    const embeddedMessage = TripleRatchetSignalMessage.deserialize(proto.message);

    return new TripleRatchetPreKeySignalMessage(
      messageVersion,
      proto.registrationId ?? 0,
      proto.preKeyId,
      proto.signedPreKeyId,
      baseKey,
      proto.identityKey,
      embeddedMessage,
      Uint8Array.from(data),
      proto.kyberPreKeyId,
      proto.kyberCiphertext,
    );
  }
}
