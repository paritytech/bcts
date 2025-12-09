/**
 * A digital signature created with various signature algorithms.
 *
 * `Signature` represents different types of digital signatures.
 * Currently, only Ed25519 signatures are implemented (64 bytes).
 *
 * Signatures can be serialized to and from CBOR with tag 40020.
 *
 * # CBOR Serialization
 *
 * The CBOR encoding for Ed25519 signatures is:
 * ```
 * #6.40020([2, h'<64-byte-signature>'])
 * ```
 *
 * Ported from bc-components-rust/src/signing/signature.rs
 */

import { ED25519_SIGNATURE_SIZE } from "@blockchain-commons/crypto";
import { SR25519_SIGNATURE_SIZE } from "../sr25519/sr25519-private-key.js";
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
} from "@blockchain-commons/dcbor";
import { SIGNATURE as TAG_SIGNATURE } from "@blockchain-commons/tags";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes } from "../utils.js";
import { SignatureScheme } from "./signature-scheme.js";

/**
 * A digital signature created with various signature algorithms.
 *
 * Currently supports:
 * - Ed25519 signatures (64 bytes)
 * - Sr25519 signatures (64 bytes)
 */
export class Signature implements CborTaggedEncodable, CborTaggedDecodable<Signature> {
  private readonly _type: SignatureScheme;
  private readonly _data: Uint8Array;

  private constructor(type: SignatureScheme, data: Uint8Array) {
    this._type = type;
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates an Ed25519 signature from a 64-byte array.
   *
   * @param data - The 64-byte signature data
   * @returns A new Ed25519 signature
   */
  static ed25519FromData(data: Uint8Array): Signature {
    if (data.length !== ED25519_SIGNATURE_SIZE) {
      throw CryptoError.invalidSize(ED25519_SIGNATURE_SIZE, data.length);
    }
    return new Signature(SignatureScheme.Ed25519, data);
  }

  /**
   * Creates an Ed25519 signature from a hex string.
   *
   * @param hex - The hex-encoded signature data
   * @returns A new Ed25519 signature
   */
  static ed25519FromHex(hex: string): Signature {
    return Signature.ed25519FromData(hexToBytes(hex));
  }

  /**
   * Creates an Sr25519 signature from a 64-byte array.
   *
   * @param data - The 64-byte signature data
   * @returns A new Sr25519 signature
   */
  static sr25519FromData(data: Uint8Array): Signature {
    if (data.length !== SR25519_SIGNATURE_SIZE) {
      throw CryptoError.invalidSize(SR25519_SIGNATURE_SIZE, data.length);
    }
    return new Signature(SignatureScheme.Sr25519, data);
  }

  /**
   * Creates an Sr25519 signature from a hex string.
   *
   * @param hex - The hex-encoded signature data
   * @returns A new Sr25519 signature
   */
  static sr25519FromHex(hex: string): Signature {
    return Signature.sr25519FromData(hexToBytes(hex));
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the signature scheme used to create this signature.
   */
  scheme(): SignatureScheme {
    return this._type;
  }

  /**
   * Returns the raw signature data.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Returns the Ed25519 signature data if this is an Ed25519 signature.
   *
   * @returns The 64-byte signature data if this is an Ed25519 signature, null otherwise
   */
  toEd25519(): Uint8Array | null {
    if (this._type === SignatureScheme.Ed25519) {
      return this._data;
    }
    return null;
  }

  /**
   * Checks if this is an Ed25519 signature.
   */
  isEd25519(): boolean {
    return this._type === SignatureScheme.Ed25519;
  }

  /**
   * Returns the Sr25519 signature data if this is an Sr25519 signature.
   *
   * @returns The 64-byte signature data if this is an Sr25519 signature, null otherwise
   */
  toSr25519(): Uint8Array | null {
    if (this._type === SignatureScheme.Sr25519) {
      return this._data;
    }
    return null;
  }

  /**
   * Checks if this is an Sr25519 signature.
   */
  isSr25519(): boolean {
    return this._type === SignatureScheme.Sr25519;
  }

  /**
   * Get hex string representation of the signature data.
   */
  toHex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Compare with another Signature.
   */
  equals(other: Signature): boolean {
    if (this._type !== other._type) return false;
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `Signature(${this._type}, ${this.toHex().substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with Signature.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SIGNATURE.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format for Ed25519: [2, h'<64-byte-signature>']
   * Format for Sr25519: [3, h'<64-byte-signature>']
   */
  untaggedCbor(): Cbor {
    switch (this._type) {
      case SignatureScheme.Ed25519:
        return cbor([2, toByteString(this._data)]);
      case SignatureScheme.Sr25519:
        return cbor([3, toByteString(this._data)]);
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
   * Creates a Signature by decoding it from untagged CBOR.
   *
   * Format:
   * - [2, h'<64-byte-signature>'] for Ed25519
   * - [3, h'<64-byte-signature>'] for Sr25519
   */
  fromUntaggedCbor(cborValue: Cbor): Signature {
    const elements = expectArray(cborValue);

    if (elements.length !== 2) {
      throw new Error("Signature must have 2 elements");
    }

    const discriminator = expectUnsigned(elements[0]);
    const signatureData = expectBytes(elements[1]);

    switch (Number(discriminator)) {
      case 2: // Ed25519
        return Signature.ed25519FromData(signatureData);
      case 3: // Sr25519
        return Signature.sr25519FromData(signatureData);
      default:
        throw new Error(`Unknown signature discriminator: ${discriminator}`);
    }
  }

  /**
   * Creates a Signature by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): Signature {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): Signature {
    // Create a dummy instance for accessing instance methods
    const dummy = new Signature(
      SignatureScheme.Ed25519,
      new Uint8Array(ED25519_SIGNATURE_SIZE),
    );
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): Signature {
    const cborValue = decodeCbor(data);
    return Signature.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): Signature {
    const cborValue = decodeCbor(data);
    const dummy = new Signature(
      SignatureScheme.Ed25519,
      new Uint8Array(ED25519_SIGNATURE_SIZE),
    );
    return dummy.fromUntaggedCbor(cborValue);
  }
}
