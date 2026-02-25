/**
 * SignalMessage — the core encrypted message on the wire.
 *
 * Wire format: [version_byte][protobuf_encoded][mac_8_bytes]
 * version_byte = (message_version << 4) | CURRENT_VERSION
 *
 * Reference: libsignal/rust/protocol/src/protocol.rs (SignalMessage)
 */

import { hmacSha256 } from "../crypto/kdf.js";
import { IdentityKey } from "../keys/identity-key.js";
import { InvalidMessageError, InvalidMacKeyLengthError } from "../error.js";
import {
  MAC_LENGTH,
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
} from "../constants.js";
import { encodeSignalMessage, decodeSignalMessage } from "./proto.js";
import { constantTimeEqual } from "../crypto/constant-time.js";
import {
  CiphertextMessageType,
  type CiphertextMessage,
  type CiphertextMessageConvertible,
} from "./ciphertext-message.js";

export class SignalMessage implements CiphertextMessageConvertible {
  readonly messageVersion: number;
  readonly senderRatchetKey: Uint8Array;
  readonly counter: number;
  readonly previousCounter: number;
  readonly ciphertext: Uint8Array;
  readonly serialized: Uint8Array;

  private constructor(
    messageVersion: number,
    senderRatchetKey: Uint8Array,
    counter: number,
    previousCounter: number,
    ciphertext: Uint8Array,
    serialized: Uint8Array,
  ) {
    this.messageVersion = messageVersion;
    this.senderRatchetKey = senderRatchetKey;
    this.counter = counter;
    this.previousCounter = previousCounter;
    this.ciphertext = ciphertext;
    this.serialized = serialized;
  }

  /**
   * Create a new SignalMessage with computed MAC.
   *
   * @param messageVersion - Protocol version (3)
   * @param macKey - 32-byte MAC key from MessageKeys
   * @param senderRatchetKey - 32-byte sender ephemeral public key
   * @param counter - Current chain key index
   * @param previousCounter - Previous chain counter (for receiver)
   * @param ciphertext - AES-256-CBC encrypted message body
   * @param senderIdentityKey - Sender's identity key
   * @param receiverIdentityKey - Receiver's identity key
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
  ): SignalMessage {
    // Serialize the ratchet key with 0x05 prefix (33 bytes on wire)
    const serializedRatchetKey = new Uint8Array(33);
    serializedRatchetKey[0] = 0x05;
    serializedRatchetKey.set(senderRatchetKey, 1);

    const protoEncoded = encodeSignalMessage({
      ratchetKey: serializedRatchetKey,
      counter,
      previousCounter,
      ciphertext,
    });

    // Build version byte: (sessionVersion << 4) | CURRENT_VERSION
    // Matches libsignal: ((message_version & 0xF) << 4) | CIPHERTEXT_MESSAGE_CURRENT_VERSION
    const versionByte = ((messageVersion & 0xf) << 4) | CIPHERTEXT_MESSAGE_CURRENT_VERSION;
    const messageContent = new Uint8Array(1 + protoEncoded.length);
    messageContent[0] = versionByte;
    messageContent.set(protoEncoded, 1);

    // Compute MAC
    const mac = SignalMessage.computeMac(
      senderIdentityKey,
      receiverIdentityKey,
      macKey,
      messageContent,
    );

    // Final serialized: version + proto + 8-byte MAC
    const serialized = new Uint8Array(messageContent.length + MAC_LENGTH);
    serialized.set(messageContent);
    serialized.set(mac, messageContent.length);

    return new SignalMessage(
      messageVersion,
      senderRatchetKey,
      counter,
      previousCounter,
      ciphertext,
      serialized,
    );
  }

  /**
   * Deserialize a SignalMessage from wire bytes.
   */
  static deserialize(data: Uint8Array): SignalMessage {
    if (data.length < MAC_LENGTH + 1) {
      throw new InvalidMessageError(`Message too short: ${data.length} bytes`);
    }

    const messageVersion = data[0] >> 4;
    if (messageVersion < CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new InvalidMessageError(`Legacy ciphertext version: ${messageVersion}`);
    }
    if (messageVersion > CIPHERTEXT_MESSAGE_CURRENT_VERSION) {
      throw new InvalidMessageError(`Unrecognized ciphertext version: ${messageVersion}`);
    }

    const protoData = data.slice(1, data.length - MAC_LENGTH);
    const proto = decodeSignalMessage(protoData);

    if (!proto.ratchetKey) {
      throw new InvalidMessageError("Missing ratchet key");
    }
    if (proto.counter === undefined) {
      throw new InvalidMessageError("Missing counter");
    }
    if (!proto.ciphertext) {
      throw new InvalidMessageError("Missing ciphertext");
    }

    // Strip the 0x05 prefix from the ratchet key
    let senderRatchetKey: Uint8Array;
    if (proto.ratchetKey.length === 33 && proto.ratchetKey[0] === 0x05) {
      senderRatchetKey = proto.ratchetKey.slice(1);
    } else if (proto.ratchetKey.length === 32) {
      senderRatchetKey = proto.ratchetKey;
    } else {
      throw new InvalidMessageError(`Invalid ratchet key length: ${proto.ratchetKey.length}`);
    }

    return new SignalMessage(
      messageVersion,
      senderRatchetKey,
      proto.counter,
      proto.previousCounter ?? 0,
      proto.ciphertext,
      Uint8Array.from(data),
    );
  }

  /**
   * Verify the 8-byte truncated HMAC-SHA256 MAC.
   */
  verifyMac(
    senderIdentityKey: IdentityKey,
    receiverIdentityKey: IdentityKey,
    macKey: Uint8Array,
  ): boolean {
    const content = this.serialized.slice(0, this.serialized.length - MAC_LENGTH);
    const theirMac = this.serialized.slice(this.serialized.length - MAC_LENGTH);
    const ourMac = SignalMessage.computeMac(
      senderIdentityKey,
      receiverIdentityKey,
      macKey,
      content,
    );
    return constantTimeEqual(ourMac, theirMac);
  }

  /**
   * Return this message wrapped as a CiphertextMessage with type Whisper.
   * Matches libsignal's CiphertextMessageConvertible interface.
   */
  asCiphertextMessage(): CiphertextMessage {
    return { type: CiphertextMessageType.Whisper, message: this };
  }

  /**
   * Compute the 8-byte truncated HMAC-SHA256 MAC.
   *
   * MAC = HMAC-SHA256(macKey, senderIdentity(33) || receiverIdentity(33) || message)[0:8]
   */
  private static computeMac(
    senderIdentityKey: IdentityKey,
    receiverIdentityKey: IdentityKey,
    macKey: Uint8Array,
    message: Uint8Array,
  ): Uint8Array {
    if (macKey.length !== 32) {
      throw new InvalidMacKeyLengthError(macKey.length);
    }

    const senderSerialized = senderIdentityKey.serialize();
    const receiverSerialized = receiverIdentityKey.serialize();

    const macInput = new Uint8Array(
      senderSerialized.length + receiverSerialized.length + message.length,
    );
    macInput.set(senderSerialized, 0);
    macInput.set(receiverSerialized, senderSerialized.length);
    macInput.set(message, senderSerialized.length + receiverSerialized.length);

    const fullMac = hmacSha256(macKey, macInput);
    return fullMac.slice(0, MAC_LENGTH);
  }
}
