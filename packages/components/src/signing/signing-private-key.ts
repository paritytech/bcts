/**
 * A private key used for creating digital signatures.
 *
 * `SigningPrivateKey` is a type representing different types of signing
 * private keys. Currently, only Ed25519 is implemented.
 *
 * This type implements the `Signer` interface, allowing it to create signatures.
 *
 * # CBOR Serialization
 *
 * `SigningPrivateKey` is serialized to CBOR with tag 40021.
 *
 * The CBOR encoding for Ed25519:
 * ```
 * #6.40021([2, h'<32-byte-private-key>'])
 * ```
 *
 * Ported from bc-components-rust/src/signing/signing_private_key.rs
 */

import { ED25519_PRIVATE_KEY_SIZE } from "@blockchain-commons/crypto";
import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  toByteString,
  toUnsigned,
  expectArray,
  expectBytes,
  expectUnsigned,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@blockchain-commons/dcbor";
import { SIGNING_PRIVATE_KEY as TAG_SIGNING_PRIVATE_KEY } from "@blockchain-commons/tags";
import { Ed25519PrivateKey } from "../ed25519/ed25519-private-key.js";
import { bytesToHex } from "../utils.js";
import { SignatureScheme } from "./signature-scheme.js";
import { Signature } from "./signature.js";
import { SigningPublicKey } from "./signing-public-key.js";
import type { Signer, Verifier } from "./signer.js";

/**
 * A private key used for creating digital signatures.
 *
 * Currently supports:
 * - Ed25519 private keys (32 bytes)
 */
export class SigningPrivateKey
  implements Signer, Verifier, CborTaggedEncodable, CborTaggedDecodable<SigningPrivateKey>
{
  private readonly _type: SignatureScheme;
  private readonly _ed25519Key?: Ed25519PrivateKey;

  private constructor(type: SignatureScheme, ed25519Key?: Ed25519PrivateKey) {
    this._type = type;
    this._ed25519Key = ed25519Key;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new Ed25519 signing private key from an Ed25519PrivateKey.
   *
   * @param key - The Ed25519 private key to use
   * @returns A new Ed25519 signing private key
   */
  static newEd25519(key: Ed25519PrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Ed25519, key);
  }

  /**
   * Creates a new random Ed25519 signing private key.
   *
   * @returns A new random Ed25519 signing private key
   */
  static random(): SigningPrivateKey {
    return SigningPrivateKey.newEd25519(Ed25519PrivateKey.random());
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the signature scheme of this key.
   */
  scheme(): SignatureScheme {
    return this._type;
  }

  /**
   * Returns the underlying Ed25519 private key if this is an Ed25519 key.
   *
   * @returns The Ed25519 private key if this is an Ed25519 key, null otherwise
   */
  toEd25519(): Ed25519PrivateKey | null {
    if (this._type === SignatureScheme.Ed25519 && this._ed25519Key) {
      return this._ed25519Key;
    }
    return null;
  }

  /**
   * Checks if this is an Ed25519 signing key.
   */
  isEd25519(): boolean {
    return this._type === SignatureScheme.Ed25519;
  }

  /**
   * Derives the corresponding public key for this private key.
   *
   * @returns The public key corresponding to this private key
   */
  publicKey(): SigningPublicKey {
    switch (this._type) {
      case SignatureScheme.Ed25519: {
        if (!this._ed25519Key) {
          throw new Error("Ed25519 private key is missing");
        }
        return SigningPublicKey.fromEd25519(this._ed25519Key.publicKey());
      }
    }
  }

  /**
   * Compare with another SigningPrivateKey.
   */
  equals(other: SigningPrivateKey): boolean {
    if (this._type !== other._type) return false;
    switch (this._type) {
      case SignatureScheme.Ed25519:
        if (!this._ed25519Key || !other._ed25519Key) return false;
        return this._ed25519Key.equals(other._ed25519Key);
    }
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `SigningPrivateKey(${this._type})`;
  }

  // ============================================================================
  // Signer Interface
  // ============================================================================

  /**
   * Signs a message using the appropriate algorithm based on the key type.
   *
   * @param message - The message to sign
   * @returns The digital signature
   */
  sign(message: Uint8Array): Signature {
    switch (this._type) {
      case SignatureScheme.Ed25519: {
        if (!this._ed25519Key) {
          throw new Error("Ed25519 private key is missing");
        }
        const sigData = this._ed25519Key.sign(message);
        return Signature.ed25519FromData(sigData);
      }
    }
  }

  // ============================================================================
  // Verifier Interface
  // ============================================================================

  /**
   * Verifies a signature against a message.
   *
   * @param signature - The signature to verify
   * @param message - The message that was allegedly signed
   * @returns `true` if the signature is valid, `false` otherwise
   */
  verify(signature: Signature, message: Uint8Array): boolean {
    return this.publicKey().verify(signature, message);
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with SigningPrivateKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SIGNING_PRIVATE_KEY.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format for Ed25519: [2, h'<32-byte-private-key>']
   */
  untaggedCbor(): Cbor {
    switch (this._type) {
      case SignatureScheme.Ed25519: {
        if (!this._ed25519Key) {
          throw new Error("Ed25519 private key is missing");
        }
        return cbor([toUnsigned(2), toByteString(this._ed25519Key.toData())]);
      }
    }
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
   * Creates a SigningPrivateKey by decoding it from untagged CBOR.
   *
   * Format:
   * - [2, h'<32-byte-key>'] for Ed25519
   */
  fromUntaggedCbor(cborValue: Cbor): SigningPrivateKey {
    const elements = expectArray(cborValue);

    if (elements.length !== 2) {
      throw new Error("SigningPrivateKey must have 2 elements");
    }

    const discriminator = expectUnsigned(elements[0]);
    const keyData = expectBytes(elements[1]);

    switch (Number(discriminator)) {
      case 2: // Ed25519
        return SigningPrivateKey.newEd25519(Ed25519PrivateKey.from(keyData));
      default:
        throw new Error(`Unknown SigningPrivateKey discriminator: ${discriminator}`);
    }
  }

  /**
   * Creates a SigningPrivateKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): SigningPrivateKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): SigningPrivateKey {
    // Create a dummy instance for accessing instance methods
    const dummy = new SigningPrivateKey(
      SignatureScheme.Ed25519,
      Ed25519PrivateKey.from(new Uint8Array(ED25519_PRIVATE_KEY_SIZE)),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): SigningPrivateKey {
    const cborValue = decodeCbor(data);
    return SigningPrivateKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): SigningPrivateKey {
    const cborValue = decodeCbor(data);
    const dummy = new SigningPrivateKey(
      SignatureScheme.Ed25519,
      Ed25519PrivateKey.from(new Uint8Array(ED25519_PRIVATE_KEY_SIZE)),
    );
    return dummy.fromUntaggedCbor(cborValue);
  }
}
