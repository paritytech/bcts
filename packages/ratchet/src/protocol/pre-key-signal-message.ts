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
import {
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
} from "../constants.js";
import { SignalMessage } from "./signal-message.js";
import {
  encodePreKeySignalMessage,
  decodePreKeySignalMessage,
} from "./proto.js";
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
  readonly kyberPreKeyId: number | undefined;
  readonly kyberCiphertext: Uint8Array | undefined;

  private constructor(
    messageVersion: number,
    registrationId: number,
    preKeyId: number | undefined,
    signedPreKeyId: number,
    baseKey: Uint8Array,
    identityKey: IdentityKey,
    message: SignalMessage,
    serialized: Uint8Array,
    kyberPreKeyId?: number,
    kyberCiphertext?: Uint8Array,
  ) {
    this.messageVersion = messageVersion;
    this.registrationId = registrationId;
    this.preKeyId = preKeyId;
    this.signedPreKeyId = signedPreKeyId;
    this.baseKey = baseKey;
    this.identityKey = identityKey;
    this.message = message;
    this.serialized = serialized;
    this.kyberPreKeyId = kyberPreKeyId;
    this.kyberCiphertext = kyberCiphertext;
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
    kyberPreKeyId?: number,
    kyberCiphertext?: Uint8Array,
  ): PreKeySignalMessage {
    // Serialize baseKey and identityKey with 0x05 prefix
    const serializedBaseKey = new Uint8Array(33);
    serializedBaseKey[0] = 0x05;
    serializedBaseKey.set(baseKey, 1);

    const protoEncoded = encodePreKeySignalMessage({
      registrationId,
      preKeyId,
      signedPreKeyId,
      baseKey: serializedBaseKey,
      identityKey: identityKey.serialize(),
      message: message.serialized,
      kyberPreKeyId,
      kyberCiphertext,
    });

    const versionByte =
      ((messageVersion & 0xf) << 4) | CIPHERTEXT_MESSAGE_CURRENT_VERSION;
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
      kyberPreKeyId,
      kyberCiphertext,
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
    if (messageVersion < CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION) {
      throw new InvalidMessageError(
        `Legacy ciphertext version: ${messageVersion}`,
      );
    }
    if (messageVersion > CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new InvalidMessageError(
        `Unrecognized ciphertext version: ${messageVersion}`,
      );
    }

    const proto = decodePreKeySignalMessage(data.slice(1));

    if (!proto.baseKey) {
      throw new InvalidMessageError("Missing base key");
    }
    if (!proto.identityKey) {
      throw new InvalidMessageError("Missing identity key");
    }
    if (!proto.message) {
      throw new InvalidMessageError("Missing embedded message");
    }
    if (proto.signedPreKeyId === undefined) {
      throw new InvalidMessageError("Missing signed pre key ID");
    }

    // Validate Kyber payload consistency (matches libsignal protocol.rs:421-439)
    const hasKyberId = proto.kyberPreKeyId !== undefined;
    const hasKyberCt = proto.kyberCiphertext !== undefined && proto.kyberCiphertext.length > 0;
    if (hasKyberId !== hasKyberCt) {
      throw new InvalidMessageError(
        "Both or neither kyber pre_key_id and kyber_ciphertext can be present",
      );
    }
    if (!hasKyberId && messageVersion > CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION) {
      throw new InvalidMessageError(
        "Kyber pre key must be present for this session version",
      );
    }

    // Strip 0x05 prefix from baseKey
    let baseKey: Uint8Array;
    if (proto.baseKey.length === 33 && proto.baseKey[0] === 0x05) {
      baseKey = proto.baseKey.slice(1);
    } else if (proto.baseKey.length === 32) {
      baseKey = proto.baseKey;
    } else {
      throw new InvalidMessageError(
        `Invalid base key length: ${proto.baseKey.length}`,
      );
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
      proto.kyberPreKeyId,
      proto.kyberCiphertext,
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
