/**
 * Encapsulation public key for key encapsulation mechanisms
 *
 * This type represents a public key that can be used to encapsulate (encrypt)
 * a shared secret. The recipient can then use their corresponding private key
 * to decapsulate (decrypt) the shared secret.
 *
 * For X25519, encapsulation works by:
 * 1. Generating an ephemeral key pair
 * 2. Performing ECDH with the ephemeral private key and the recipient's public key
 * 3. Returning the shared secret and the ephemeral public key as "ciphertext"
 *
 * # CBOR Serialization
 *
 * For X25519, the public key is serialized with tag 40011.
 *
 * Ported from bc-components-rust/src/encapsulation/encapsulation_public_key.rs
 */

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
import { X25519_PUBLIC_KEY as TAG_X25519_PUBLIC_KEY } from "@bcts/tags";
import { X25519PrivateKey } from "../x25519/x25519-private-key.js";
import { X25519PublicKey } from "../x25519/x25519-public-key.js";
import { type SymmetricKey } from "../symmetric/symmetric-key.js";
import { EncapsulationScheme } from "./encapsulation-scheme.js";
import { EncapsulationCiphertext } from "./encapsulation-ciphertext.js";
import { bytesToHex } from "../utils.js";

/**
 * Represents a public key for key encapsulation.
 *
 * Use this to encapsulate a shared secret for a recipient.
 */
export class EncapsulationPublicKey
  implements CborTaggedEncodable, CborTaggedDecodable<EncapsulationPublicKey>, UREncodable
{
  private readonly _scheme: EncapsulationScheme;
  private readonly _x25519PublicKey: X25519PublicKey | undefined;

  private constructor(scheme: EncapsulationScheme, x25519PublicKey?: X25519PublicKey) {
    this._scheme = scheme;
    this._x25519PublicKey = x25519PublicKey;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an EncapsulationPublicKey from an X25519PublicKey.
   */
  static fromX25519PublicKey(publicKey: X25519PublicKey): EncapsulationPublicKey {
    return new EncapsulationPublicKey(EncapsulationScheme.X25519, publicKey);
  }

  /**
   * Create an EncapsulationPublicKey from raw X25519 public key bytes.
   */
  static fromX25519Data(data: Uint8Array): EncapsulationPublicKey {
    const publicKey = X25519PublicKey.fromDataRef(data);
    return EncapsulationPublicKey.fromX25519PublicKey(publicKey);
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
   * Returns true if this is an X25519 public key.
   */
  isX25519(): boolean {
    return this._scheme === EncapsulationScheme.X25519;
  }

  /**
   * Returns the X25519 public key if this is an X25519 encapsulation key.
   * @throws Error if this is not an X25519 key
   */
  x25519PublicKey(): X25519PublicKey {
    if (this._x25519PublicKey === undefined) {
      throw new Error("Not an X25519 public key");
    }
    return this._x25519PublicKey;
  }

  /**
   * Returns the raw public key data.
   */
  data(): Uint8Array {
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const pk = this._x25519PublicKey;
        if (pk === undefined) throw new Error("X25519 public key not set");
        return pk.data();
      }
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
    }
  }

  /**
   * Encapsulate a new shared secret for this public key.
   *
   * This generates a random shared secret and encapsulates it so that only
   * the holder of the corresponding private key can recover it.
   *
   * @returns A tuple of [sharedSecret, ciphertext]
   */
  encapsulateNewSharedSecret(): [SymmetricKey, EncapsulationCiphertext] {
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const pk = this._x25519PublicKey;
        if (pk === undefined) throw new Error("X25519 public key not set");
        // Generate ephemeral key pair
        const [ephemeralPrivate, ephemeralPublic] = X25519PrivateKey.keypair();

        // Perform ECDH to get shared secret
        const sharedSecret = ephemeralPrivate.sharedKeyWith(pk);

        // The "ciphertext" is the ephemeral public key
        const ciphertext = EncapsulationCiphertext.fromX25519PublicKey(ephemeralPublic);

        return [sharedSecret, ciphertext];
      }
      default:
        throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
    }
  }

  /**
   * Compare with another EncapsulationPublicKey.
   */
  equals(other: EncapsulationPublicKey): boolean {
    if (this._scheme !== other._scheme) return false;
    switch (this._scheme) {
      case EncapsulationScheme.X25519: {
        const thisPk = this._x25519PublicKey;
        const otherPk = other._x25519PublicKey;
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
        return `EncapsulationPublicKey(X25519, ${bytesToHex(this.data()).substring(0, 16)}...)`;
      default:
        return `EncapsulationPublicKey(${String(this._scheme)})`;
    }
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with this public key.
   */
  cborTags(): Tag[] {
    switch (this._scheme) {
      case EncapsulationScheme.X25519:
        return tagsForValues([TAG_X25519_PUBLIC_KEY.value]);
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
        const pk = this._x25519PublicKey;
        if (pk === undefined) throw new Error("X25519 public key not set");
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
   * Creates an EncapsulationPublicKey by decoding it from untagged CBOR.
   * Note: Without tags, we assume X25519 scheme.
   */
  fromUntaggedCbor(cborValue: Cbor): EncapsulationPublicKey {
    const data = expectBytes(cborValue);
    const publicKey = X25519PublicKey.fromDataRef(data);
    return EncapsulationPublicKey.fromX25519PublicKey(publicKey);
  }

  /**
   * Creates an EncapsulationPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): EncapsulationPublicKey {
    const tag = tagValue(cborValue);

    if (tag === TAG_X25519_PUBLIC_KEY.value) {
      const content = extractTaggedContent(cborValue);
      const data = expectBytes(content);
      const publicKey = X25519PublicKey.fromDataRef(data);
      return EncapsulationPublicKey.fromX25519PublicKey(publicKey);
    }

    throw new Error(`Unknown public key tag: ${tag}`);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): EncapsulationPublicKey {
    const dummy = EncapsulationPublicKey.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): EncapsulationPublicKey {
    const cborValue = decodeCbor(data);
    return EncapsulationPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): EncapsulationPublicKey {
    const cborValue = decodeCbor(data);
    const dummy = EncapsulationPublicKey.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
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
        const name = TAG_X25519_PUBLIC_KEY.name;
        if (name === undefined) throw new Error("TAG_X25519_PUBLIC_KEY.name is undefined");
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
   * Creates an EncapsulationPublicKey from a UR.
   */
  static fromUR(ur: UR): EncapsulationPublicKey {
    // Check for known UR types
    if (ur.urTypeStr() === TAG_X25519_PUBLIC_KEY.name) {
      const dummy = EncapsulationPublicKey.fromX25519PublicKey(
        X25519PublicKey.fromData(new Uint8Array(32)),
      );
      return dummy.fromUntaggedCbor(ur.cbor());
    }

    throw new Error(`Unknown UR type for EncapsulationPublicKey: ${ur.urTypeStr()}`);
  }

  /**
   * Creates an EncapsulationPublicKey from a UR string.
   */
  static fromURString(urString: string): EncapsulationPublicKey {
    const ur = UR.fromURString(urString);
    return EncapsulationPublicKey.fromUR(ur);
  }
}
