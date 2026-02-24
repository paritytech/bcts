/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Sealed message for anonymous authenticated encryption
 *
 * A `SealedMessage` combines key encapsulation with symmetric encryption to
 * provide anonymous authenticated encryption. The sender's identity is not
 * revealed, and only the intended recipient can decrypt the message.
 *
 * The sealing process:
 * 1. Encapsulate a new shared secret using the recipient's public key
 * 2. Use the shared secret to encrypt the plaintext with ChaCha20-Poly1305
 * 3. Return the encrypted message and the encapsulation ciphertext
 *
 * The unsealing process:
 * 1. Decapsulate the shared secret using the recipient's private key
 * 2. Use the shared secret to decrypt the ciphertext
 * 3. Return the plaintext
 *
 * Features:
 * - Anonymous sender (sender identity not revealed)
 * - Authenticated encryption
 * - Forward secrecy (each message uses different ephemeral key)
 *
 * # CBOR Serialization
 *
 * `SealedMessage` is serialized as a 2-element array with tag 40019:
 *
 * ```cddl
 * SealedMessage = #6.40019([
 *   message: EncryptedMessage,
 *   encapsulated_key: EncapsulationCiphertext
 * ])
 * ```
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `SealedMessage` is
 * represented with the type "crypto-sealed".
 *
 * Ported from bc-components-rust/src/encapsulation/sealed_message.rs
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  expectArray,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { SEALED_MESSAGE as TAG_SEALED_MESSAGE } from "@bcts/tags";
import { Nonce } from "../nonce.js";
import { EncryptedMessage } from "../symmetric/encrypted-message.js";
import { type EncapsulationScheme } from "./encapsulation-scheme.js";
import { EncapsulationCiphertext } from "./encapsulation-ciphertext.js";
import { type EncapsulationPublicKey } from "./encapsulation-public-key.js";
import { type EncapsulationPrivateKey } from "./encapsulation-private-key.js";
import { X25519PublicKey } from "../x25519/x25519-public-key.js";
import { bytesToHex } from "../utils.js";

/**
 * A sealed message providing anonymous authenticated encryption.
 */
export class SealedMessage
  implements CborTaggedEncodable, CborTaggedDecodable<SealedMessage>, UREncodable
{
  private readonly _message: EncryptedMessage;
  private readonly _encapsulatedKey: EncapsulationCiphertext;

  private constructor(message: EncryptedMessage, encapsulatedKey: EncapsulationCiphertext) {
    this._message = message;
    this._encapsulatedKey = encapsulatedKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a SealedMessage from its components.
   */
  static from(message: EncryptedMessage, encapsulatedKey: EncapsulationCiphertext): SealedMessage {
    return new SealedMessage(message, encapsulatedKey);
  }

  /**
   * Seal a message for a recipient (no additional authenticated data).
   *
   * @param plaintext - The message to encrypt
   * @param recipient - The recipient's public key
   * @returns A sealed message that only the recipient can decrypt
   */
  static new(plaintext: Uint8Array, recipient: EncapsulationPublicKey): SealedMessage {
    return SealedMessage.newWithAad(plaintext, recipient, new Uint8Array(0));
  }

  /**
   * Seal a message for a recipient with additional authenticated data.
   *
   * @param plaintext - The message to encrypt
   * @param recipient - The recipient's public key
   * @param aad - Additional authenticated data (not encrypted but authenticated)
   * @returns A sealed message that only the recipient can decrypt
   */
  static newWithAad(
    plaintext: Uint8Array,
    recipient: EncapsulationPublicKey,
    aad: Uint8Array,
  ): SealedMessage {
    return SealedMessage.newOpt(plaintext, recipient, aad, undefined);
  }

  /**
   * Seal a message with optional test nonce (for deterministic testing).
   *
   * @param plaintext - The message to encrypt
   * @param recipient - The recipient's public key
   * @param aad - Additional authenticated data
   * @param testNonce - Optional fixed nonce for testing (DO NOT use in production)
   * @returns A sealed message
   */
  static newOpt(
    plaintext: Uint8Array,
    recipient: EncapsulationPublicKey,
    aad: Uint8Array,
    testNonce?: Nonce,
  ): SealedMessage {
    // Encapsulate a new shared secret
    const [sharedSecret, ciphertext] = recipient.encapsulateNewSharedSecret();

    // Use the nonce or generate a random one
    const nonce = testNonce ?? Nonce.new();

    // Encrypt the plaintext using the shared secret
    const encryptedMessage = sharedSecret.encrypt(plaintext, aad, nonce);

    return new SealedMessage(encryptedMessage, ciphertext);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the encrypted message.
   */
  message(): EncryptedMessage {
    return this._message;
  }

  /**
   * Returns the encapsulation ciphertext (ephemeral public key for X25519).
   */
  encapsulatedKey(): EncapsulationCiphertext {
    return this._encapsulatedKey;
  }

  /**
   * Returns the encapsulation scheme used.
   */
  encapsulationScheme(): EncapsulationScheme {
    return this._encapsulatedKey.encapsulationScheme();
  }

  /**
   * Decrypt the sealed message using the recipient's private key.
   *
   * @param privateKey - The recipient's private key
   * @returns The decrypted plaintext
   * @throws Error if decryption fails
   */
  decrypt(privateKey: EncapsulationPrivateKey): Uint8Array {
    // Decapsulate the shared secret
    const sharedSecret = privateKey.decapsulateSharedSecret(this._encapsulatedKey);

    // Decrypt the message
    return sharedSecret.decrypt(this._message);
  }

  /**
   * Compare with another SealedMessage.
   */
  equals(other: SealedMessage): boolean {
    return (
      this._message.equals(other._message) && this._encapsulatedKey.equals(other._encapsulatedKey)
    );
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `SealedMessage(${this._encapsulatedKey.encapsulationScheme()}, ciphertext: ${bytesToHex(this._message.ciphertext()).substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with SealedMessage.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SEALED_MESSAGE.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   * Format: [EncryptedMessage (tagged), EncapsulationCiphertext (tagged)]
   */
  untaggedCbor(): Cbor {
    const elements: Cbor[] = [this._message.taggedCbor(), this._encapsulatedKey.taggedCbor()];
    return cbor(elements);
  }

  /**
   * Returns the tagged CBOR encoding.
   */
  taggedCbor(): Cbor {
    return createTaggedCbor(this);
  }

  /**
   * Returns the tagged value in CBOR binary representation.
   */
  taggedCborData(): Uint8Array {
    return this.taggedCbor().toData();
  }

  // ============================================================================
  // CBOR Deserialization (CborTaggedDecodable)
  // ============================================================================

  /**
   * Creates a SealedMessage by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): SealedMessage {
    const elements = expectArray(cborValue);

    if (elements.length !== 2) {
      throw new Error(`SealedMessage must have 2 elements, got ${elements.length}`);
    }

    // Decode the encrypted message (tagged)
    const message = EncryptedMessage.fromTaggedCbor(elements[0]);

    // Decode the encapsulation ciphertext (tagged)
    const encapsulatedKey = EncapsulationCiphertext.fromTaggedCbor(elements[1]);

    return new SealedMessage(message, encapsulatedKey);
  }

  /**
   * Creates a SealedMessage by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): SealedMessage {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): SealedMessage {
    const dummyMessage = EncryptedMessage.new(
      new Uint8Array(0),
      new Uint8Array(0),
      Nonce.new(),
      new Uint8Array(16),
    );
    const dummyCiphertext = EncapsulationCiphertext.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
    );
    const dummy = new SealedMessage(dummyMessage, dummyCiphertext);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): SealedMessage {
    const cborValue = decodeCbor(data);
    return SealedMessage.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): SealedMessage {
    const cborValue = decodeCbor(data);
    const dummyMessage = EncryptedMessage.new(
      new Uint8Array(0),
      new Uint8Array(0),
      Nonce.new(),
      new Uint8Array(16),
    );
    const dummyCiphertext = EncapsulationCiphertext.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
    );
    const dummy = new SealedMessage(dummyMessage, dummyCiphertext);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the SealedMessage.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    const name = TAG_SEALED_MESSAGE.name;
    if (name === undefined) {
      throw new Error("TAG_SEALED_MESSAGE.name is undefined");
    }
    return UR.new(name, this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a SealedMessage from a UR.
   */
  static fromUR(ur: UR): SealedMessage {
    const name = TAG_SEALED_MESSAGE.name;
    if (name === undefined) {
      throw new Error("TAG_SEALED_MESSAGE.name is undefined");
    }
    ur.checkType(name);
    return SealedMessage.fromUntaggedCborData(ur.cbor().toData());
  }

  /**
   * Creates a SealedMessage from a UR string.
   */
  static fromURString(urString: string): SealedMessage {
    const ur = UR.fromURString(urString);
    return SealedMessage.fromUR(ur);
  }
}
