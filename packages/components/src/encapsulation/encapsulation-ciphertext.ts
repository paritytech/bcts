/**
 * Encapsulation ciphertext for key encapsulation mechanisms
 *
 * This type represents the ciphertext produced during key encapsulation.
 * For X25519, this is actually an ephemeral public key used in ECDH.
 *
 * # CBOR Serialization
 *
 * For X25519, the ciphertext is serialized with the X25519 public key tag (40011).
 *
 * Ported from bc-components-rust/src/encapsulation/encapsulation_ciphertext.rs
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
import { X25519_PUBLIC_KEY as TAG_X25519_PUBLIC_KEY } from "@bcts/tags";
import { X25519PublicKey } from "../x25519/x25519-public-key.js";
import { EncapsulationScheme } from "./encapsulation-scheme.js";
import { bytesToHex } from "../utils.js";

/**
 * Represents the ciphertext from a key encapsulation operation.
 *
 * For X25519, this wraps an ephemeral public key.
 */
export class EncapsulationCiphertext
  implements CborTaggedEncodable, CborTaggedDecodable<EncapsulationCiphertext>
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
   * Create an EncapsulationCiphertext from an X25519PublicKey.
   */
  static fromX25519PublicKey(publicKey: X25519PublicKey): EncapsulationCiphertext {
    return new EncapsulationCiphertext(EncapsulationScheme.X25519, publicKey);
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
   * Returns true if this is an X25519 ciphertext.
   */
  isX25519(): boolean {
    return this._scheme === EncapsulationScheme.X25519;
  }

  /**
   * Returns the X25519 public key if this is an X25519 ciphertext.
   * @throws Error if this is not an X25519 ciphertext
   */
  x25519PublicKey(): X25519PublicKey {
    if (this._x25519PublicKey === undefined) {
      throw new Error("Not an X25519 ciphertext");
    }
    return this._x25519PublicKey;
  }

  /**
   * Returns the raw ciphertext data.
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
   * Compare with another EncapsulationCiphertext.
   */
  equals(other: EncapsulationCiphertext): boolean {
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
        return `EncapsulationCiphertext(X25519, ${bytesToHex(this.data()).substring(0, 16)}...)`;
      default:
        return `EncapsulationCiphertext(${String(this._scheme)})`;
    }
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with this ciphertext.
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
   * Creates an EncapsulationCiphertext by decoding it from untagged CBOR.
   * Note: Without tags, we assume X25519 scheme.
   */
  fromUntaggedCbor(cborValue: Cbor): EncapsulationCiphertext {
    const data = expectBytes(cborValue);
    const publicKey = X25519PublicKey.fromDataRef(data);
    return EncapsulationCiphertext.fromX25519PublicKey(publicKey);
  }

  /**
   * Creates an EncapsulationCiphertext by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): EncapsulationCiphertext {
    const tag = tagValue(cborValue);

    if (tag === TAG_X25519_PUBLIC_KEY.value) {
      const content = extractTaggedContent(cborValue);
      const data = expectBytes(content);
      const publicKey = X25519PublicKey.fromDataRef(data);
      return EncapsulationCiphertext.fromX25519PublicKey(publicKey);
    }

    throw new Error(`Unknown ciphertext tag: ${tag}`);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): EncapsulationCiphertext {
    const dummy = EncapsulationCiphertext.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): EncapsulationCiphertext {
    const cborValue = decodeCbor(data);
    return EncapsulationCiphertext.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): EncapsulationCiphertext {
    const cborValue = decodeCbor(data);
    const dummy = EncapsulationCiphertext.fromX25519PublicKey(
      X25519PublicKey.fromData(new Uint8Array(32)),
    );
    return dummy.fromUntaggedCbor(cborValue);
  }
}
