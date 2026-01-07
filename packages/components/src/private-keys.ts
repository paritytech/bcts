/**
 * PrivateKeys - Container for signing and encapsulation private keys
 *
 * PrivateKeys combines a SigningPrivateKey (for digital signatures) and an
 * EncapsulationPrivateKey (for key agreement/encryption) into a single unit.
 *
 * # CBOR Serialization
 *
 * PrivateKeys is serialized with tag 40013:
 * ```
 * #6.40013([<SigningPrivateKey>, <EncapsulationPrivateKey>])
 * ```
 *
 * # UR Serialization
 *
 * UR type: `crypto-prvkeys`
 *
 * Ported from bc-components-rust/src/private_keys.rs
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
import { PRIVATE_KEYS as TAG_PRIVATE_KEYS } from "@bcts/tags";

import { SigningPrivateKey } from "./signing/signing-private-key.js";
import { EncapsulationPrivateKey } from "./encapsulation/encapsulation-private-key.js";
import { PublicKeys } from "./public-keys.js";
import type { SymmetricKey } from "./symmetric/symmetric-key.js";
import type { EncapsulationCiphertext } from "./encapsulation/encapsulation-ciphertext.js";
import type { Signature } from "./signing/signature.js";
import type { Signer } from "./signing/signer.js";
import type { SigningOptions } from "./signing/signature-scheme.js";
import type { Decrypter } from "./encrypter.js";
import { Reference, type ReferenceProvider } from "./reference.js";
import { Digest } from "./digest.js";

/**
 * Trait for types that provide access to a PrivateKeys container.
 *
 * This is useful for types that wrap or contain private keys and need
 * to provide access to the underlying key material.
 */
export interface PrivateKeysProvider {
  /**
   * Returns the PrivateKeys container.
   */
  privateKeys(): PrivateKeys;
}

/**
 * PrivateKeys - Container for a signing key and an encapsulation key.
 *
 * This type provides a convenient way to manage a pair of private keys
 * for both signing and encryption operations.
 */
export class PrivateKeys
  implements
    Signer,
    Decrypter,
    ReferenceProvider,
    CborTaggedEncodable,
    CborTaggedDecodable<PrivateKeys>,
    UREncodable
{
  private readonly _signingPrivateKey: SigningPrivateKey;
  private readonly _encapsulationPrivateKey: EncapsulationPrivateKey;

  private constructor(
    signingPrivateKey: SigningPrivateKey,
    encapsulationPrivateKey: EncapsulationPrivateKey,
  ) {
    this._signingPrivateKey = signingPrivateKey;
    this._encapsulationPrivateKey = encapsulationPrivateKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new PrivateKeys container with the given keys.
   */
  static withKeys(
    signingPrivateKey: SigningPrivateKey,
    encapsulationPrivateKey: EncapsulationPrivateKey,
  ): PrivateKeys {
    return new PrivateKeys(signingPrivateKey, encapsulationPrivateKey);
  }

  /**
   * Create a new PrivateKeys container with random Ed25519/X25519 keys.
   */
  static new(): PrivateKeys {
    const signingKey = SigningPrivateKey.random();
    const encapsulationKey = EncapsulationPrivateKey.random();
    return new PrivateKeys(signingKey, encapsulationKey);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the signing private key.
   */
  signingPrivateKey(): SigningPrivateKey {
    return this._signingPrivateKey;
  }

  /**
   * Returns the encapsulation private key.
   *
   * Note: Named to match Rust's API (which has a typo but we maintain compatibility)
   */
  encapsulationPrivateKey(): EncapsulationPrivateKey {
    return this._encapsulationPrivateKey;
  }

  /**
   * Derive the corresponding public keys.
   */
  publicKeys(): PublicKeys {
    const signingPublicKey = this._signingPrivateKey.publicKey();
    const encapsulationPublicKey = this._encapsulationPrivateKey.publicKey();
    return PublicKeys.new(signingPublicKey, encapsulationPublicKey);
  }

  // ============================================================================
  // Signer Interface
  // ============================================================================

  /**
   * Sign a message with optional signing options using the signing private key.
   */
  signWithOptions(message: Uint8Array, options?: SigningOptions): Signature {
    return this._signingPrivateKey.signWithOptions(message, options);
  }

  /**
   * Sign a message using the signing private key.
   */
  sign(message: Uint8Array): Signature {
    return this._signingPrivateKey.sign(message);
  }

  // ============================================================================
  // Decrypter Interface
  // ============================================================================

  /**
   * Decapsulate a shared secret from a ciphertext.
   *
   * This implements the Decrypter interface, allowing PrivateKeys to be used
   * in encryption contexts where a shared secret needs to be recovered.
   */
  decapsulateSharedSecret(ciphertext: EncapsulationCiphertext): SymmetricKey {
    return this._encapsulationPrivateKey.decapsulateSharedSecret(ciphertext);
  }

  // ============================================================================
  // ReferenceProvider Interface
  // ============================================================================

  /**
   * Returns a unique reference to this PrivateKeys instance.
   *
   * The reference is derived from the SHA-256 hash of the tagged CBOR
   * representation, providing a unique, content-addressable identifier.
   */
  reference(): Reference {
    const digest = Digest.fromImage(this.taggedCborData());
    return Reference.from(digest);
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another PrivateKeys.
   */
  equals(other: PrivateKeys): boolean {
    return (
      this._signingPrivateKey.equals(other._signingPrivateKey) &&
      this._encapsulationPrivateKey.equals(other._encapsulationPrivateKey)
    );
  }

  /**
   * Get string representation.
   *
   * Format matches Rust: `PrivateKeys(<short_reference>)`
   */
  toString(): string {
    return `PrivateKeys(${this.reference().shortReference("hex")})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with PrivateKeys.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_PRIVATE_KEYS.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: [<SigningPrivateKey>, <EncapsulationPrivateKey>]
   */
  untaggedCbor(): Cbor {
    return cbor([this._signingPrivateKey.taggedCbor(), this._encapsulationPrivateKey.taggedCbor()]);
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
   * Creates a PrivateKeys by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): PrivateKeys {
    const elements = expectArray(cborValue);

    if (elements.length !== 2) {
      throw new Error(`PrivateKeys must have 2 elements, got ${elements.length}`);
    }

    const signingPrivateKey = SigningPrivateKey.fromTaggedCbor(elements[0]);
    const encapsulationPrivateKey = EncapsulationPrivateKey.fromTaggedCbor(elements[1]);

    return new PrivateKeys(signingPrivateKey, encapsulationPrivateKey);
  }

  /**
   * Creates a PrivateKeys by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): PrivateKeys {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): PrivateKeys {
    // Create a dummy instance for accessing instance methods
    const dummy = PrivateKeys.new();
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): PrivateKeys {
    const cborValue = decodeCbor(data);
    return PrivateKeys.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): PrivateKeys {
    const cborValue = decodeCbor(data);
    const dummy = PrivateKeys.new();
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_PRIVATE_KEYS.name;
    if (name === undefined) {
      throw new Error("PRIVATE_KEYS tag name is undefined");
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
   * Creates a PrivateKeys from a UR.
   */
  static fromUR(ur: UR): PrivateKeys {
    if (ur.urTypeStr() !== TAG_PRIVATE_KEYS.name) {
      throw new Error(`Expected UR type ${TAG_PRIVATE_KEYS.name}, got ${ur.urTypeStr()}`);
    }
    const dummy = PrivateKeys.new();
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a PrivateKeys from a UR string.
   */
  static fromURString(urString: string): PrivateKeys {
    const ur = UR.fromURString(urString);
    return PrivateKeys.fromUR(ur);
  }
}
