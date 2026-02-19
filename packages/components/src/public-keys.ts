/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * PublicKeys - Container for signing and encapsulation public keys
 *
 * PublicKeys combines a SigningPublicKey (for signature verification) and an
 * EncapsulationPublicKey (for key agreement/encryption) into a single unit.
 *
 * This is the public counterpart to PrivateKeys.
 *
 * # CBOR Serialization
 *
 * PublicKeys is serialized with tag 40017:
 * ```
 * #6.40017([<SigningPublicKey>, <EncapsulationPublicKey>])
 * ```
 *
 * # UR Serialization
 *
 * UR type: `crypto-pubkeys`
 *
 * Ported from bc-components-rust/src/public_keys.rs
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
import { PUBLIC_KEYS as TAG_PUBLIC_KEYS } from "@bcts/tags";

import { SigningPublicKey } from "./signing/signing-public-key.js";
import { EncapsulationPublicKey } from "./encapsulation/encapsulation-public-key.js";
import type { EncapsulationCiphertext } from "./encapsulation/encapsulation-ciphertext.js";
import type { SymmetricKey } from "./symmetric/symmetric-key.js";
import type { Signature } from "./signing/signature.js";
import type { Verifier } from "./signing/signer.js";
import type { Encrypter } from "./encrypter.js";
import { Reference, type ReferenceProvider } from "./reference.js";
import { Digest } from "./digest.js";

/**
 * Trait for types that provide access to a PublicKeys container.
 *
 * This is useful for types that wrap or contain public keys and need
 * to provide access to the underlying key material.
 */
export interface PublicKeysProvider {
  /**
   * Returns the PublicKeys container.
   */
  publicKeys(): PublicKeys;
}

/**
 * PublicKeys - Container for a signing public key and an encapsulation public key.
 *
 * This type provides a convenient way to share public keys for both
 * signature verification and encryption operations.
 */
export class PublicKeys
  implements
    Verifier,
    Encrypter,
    ReferenceProvider,
    CborTaggedEncodable,
    CborTaggedDecodable<PublicKeys>,
    UREncodable
{
  private readonly _signingPublicKey: SigningPublicKey;
  private readonly _encapsulationPublicKey: EncapsulationPublicKey;

  private constructor(
    signingPublicKey: SigningPublicKey,
    encapsulationPublicKey: EncapsulationPublicKey,
  ) {
    this._signingPublicKey = signingPublicKey;
    this._encapsulationPublicKey = encapsulationPublicKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new PublicKeys container with the given keys.
   */
  static new(
    signingPublicKey: SigningPublicKey,
    encapsulationPublicKey: EncapsulationPublicKey,
  ): PublicKeys {
    return new PublicKeys(signingPublicKey, encapsulationPublicKey);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the signing public key.
   */
  signingPublicKey(): SigningPublicKey {
    return this._signingPublicKey;
  }

  /**
   * Returns the encapsulation public key.
   *
   * Note: Named to match Rust's API (which has a typo but we maintain compatibility)
   */
  encapsulationPublicKey(): EncapsulationPublicKey {
    return this._encapsulationPublicKey;
  }

  // ============================================================================
  // Verifier Interface
  // ============================================================================

  /**
   * Verify a signature against a message.
   */
  verify(signature: Signature, message: Uint8Array): boolean {
    return this._signingPublicKey.verify(signature, message);
  }

  // ============================================================================
  // Encrypter Interface
  // ============================================================================

  /**
   * Encapsulate a new shared secret using the encapsulation public key.
   *
   * This implements the Encrypter interface, allowing PublicKeys to be used
   * in encryption contexts where a shared secret needs to be generated.
   *
   * @returns A tuple of [SymmetricKey, EncapsulationCiphertext]
   */
  encapsulateNewSharedSecret(): [SymmetricKey, EncapsulationCiphertext] {
    return this._encapsulationPublicKey.encapsulateNewSharedSecret();
  }

  // ============================================================================
  // ReferenceProvider Interface
  // ============================================================================

  /**
   * Returns a unique reference to this PublicKeys instance.
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
   * Compare with another PublicKeys.
   */
  equals(other: PublicKeys): boolean {
    return (
      this._signingPublicKey.equals(other._signingPublicKey) &&
      this._encapsulationPublicKey.equals(other._encapsulationPublicKey)
    );
  }

  /**
   * Get string representation.
   *
   * Format matches Rust: `PublicKeys(<short_reference>)`
   */
  toString(): string {
    return `PublicKeys(${this.reference().shortReference("hex")})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with PublicKeys.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_PUBLIC_KEYS.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: [<SigningPublicKey>, <EncapsulationPublicKey>]
   */
  untaggedCbor(): Cbor {
    return cbor([this._signingPublicKey.taggedCbor(), this._encapsulationPublicKey.taggedCbor()]);
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
   * Creates a PublicKeys by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): PublicKeys {
    const elements = expectArray(cborValue);

    if (elements.length !== 2) {
      throw new Error(`PublicKeys must have 2 elements, got ${elements.length}`);
    }

    const signingPublicKey = SigningPublicKey.fromTaggedCbor(elements[0]);
    const encapsulationPublicKey = EncapsulationPublicKey.fromTaggedCbor(elements[1]);

    return new PublicKeys(signingPublicKey, encapsulationPublicKey);
  }

  /**
   * Creates a PublicKeys by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): PublicKeys {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): PublicKeys {
    // We need a dummy instance to call instance methods
    // Create minimal valid keys for this purpose
    const signingKeyPrefix = new Uint8Array([0x82, 0x02, 0x58, 0x20]);
    const signingKeyData = new Uint8Array(36);
    signingKeyData.set(signingKeyPrefix, 0);
    const signingKey = SigningPublicKey.fromUntaggedCborData(signingKeyData);

    const encapsulationKeyPrefix = new Uint8Array([0x58, 0x20]);
    const encapsulationKeyData = new Uint8Array(34);
    encapsulationKeyData.set(encapsulationKeyPrefix, 0);
    const encapsulationKey = EncapsulationPublicKey.fromUntaggedCborData(encapsulationKeyData);

    const dummy = new PublicKeys(signingKey, encapsulationKey);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): PublicKeys {
    const cborValue = decodeCbor(data);
    return PublicKeys.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): PublicKeys {
    const cborValue = decodeCbor(data);
    // We need a dummy instance to call instance methods
    const signingKeyPrefix = new Uint8Array([0x82, 0x02, 0x58, 0x20]);
    const signingKeyData = new Uint8Array(36);
    signingKeyData.set(signingKeyPrefix, 0);
    const signingKey = SigningPublicKey.fromUntaggedCborData(signingKeyData);

    const encapsulationKeyPrefix = new Uint8Array([0x58, 0x20]);
    const encapsulationKeyData = new Uint8Array(34);
    encapsulationKeyData.set(encapsulationKeyPrefix, 0);
    const encapsulationKey = EncapsulationPublicKey.fromUntaggedCborData(encapsulationKeyData);

    const dummy = new PublicKeys(signingKey, encapsulationKey);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_PUBLIC_KEYS.name;
    if (name === undefined) {
      throw new Error("PUBLIC_KEYS tag name is undefined");
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
   * Creates a PublicKeys from a UR.
   */
  static fromUR(ur: UR): PublicKeys {
    if (ur.urTypeStr() !== TAG_PUBLIC_KEYS.name) {
      throw new Error(`Expected UR type ${TAG_PUBLIC_KEYS.name}, got ${ur.urTypeStr()}`);
    }
    // We need a dummy instance to call instance methods
    const signingKeyPrefix = new Uint8Array([0x82, 0x02, 0x58, 0x20]);
    const signingKeyData = new Uint8Array(36);
    signingKeyData.set(signingKeyPrefix, 0);
    const signingKey = SigningPublicKey.fromUntaggedCborData(signingKeyData);

    const encapsulationKeyPrefix = new Uint8Array([0x58, 0x20]);
    const encapsulationKeyData = new Uint8Array(34);
    encapsulationKeyData.set(encapsulationKeyPrefix, 0);
    const encapsulationKey = EncapsulationPublicKey.fromUntaggedCborData(encapsulationKeyData);

    const dummy = new PublicKeys(signingKey, encapsulationKey);
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a PublicKeys from a UR string.
   */
  static fromURString(urString: string): PublicKeys {
    const ur = UR.fromURString(urString);
    return PublicKeys.fromUR(ur);
  }
}
