/* eslint-disable @typescript-eslint/switch-exhaustiveness-check -- MLKEM not yet implemented */
/**
 * Encapsulation private key for key encapsulation mechanisms
 *
 * This type represents a private key that can be used to decapsulate (decrypt)
 * a shared secret that was encapsulated using the corresponding public key.
 *
 * For X25519, decapsulation works by:
 * 1. Receiving the ephemeral public key (ciphertext)
 * 2. Performing ECDH with the private key and the ephemeral public key
 * 3. Returning the shared secret
 *
 * # CBOR Serialization
 *
 * For X25519, the private key is serialized with tag 40010.
 *
 * Ported from bc-components-rust/src/encapsulation/encapsulation_private_key.rs
 */

import { SecureRandomNumberGenerator, type RandomNumberGenerator } from "@bcts/rand";
import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  toByteString,
  expectBytes,
  createTaggedCbor,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
  tagValue,
} from "@bcts/dcbor";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { X25519_PRIVATE_KEY as TAG_X25519_PRIVATE_KEY } from "@bcts/tags";
import { X25519PrivateKey } from "../x25519/x25519-private-key.js";
import { type SymmetricKey } from "../symmetric/symmetric-key.js";
import { EncapsulationScheme } from "./encapsulation-scheme.js";
import { type EncapsulationCiphertext } from "./encapsulation-ciphertext.js";
import { EncapsulationPublicKey } from "./encapsulation-public-key.js";
import { CryptoError } from "../error.js";
import { bytesToHex } from "../utils.js";
import { Reference, type ReferenceProvider } from "../reference.js";
import { Digest } from "../digest.js";

/**
 * Represents a private key for key encapsulation.
 *
 * Use this to decapsulate a shared secret from ciphertext.
 */
export class EncapsulationPrivateKey
  implements
    ReferenceProvider,
    CborTaggedEncodable,
    CborTaggedDecodable<EncapsulationPrivateKey>,
    UREncodable
{
  private readonly _scheme: EncapsulationScheme;
  private readonly _x25519PrivateKey: X25519PrivateKey | undefined;

  private constructor(scheme: EncapsulationScheme, x25519PrivateKey?: X25519PrivateKey) {
    this._scheme = scheme;
    this._x25519PrivateKey = x25519PrivateKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an EncapsulationPrivateKey from an X25519PrivateKey.
   */
  static fromX25519PrivateKey(privateKey: X25519PrivateKey): EncapsulationPrivateKey {
    return new EncapsulationPrivateKey(EncapsulationScheme.X25519, privateKey);
  }

  /**
   * Create an EncapsulationPrivateKey from raw X25519 private key bytes.
   */
  static fromX25519Data(data: Uint8Array): EncapsulationPrivateKey {
    const privateKey = X25519PrivateKey.fromDataRef(data);
    return EncapsulationPrivateKey.fromX25519PrivateKey(privateKey);
  }

  /**
   * Generate a new random X25519 encapsulation private key.
   */
  static new(): EncapsulationPrivateKey {
    return EncapsulationPrivateKey.random();
  }

  /**
   * Generate a new random X25519 encapsulation private key.
   */
  static random(): EncapsulationPrivateKey {
    const rng = new SecureRandomNumberGenerator();
    return EncapsulationPrivateKey.newUsing(rng);
  }

  /**
   * Generate a new random X25519 encapsulation private key using provided RNG.
   */
  static newUsing(rng: RandomNumberGenerator): EncapsulationPrivateKey {
    const x25519Private = X25519PrivateKey.newUsing(rng);
    return EncapsulationPrivateKey.fromX25519PrivateKey(x25519Private);
  }

  /**
   * Generate a new keypair.
   */
  static keypair(): [EncapsulationPrivateKey, EncapsulationPublicKey] {
    const privateKey = EncapsulationPrivateKey.new();
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  /**
   * Generate a new keypair using the given RNG.
   */
  static keypairUsing(
    rng: RandomNumberGenerator,
  ): [EncapsulationPrivateKey, EncapsulationPublicKey] {
    const privateKey = EncapsulationPrivateKey.newUsing(rng);
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the encapsulation scheme.
   */
  encapsulationScheme(): EncapsulationScheme {
    return this._scheme;
  }

  /**
   * Returns true if this is an X25519 private key.
   */
  isX25519(): boolean {
    return this._scheme === EncapsulationScheme.X25519;
  }

  /**
   * Returns the X25519 private key if this is an X25519 encapsulation key.
   * @throws Error if this is not an X25519 key
   */
  x25519PrivateKey(): X25519PrivateKey {
    if (this._x25519PrivateKey === undefined) {
      throw new Error("Not an X25519 private key");
    }
    return this._x25519PrivateKey;
  }

  /**
   * Returns the raw private key data.
   */
  data(): Uint8Array {
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const pk = this._x25519PrivateKey;
        if (pk === undefined) throw new Error("X25519 private key not set");
        return pk.data();
      }
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
    }
  }

  /**
   * Get the public key corresponding to this private key.
   */
  publicKey(): EncapsulationPublicKey {
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const pk = this._x25519PrivateKey;
        if (pk === undefined) throw new Error("X25519 private key not set");
        const x25519Public = pk.publicKey();
        return EncapsulationPublicKey.fromX25519PublicKey(x25519Public);
      }
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
    }
  }

  /**
   * Decapsulate a shared secret from ciphertext.
   *
   * @param ciphertext - The ciphertext from encapsulation
   * @returns The decapsulated shared secret
   * @throws CryptoError if the scheme doesn't match
   */
  decapsulateSharedSecret(ciphertext: EncapsulationCiphertext): SymmetricKey {
    // Verify scheme matches
    if (ciphertext.encapsulationScheme() !== this._scheme) {
      throw CryptoError.invalidData(
        `Scheme mismatch: expected ${String(this._scheme)}, got ${String(ciphertext.encapsulationScheme())}`,
      );
    }

    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const pk = this._x25519PrivateKey;
        if (pk === undefined) throw new Error("X25519 private key not set");
        // Get the ephemeral public key from ciphertext
        const ephemeralPublic = ciphertext.x25519PublicKey();

        // Perform ECDH to recover shared secret
        return pk.sharedKeyWith(ephemeralPublic);
      }
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
    }
  }

  /**
   * Compare with another EncapsulationPrivateKey.
   */
  equals(other: EncapsulationPrivateKey): boolean {
    if (this._scheme !== other._scheme) return false;
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const thisPk = this._x25519PrivateKey;
        const otherPk = other._x25519PrivateKey;
        if (thisPk === undefined || otherPk === undefined) return false;
        return thisPk.equals(otherPk);
      }
      default:
        return false;
    }
  }

  /**
   * Get string representation.
   */
  toString(): string {
    switch (this._scheme) {
      case EncapsulationScheme.X25519:
        return `EncapsulationPrivateKey(X25519, ${bytesToHex(this.data()).substring(0, 16)}...)`;
      default:
        return `EncapsulationPrivateKey(${String(this._scheme)})`;
    }
  }

  // ============================================================================
  // ReferenceProvider Interface
  // ============================================================================

  /**
   * Returns a unique reference to this EncapsulationPrivateKey instance.
   *
   * The reference is derived from the SHA-256 hash of the tagged CBOR
   * representation, providing a unique, content-addressable identifier.
   */
  reference(): Reference {
    const digest = Digest.fromImage(this.taggedCborData());
    return Reference.from(digest);
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with this private key.
   */
  cborTags(): Tag[] {
    switch (this._scheme) {
      case EncapsulationScheme.X25519:
        return tagsForValues([TAG_X25519_PRIVATE_KEY.value]);
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
    }
  }

  /**
   * Returns the untagged CBOR encoding.
   */
  untaggedCbor(): Cbor {
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const pk = this._x25519PrivateKey;
        if (pk === undefined) throw new Error("X25519 private key not set");
        return toByteString(pk.data());
      }
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
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
   * Creates an EncapsulationPrivateKey by decoding it from untagged CBOR.
   * Note: Without tags, we assume X25519 scheme.
   */
  fromUntaggedCbor(cborValue: Cbor): EncapsulationPrivateKey {
    const data = expectBytes(cborValue);
    const privateKey = X25519PrivateKey.fromDataRef(data);
    return EncapsulationPrivateKey.fromX25519PrivateKey(privateKey);
  }

  /**
   * Creates an EncapsulationPrivateKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): EncapsulationPrivateKey {
    const tag = tagValue(cborValue);

    if (tag === TAG_X25519_PRIVATE_KEY.value) {
      const content = extractTaggedContent(cborValue);
      const data = expectBytes(content);
      const privateKey = X25519PrivateKey.fromDataRef(data);
      return EncapsulationPrivateKey.fromX25519PrivateKey(privateKey);
    }

    throw new Error(`Unknown private key tag: ${tag}`);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): EncapsulationPrivateKey {
    const dummy = EncapsulationPrivateKey.fromX25519PrivateKey(
      X25519PrivateKey.fromData(new Uint8Array(32)),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): EncapsulationPrivateKey {
    const cborValue = decodeCbor(data);
    return EncapsulationPrivateKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): EncapsulationPrivateKey {
    const cborValue = decodeCbor(data);
    const dummy = EncapsulationPrivateKey.fromX25519PrivateKey(
      X25519PrivateKey.fromData(new Uint8Array(32)),
    );
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const name = TAG_X25519_PRIVATE_KEY.name;
        if (name === undefined) throw new Error("TAG_X25519_PRIVATE_KEY.name is undefined");
        return UR.new(name, this.untaggedCbor());
      }
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
    }
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an EncapsulationPrivateKey from a UR.
   */
  static fromUR(ur: UR): EncapsulationPrivateKey {
    // Check for known UR types
    if (ur.urTypeStr() === TAG_X25519_PRIVATE_KEY.name) {
      const dummy = EncapsulationPrivateKey.fromX25519PrivateKey(
        X25519PrivateKey.fromData(new Uint8Array(32)),
      );
      return dummy.fromUntaggedCbor(ur.cbor());
    }

    throw new Error(`Unknown UR type for EncapsulationPrivateKey: ${ur.urTypeStr()}`);
  }

  /**
   * Creates an EncapsulationPrivateKey from a UR string.
   */
  static fromURString(urString: string): EncapsulationPrivateKey {
    const ur = UR.fromURString(urString);
    return EncapsulationPrivateKey.fromUR(ur);
  }
}
