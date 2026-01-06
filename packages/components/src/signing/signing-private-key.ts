/**
 * A private key used for creating digital signatures.
 *
 * `SigningPrivateKey` is a type representing different types of signing
 * private keys. Supports Schnorr, ECDSA, Ed25519, and SR25519.
 *
 * This type implements the `Signer` interface, allowing it to create signatures.
 *
 * # CBOR Serialization
 *
 * `SigningPrivateKey` is serialized to CBOR with tag 40021.
 *
 * The CBOR encoding:
 * - Schnorr: `#6.40021([0, h'<32-byte-private-key>'])`
 * - ECDSA:   `#6.40021([1, h'<32-byte-private-key>'])`
 * - Ed25519: `#6.40021([2, h'<32-byte-private-key>'])`
 * - SR25519: `#6.40021([3, h'<32-byte-seed>'])`
 *
 * Ported from bc-components-rust/src/signing/signing_private_key.rs
 */

import { ED25519_PRIVATE_KEY_SIZE, ECDSA_PRIVATE_KEY_SIZE } from "@bcts/crypto";
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
import { SIGNING_PRIVATE_KEY as TAG_SIGNING_PRIVATE_KEY } from "@bcts/tags";
import { Ed25519PrivateKey } from "../ed25519/ed25519-private-key.js";
import { Sr25519PrivateKey } from "../sr25519/sr25519-private-key.js";
import { ECPrivateKey } from "../ec-key/ec-private-key.js";
import { SignatureScheme } from "./signature-scheme.js";
import { Signature } from "./signature.js";
import { SigningPublicKey } from "./signing-public-key.js";
import type { Signer, Verifier } from "./signer.js";

/**
 * A private key used for creating digital signatures.
 *
 * Currently supports:
 * - Schnorr private keys (32 bytes, secp256k1) - discriminator 0
 * - ECDSA private keys (32 bytes, secp256k1) - discriminator 1
 * - Ed25519 private keys (32 bytes) - discriminator 2
 * - SR25519 private keys (32-byte seed) - discriminator 3
 */
export class SigningPrivateKey
  implements Signer, Verifier, CborTaggedEncodable, CborTaggedDecodable<SigningPrivateKey>
{
  private readonly _type: SignatureScheme;
  private readonly _ecKey: ECPrivateKey | undefined;
  private readonly _ed25519Key: Ed25519PrivateKey | undefined;
  private readonly _sr25519Key: Sr25519PrivateKey | undefined;

  private constructor(
    type: SignatureScheme,
    ecKey?: ECPrivateKey,
    ed25519Key?: Ed25519PrivateKey,
    sr25519Key?: Sr25519PrivateKey,
  ) {
    this._type = type;
    this._ecKey = ecKey;
    this._ed25519Key = ed25519Key;
    this._sr25519Key = sr25519Key;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new Schnorr signing private key from an ECPrivateKey.
   *
   * @param key - The EC private key to use for Schnorr signing
   * @returns A new Schnorr signing private key
   */
  static newSchnorr(key: ECPrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Schnorr, key, undefined, undefined);
  }

  /**
   * Creates a new ECDSA signing private key from an ECPrivateKey.
   *
   * @param key - The EC private key to use for ECDSA signing
   * @returns A new ECDSA signing private key
   */
  static newEcdsa(key: ECPrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Ecdsa, key, undefined, undefined);
  }

  /**
   * Creates a new Ed25519 signing private key from an Ed25519PrivateKey.
   *
   * @param key - The Ed25519 private key to use
   * @returns A new Ed25519 signing private key
   */
  static newEd25519(key: Ed25519PrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Ed25519, undefined, key, undefined);
  }

  /**
   * Creates a new SR25519 signing private key from an Sr25519PrivateKey.
   *
   * @param key - The SR25519 private key to use
   * @returns A new SR25519 signing private key
   */
  static newSr25519(key: Sr25519PrivateKey): SigningPrivateKey {
    return new SigningPrivateKey(SignatureScheme.Sr25519, undefined, undefined, key);
  }

  /**
   * Creates a new random Ed25519 signing private key.
   *
   * @returns A new random Ed25519 signing private key
   */
  static random(): SigningPrivateKey {
    return SigningPrivateKey.newEd25519(Ed25519PrivateKey.random());
  }

  /**
   * Creates a new random Schnorr signing private key.
   *
   * @returns A new random Schnorr signing private key
   */
  static randomSchnorr(): SigningPrivateKey {
    return SigningPrivateKey.newSchnorr(ECPrivateKey.random());
  }

  /**
   * Creates a new random ECDSA signing private key.
   *
   * @returns A new random ECDSA signing private key
   */
  static randomEcdsa(): SigningPrivateKey {
    return SigningPrivateKey.newEcdsa(ECPrivateKey.random());
  }

  /**
   * Creates a new random SR25519 signing private key.
   *
   * @returns A new random SR25519 signing private key
   */
  static randomSr25519(): SigningPrivateKey {
    return SigningPrivateKey.newSr25519(Sr25519PrivateKey.random());
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
   * Returns the underlying EC private key if this is a Schnorr or ECDSA key.
   *
   * @returns The EC private key if this is a Schnorr or ECDSA key, null otherwise
   */
  toEc(): ECPrivateKey | null {
    if ((this._type === SignatureScheme.Schnorr || this._type === SignatureScheme.Ecdsa) && this._ecKey !== undefined) {
      return this._ecKey;
    }
    return null;
  }

  /**
   * Returns the underlying Ed25519 private key if this is an Ed25519 key.
   *
   * @returns The Ed25519 private key if this is an Ed25519 key, null otherwise
   */
  toEd25519(): Ed25519PrivateKey | null {
    if (this._type === SignatureScheme.Ed25519 && this._ed25519Key !== undefined) {
      return this._ed25519Key;
    }
    return null;
  }

  /**
   * Returns the underlying Sr25519 private key if this is an Sr25519 key.
   *
   * @returns The Sr25519 private key if this is an Sr25519 key, null otherwise
   */
  toSr25519(): Sr25519PrivateKey | null {
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
   * Derives the corresponding public key for this private key.
   *
   * @returns The public key corresponding to this private key
   */
  publicKey(): SigningPublicKey {
    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        return SigningPublicKey.fromSchnorr(this._ecKey.schnorrPublicKey());
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        return SigningPublicKey.fromEcdsa(this._ecKey.publicKey());
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 private key is missing");
        }
        return SigningPublicKey.fromEd25519(this._ed25519Key.publicKey());
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 private key is missing");
        }
        return SigningPublicKey.fromSr25519(this._sr25519Key.publicKey());
      }
    }
  }

  /**
   * Compare with another SigningPrivateKey.
   */
  equals(other: SigningPrivateKey): boolean {
    if (this._type !== other._type) return false;
    switch (this._type) {
      case SignatureScheme.Schnorr:
      case SignatureScheme.Ecdsa:
        if (this._ecKey === undefined || other._ecKey === undefined) return false;
        return this._ecKey.equals(other._ecKey);
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
      case SignatureScheme.Schnorr: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        const sigData = this._ecKey.schnorrSign(message);
        return Signature.schnorrFromData(sigData);
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        const sigData = this._ecKey.ecdsaSign(message);
        return Signature.ecdsaFromData(sigData);
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 private key is missing");
        }
        const sigData = this._ed25519Key.sign(message);
        return Signature.ed25519FromData(sigData);
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 private key is missing");
        }
        const sigData = this._sr25519Key.sign(message);
        return Signature.sr25519FromData(sigData);
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
   * Format for Schnorr: [0, h'<32-byte-private-key>']
   * Format for ECDSA:   [1, h'<32-byte-private-key>']
   * Format for Ed25519: [2, h'<32-byte-private-key>']
   * Format for Sr25519: [3, h'<32-byte-seed>']
   */
  untaggedCbor(): Cbor {
    switch (this._type) {
      case SignatureScheme.Schnorr: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        return cbor([0, toByteString(this._ecKey.toData())]);
      }
      case SignatureScheme.Ecdsa: {
        if (this._ecKey === undefined) {
          throw new Error("EC private key is missing");
        }
        return cbor([1, toByteString(this._ecKey.toData())]);
      }
      case SignatureScheme.Ed25519: {
        if (this._ed25519Key === undefined) {
          throw new Error("Ed25519 private key is missing");
        }
        return cbor([2, toByteString(this._ed25519Key.toData())]);
      }
      case SignatureScheme.Sr25519: {
        if (this._sr25519Key === undefined) {
          throw new Error("Sr25519 private key is missing");
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
   * Creates a SigningPrivateKey by decoding it from untagged CBOR.
   *
   * Format:
   * - [0, h'<32-byte-key>'] for Schnorr
   * - [1, h'<32-byte-key>'] for ECDSA
   * - [2, h'<32-byte-key>'] for Ed25519
   * - [3, h'<32-byte-seed>'] for Sr25519
   */
  fromUntaggedCbor(cborValue: Cbor): SigningPrivateKey {
    const elements = expectArray(cborValue);

    if (elements.length !== 2) {
      throw new Error("SigningPrivateKey must have 2 elements");
    }

    const discriminator = expectUnsigned(elements[0]);
    const keyData = expectBytes(elements[1]);

    switch (Number(discriminator)) {
      case 0: // Schnorr
        return SigningPrivateKey.newSchnorr(ECPrivateKey.from(keyData));
      case 1: // ECDSA
        return SigningPrivateKey.newEcdsa(ECPrivateKey.from(keyData));
      case 2: // Ed25519
        return SigningPrivateKey.newEd25519(Ed25519PrivateKey.from(keyData));
      case 3: // Sr25519
        return SigningPrivateKey.newSr25519(Sr25519PrivateKey.from(keyData));
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
