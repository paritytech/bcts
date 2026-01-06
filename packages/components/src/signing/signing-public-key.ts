/**
 * A public key used for verifying digital signatures.
 *
 * `SigningPublicKey` is a type representing different types of signing public
 * keys. Supports Schnorr, ECDSA, Ed25519, and SR25519.
 *
 * This type implements the `Verifier` interface, allowing it to verify signatures.
 *
 * # CBOR Serialization
 *
 * `SigningPublicKey` is serialized to CBOR with tag 40022.
 *
 * The CBOR encoding:
 * - Schnorr: `#6.40022([0, h'<32-byte-x-only-public-key>'])`
 * - ECDSA:   `#6.40022([1, h'<33-byte-compressed-public-key>'])`
 * - Ed25519: `#6.40022([2, h'<32-byte-public-key>'])`
 * - Sr25519: `#6.40022([3, h'<32-byte-public-key>'])`
 *
 * Ported from bc-components-rust/src/signing/signing_public_key.rs
 */

import { ED25519_PUBLIC_KEY_SIZE, ECDSA_PUBLIC_KEY_SIZE, SCHNORR_PUBLIC_KEY_SIZE } from "@bcts/crypto";
import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  toByteString,
  expectArray,
  expectBytes,
  expectUnsigned,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { SIGNING_PUBLIC_KEY as TAG_SIGNING_PUBLIC_KEY } from "@bcts/tags";
import { Ed25519PublicKey } from "../ed25519/ed25519-public-key.js";
import { Sr25519PublicKey } from "../sr25519/sr25519-public-key.js";
import { ECPublicKey } from "../ec-key/ec-public-key.js";
import { SchnorrPublicKey } from "../ec-key/schnorr-public-key.js";
import { SignatureScheme } from "./signature-scheme.js";
import type { Signature } from "./signature.js";
import type { Verifier } from "./signer.js";

/**
 * A public key used for verifying digital signatures.
 *
 * Currently supports:
 * - Schnorr public keys (32 bytes, x-only) - discriminator 0
 * - ECDSA public keys (33 bytes, compressed) - discriminator 1
 * - Ed25519 public keys (32 bytes) - discriminator 2
 * - Sr25519 public keys (32 bytes) - discriminator 3
 */
export class SigningPublicKey
  implements Verifier, CborTaggedEncodable, CborTaggedDecodable<SigningPublicKey>
{
  private readonly _type: SignatureScheme;
  private readonly _schnorrKey: SchnorrPublicKey | undefined;
  private readonly _ecdsaKey: ECPublicKey | undefined;
  private readonly _ed25519Key: Ed25519PublicKey | undefined;
  private readonly _sr25519Key: Sr25519PublicKey | undefined;

  private constructor(
    type: SignatureScheme,
    schnorrKey?: SchnorrPublicKey,
    ecdsaKey?: ECPublicKey,
    ed25519Key?: Ed25519PublicKey,
    sr25519Key?: Sr25519PublicKey,
  ) {
    this._type = type;
    this._schnorrKey = schnorrKey;
    this._ecdsaKey = ecdsaKey;
    this._ed25519Key = ed25519Key;
    this._sr25519Key = sr25519Key;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new signing public key from a Schnorr (x-only) public key.
   *
   * @param key - A SchnorrPublicKey
   * @returns A new signing public key containing the Schnorr key
   */
  static fromSchnorr(key: SchnorrPublicKey): SigningPublicKey {
    return new SigningPublicKey(SignatureScheme.Schnorr, key, undefined, undefined, undefined);
  }

  /**
   * Creates a new signing public key from an ECDSA (compressed) public key.
   *
   * @param key - An ECPublicKey
   * @returns A new signing public key containing the ECDSA key
   */
  static fromEcdsa(key: ECPublicKey): SigningPublicKey {
    return new SigningPublicKey(SignatureScheme.Ecdsa, undefined, key, undefined, undefined);
  }

  /**
   * Creates a new signing public key from an Ed25519 public key.
   *
   * @param key - An Ed25519 public key
   * @returns A new signing public key containing the Ed25519 key
   */
  static fromEd25519(key: Ed25519PublicKey): SigningPublicKey {
    return new SigningPublicKey(SignatureScheme.Ed25519, undefined, undefined, key, undefined);
  }

  /**
   * Creates a new signing public key from an Sr25519 public key.
   *
   * @param key - An Sr25519 public key
   * @returns A new signing public key containing the Sr25519 key
   */
  static fromSr25519(key: Sr25519PublicKey): SigningPublicKey {
    return new SigningPublicKey(SignatureScheme.Sr25519, undefined, undefined, undefined, key);
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
   * Returns the underlying Schnorr public key if this is a Schnorr key.
   *
   * @returns The SchnorrPublicKey if this is a Schnorr key, null otherwise
   */
  toSchnorr(): SchnorrPublicKey | null {
    if (this._type === SignatureScheme.Schnorr && this._schnorrKey !== undefined) {
      return this._schnorrKey;
    }
    return null;
  }

  /**
   * Returns the underlying ECDSA public key if this is an ECDSA key.
   *
   * @returns The ECPublicKey if this is an ECDSA key, null otherwise
   */
  toEcdsa(): ECPublicKey | null {
    if (this._type === SignatureScheme.Ecdsa && this._ecdsaKey !== undefined) {
      return this._ecdsaKey;
    }
    return null;
  }

  /**
   * Returns the underlying Ed25519 public key if this is an Ed25519 key.
   *
   * @returns The Ed25519 public key if this is an Ed25519 key, null otherwise
   */
  toEd25519(): Ed25519PublicKey | null {
    if (this._type === SignatureScheme.Ed25519 && this._ed25519Key !== undefined) {
      return this._ed25519Key;
    }
    return null;
  }

  /**
   * Returns the underlying Sr25519 public key if this is an Sr25519 key.
   *
   * @returns The Sr25519 public key if this is an Sr25519 key, null otherwise
   */
  toSr25519(): Sr25519PublicKey | null {
    if (this._type === SignatureScheme.Sr25519 && this._sr25519Key !== undefined) {
      return this._sr25519Key;
    }
    return null;
  }

  /**
   * Checks if this is a Schnorr signing key.
   */
  isSchnorr(): boolean {
    return this._type === SignatureScheme.Schnorr;
  }

  /**
   * Checks if this is an ECDSA signing key.
   */
  isEcdsa(): boolean {
    return this._type === SignatureScheme.Ecdsa;
  }

  /**
   * Checks if this is an Ed25519 signing key.
   */
  isEd25519(): boolean {
    return this._type === SignatureScheme.Ed25519;
  }

  /**
   * Checks if this is an Sr25519 signing key.
   */
  isSr25519(): boolean {
    return this._type === SignatureScheme.Sr25519;
  }

  /**
   * Compare with another SigningPublicKey.
   */
  equals(other: SigningPublicKey): boolean {
    if (this._type !== other._type) return false;
    switch (this._type) {
      case SignatureScheme.Schnorr:
        if (this._schnorrKey === undefined || other._schnorrKey === undefined) return false;
        return this._schnorrKey.equals(other._schnorrKey);
      case SignatureScheme.Ecdsa:
        if (this._ecdsaKey === undefined || other._ecdsaKey === undefined) return false;
        return this._ecdsaKey.equals(other._ecdsaKey);
      case SignatureScheme.Ed25519:
        if (this._ed25519Key === undefined || other._ed25519Key === undefined) return false;
        return this._ed25519Key.equals(other._ed25519Key);
      case SignatureScheme.Sr25519:
        if (this._sr25519Key === undefined || other._sr25519Key === undefined) return false;
        return this._sr25519Key.equals(other._sr25519Key);
    }
  }

  /**
   * Get string representation.
   */
  toString(): string {
    switch (this._type) {
      case SignatureScheme.Schnorr:
        return `SigningPublicKey(${this._type}, ${this._schnorrKey?.toHex().substring(0, 16)}...)`;
      case SignatureScheme.Ecdsa:
        return `SigningPublicKey(${this._type}, ${this._ecdsaKey?.toHex().substring(0, 16)}...)`;
      case SignatureScheme.Ed25519:
        return `SigningPublicKey(${this._type}, ${this._ed25519Key?.toHex().substring(0, 16)}...)`;
      case SignatureScheme.Sr25519:
        return `SigningPublicKey(${this._type}, ${this._sr25519Key?.toHex().substring(0, 16)}...)`;
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
    // Check that signature scheme matches
    if (signature.scheme() !== this._type) {
      return false;
    }

    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._schnorrKey === undefined) {
          return false;
        }
        const sigData = signature.toSchnorr();
        if (sigData === null) {
          return false;
        }
        try {
          return this._schnorrKey.schnorrVerify(sigData, message);
        } catch {
          return false;
        }
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecdsaKey === undefined) {
          return false;
        }
        const sigData = signature.toEcdsa();
        if (sigData === null) {
          return false;
        }
        try {
          return this._ecdsaKey.verify(sigData, message);
        } catch {
          return false;
        }
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          return false;
        }
        const sigData = signature.toEd25519();
        if (sigData === null) {
          return false;
        }
        try {
          return this._ed25519Key.verify(message, sigData);
        } catch {
          return false;
        }
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          return false;
        }
        const sigData = signature.toSr25519();
        if (sigData === null) {
          return false;
        }
        try {
          return this._sr25519Key.verify(sigData, message);
        } catch {
          return false;
        }
      }
    }
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with SigningPublicKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SIGNING_PUBLIC_KEY.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format for Schnorr: [0, h'<32-byte-x-only-public-key>']
   * Format for ECDSA:   [1, h'<33-byte-compressed-public-key>']
   * Format for Ed25519: [2, h'<32-byte-public-key>']
   * Format for Sr25519: [3, h'<32-byte-public-key>']
   */
  untaggedCbor(): Cbor {
    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._schnorrKey === undefined) {
          throw new Error("Schnorr public key is missing");
        }
        return cbor([0, toByteString(this._schnorrKey.toData())]);
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecdsaKey === undefined) {
          throw new Error("ECDSA public key is missing");
        }
        return cbor([1, toByteString(this._ecdsaKey.toData())]);
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 public key is missing");
        }
        return cbor([2, toByteString(this._ed25519Key.toData())]);
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 public key is missing");
        }
        return cbor([3, toByteString(this._sr25519Key.toData())]);
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
   * Creates a SigningPublicKey by decoding it from untagged CBOR.
   *
   * Format:
   * - [0, h'<32-byte-key>'] for Schnorr
   * - [1, h'<33-byte-key>'] for ECDSA
   * - [2, h'<32-byte-key>'] for Ed25519
   * - [3, h'<32-byte-key>'] for Sr25519
   */
  fromUntaggedCbor(cborValue: Cbor): SigningPublicKey {
    const elements = expectArray(cborValue);

    if (elements.length !== 2) {
      throw new Error("SigningPublicKey must have 2 elements");
    }

    const discriminator = expectUnsigned(elements[0]);
    const keyData = expectBytes(elements[1]);

    switch (Number(discriminator)) {
      case 0: // Schnorr
        return SigningPublicKey.fromSchnorr(SchnorrPublicKey.from(keyData));
      case 1: // ECDSA
        return SigningPublicKey.fromEcdsa(ECPublicKey.from(keyData));
      case 2: // Ed25519
        return SigningPublicKey.fromEd25519(Ed25519PublicKey.from(keyData));
      case 3: // Sr25519
        return SigningPublicKey.fromSr25519(Sr25519PublicKey.from(keyData));
      default:
        throw new Error(`Unknown SigningPublicKey discriminator: ${discriminator}`);
    }
  }

  /**
   * Creates a SigningPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): SigningPublicKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): SigningPublicKey {
    // Create a dummy instance for accessing instance methods
    const dummy = new SigningPublicKey(
      SignatureScheme.Ed25519,
      Ed25519PublicKey.from(new Uint8Array(ED25519_PUBLIC_KEY_SIZE)),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): SigningPublicKey {
    const cborValue = decodeCbor(data);
    return SigningPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): SigningPublicKey {
    const cborValue = decodeCbor(data);
    const dummy = new SigningPublicKey(
      SignatureScheme.Ed25519,
      Ed25519PublicKey.from(new Uint8Array(ED25519_PUBLIC_KEY_SIZE)),
    );
    return dummy.fromUntaggedCbor(cborValue);
  }
}
