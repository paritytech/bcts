/**
 * PreKeySignalMessage — sent by Alice when initiating a new session.
 *
 * Contains an embedded SignalMessage plus the prekey material needed
 * for Bob to establish the session.
 *
 * Wire format: [version_byte][protobuf_encoded]
 *
 * Reference: libsignal/rust/protocol/src/protocol.rs (PreKeySignalMessage)
 */

import { IdentityKey } from "../keys/identity-key.js";
import { InvalidMessageError } from "../error.js";
import { CIPHERTEXT_MESSAGE_CURRENT_VERSION } from "../constants.js";
import { SignalMessage } from "./signal-message.js";
import { encodePreKeySignalMessage, decodePreKeySignalMessage } from "./proto.js";
import {
  CiphertextMessageType,
  type CiphertextMessage,
  type CiphertextMessageConvertible,
} from "./ciphertext-message.js";

export class PreKeySignalMessage implements CiphertextMessageConvertible {
  readonly messageVersion: number;
  readonly registrationId: number;
  readonly preKeyId: number | undefined;
  readonly signedPreKeyId: number;
  readonly baseKey: Uint8Array;
  readonly identityKey: IdentityKey;
  readonly message: SignalMessage;
  readonly serialized: Uint8Array;

  private constructor(
    messageVersion: number,
    registrationId: number,
    preKeyId: number | undefined,
    signedPreKeyId: number,
    baseKey: Uint8Array,
    identityKey: IdentityKey,
    message: SignalMessage,
    serialized: Uint8Array,
  ) {
    this.messageVersion = messageVersion;
    this.registrationId = registrationId;
    this.preKeyId = preKeyId;
    this.signedPreKeyId = signedPreKeyId;
    this.baseKey = baseKey;
    this.identityKey = identityKey;
    this.message = message;
    this.serialized = serialized;
  }

  /**
   * Create a new PreKeySignalMessage.
   */
  static create(
    messageVersion: number,
    registrationId: number,
    preKeyId: number | undefined,
    signedPreKeyId: number,
    baseKey: Uint8Array,
    identityKey: IdentityKey,
    message: SignalMessage,
  ): PreKeySignalMessage {
    // Serialize baseKey and identityKey with 0x05 prefix
    const serializedBaseKey = new Uint8Array(33);
    serializedBaseKey[0] = 0x05;
    serializedBaseKey.set(baseKey, 1);

    const proto: Parameters<typeof encodePreKeySignalMessage>[0] = {
      registrationId,
      signedPreKeyId,
      baseKey: serializedBaseKey,
      identityKey: identityKey.serialize(),
      message: message.serialized,
    };
    if (preKeyId !== undefined) {
      proto.preKeyId = preKeyId;
    }
    const protoEncoded = encodePreKeySignalMessage(proto);

    // Version byte: (sessionVersion << 4) | sessionVersion -> 0x33 for v3
    const versionByte = ((messageVersion & 0xf) << 4) | messageVersion;
    const serialized = new Uint8Array(1 + protoEncoded.length);
    serialized[0] = versionByte;
    serialized.set(protoEncoded, 1);

    return new PreKeySignalMessage(
      messageVersion,
      registrationId,
      preKeyId,
      signedPreKeyId,
      baseKey,
      identityKey,
      message,
      serialized,
    );
  }

  /**
   * Deserialize a PreKeySignalMessage from wire bytes.
   */
  static deserialize(data: Uint8Array): PreKeySignalMessage {
    if (data.length === 0) {
      throw new InvalidMessageError("Empty PreKeySignalMessage");
    }

    const messageVersion = data[0] >> 4;
    if (messageVersion < CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new InvalidMessageError(`Legacy ciphertext version: ${messageVersion}`);
    }
    if (messageVersion > CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new InvalidMessageError(`Unrecognized ciphertext version: ${messageVersion}`);
    }

    const proto = decodePreKeySignalMessage(data.slice(1));

    if (proto.baseKey == null) {
      throw new InvalidMessageError("Missing base key");
    }
    if (proto.identityKey == null) {
      throw new InvalidMessageError("Missing identity key");
    }
    if (proto.message == null) {
      throw new InvalidMessageError("Missing embedded message");
    }
    if (proto.signedPreKeyId === undefined) {
      throw new InvalidMessageError("Missing signed pre key ID");
    }

    // Strip 0x05 prefix from baseKey
    let baseKey: Uint8Array;
    if (proto.baseKey.length === 33 && proto.baseKey[0] === 0x05) {
      baseKey = proto.baseKey.slice(1);
    } else if (proto.baseKey.length === 32) {
      baseKey = proto.baseKey;
    } else {
      throw new InvalidMessageError(`Invalid base key length: ${proto.baseKey.length}`);
    }

    const identityKey = IdentityKey.deserialize(proto.identityKey);
    const message = SignalMessage.deserialize(proto.message);

    return new PreKeySignalMessage(
      messageVersion,
      proto.registrationId ?? 0,
      proto.preKeyId,
      proto.signedPreKeyId,
      baseKey,
      identityKey,
      message,
      Uint8Array.from(data),
    );
  }

  /**
   * Return this message wrapped as a CiphertextMessage with type PreKey.
   * Matches libsignal's CiphertextMessageConvertible interface.
   */
  asCiphertextMessage(): CiphertextMessage {
    return { type: CiphertextMessageType.PreKey, message: this };
  }
}
