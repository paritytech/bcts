/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * A digital signature created with various signature algorithms.
 *
 * `Signature` represents different types of digital signatures.
 * Supports Schnorr, ECDSA, Ed25519, and Sr25519 signatures.
 *
 * Signatures can be serialized to and from CBOR with tag 40020.
 *
 * # CBOR Serialization
 *
 * The CBOR encoding (matching Rust bc-components):
 * - Schnorr: `#6.40020(h'<64-byte-signature>')` (bare byte string)
 * - ECDSA:   `#6.40020([1, h'<64-byte-signature>'])`
 * - Ed25519: `#6.40020([2, h'<64-byte-signature>'])`
 * - Sr25519: `#6.40020([3, h'<64-byte-signature>'])`
 *
 * Ported from bc-components-rust/src/signing/signature.rs
 */

import { ED25519_SIGNATURE_SIZE, ECDSA_SIGNATURE_SIZE, SCHNORR_SIGNATURE_SIZE } from "@bcts/crypto";
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
  isBytes,
  isArray,
  isTagged,
} from "@bcts/dcbor";
import { SIGNATURE as TAG_SIGNATURE, MLDSA_SIGNATURE as TAG_MLDSA_SIGNATURE } from "@bcts/tags";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes } from "../utils.js";
import { SignatureScheme, isMldsaScheme } from "./signature-scheme.js";
import { MLDSASignature } from "../mldsa/mldsa-signature.js";
import { MLDSALevel } from "../mldsa/mldsa-level.js";
import { UR } from "@bcts/uniform-resources";

/**
 * A digital signature created with various signature algorithms.
 *
 * Currently supports:
 * - Schnorr signatures (64 bytes) - bare byte string in CBOR
 * - ECDSA signatures (64 bytes) - discriminator 1
 * - Ed25519 signatures (64 bytes) - discriminator 2
 * - Sr25519 signatures (64 bytes) - discriminator 3
 * - MLDSA signatures (post-quantum) - tagged CBOR delegating to MLDSASignature
 */
export class Signature implements CborTaggedEncodable, CborTaggedDecodable<Signature> {
  private readonly _type: SignatureScheme;
  private readonly _data: Uint8Array;
  private readonly _mldsaSignature: MLDSASignature | undefined;

  private constructor(type: SignatureScheme, data: Uint8Array, mldsaSignature?: MLDSASignature) {
    this._type = type;
    this._data = new Uint8Array(data);
    this._mldsaSignature = mldsaSignature;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a Schnorr signature from a 64-byte array.
   *
   * @param data - The 64-byte signature data
   * @returns A new Schnorr signature
   */
  static schnorrFromData(data: Uint8Array): Signature {
    if (data.length !== SCHNORR_SIGNATURE_SIZE) {
      throw CryptoError.invalidSize(SCHNORR_SIGNATURE_SIZE, data.length);
    }
    return new Signature(SignatureScheme.Schnorr, data);
  }

  /**
   * Creates a Schnorr signature from a hex string.
   *
   * @param hex - The hex-encoded signature data
   * @returns A new Schnorr signature
   */
  static schnorrFromHex(hex: string): Signature {
    return Signature.schnorrFromData(hexToBytes(hex));
  }

  /**
   * Creates an ECDSA signature from a 64-byte array.
   *
   * @param data - The 64-byte signature data
   * @returns A new ECDSA signature
   */
  static ecdsaFromData(data: Uint8Array): Signature {
    if (data.length !== ECDSA_SIGNATURE_SIZE) {
      throw CryptoError.invalidSize(ECDSA_SIGNATURE_SIZE, data.length);
    }
    return new Signature(SignatureScheme.Ecdsa, data);
  }

  /**
   * Creates an ECDSA signature from a hex string.
   *
   * @param hex - The hex-encoded signature data
   * @returns A new ECDSA signature
   */
  static ecdsaFromHex(hex: string): Signature {
    return Signature.ecdsaFromData(hexToBytes(hex));
  }

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

  /**
   * Creates a Signature from an MLDSASignature.
   *
   * @param sig - The MLDSASignature
   * @returns A new Signature wrapping the MLDSA signature
   */
  static mldsaFromSignature(sig: MLDSASignature): Signature {
    // Determine the SignatureScheme based on the MLDSA level
    let scheme: SignatureScheme;
    switch (sig.level()) {
      case MLDSALevel.MLDSA44:
        scheme = SignatureScheme.MLDSA44;
        break;
      case MLDSALevel.MLDSA65:
        scheme = SignatureScheme.MLDSA65;
        break;
      case MLDSALevel.MLDSA87:
        scheme = SignatureScheme.MLDSA87;
        break;
      default:
        throw new Error(`Unknown MLDSA level: ${sig.level()}`);
    }
    return new Signature(scheme, sig.data(), sig);
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
   * Returns a human-readable string identifying the signature type.
   * @returns A string like "Ed25519", "Schnorr", "ECDSA", "Sr25519", "MLDSA-44", etc.
   */
  signatureType(): string {
    switch (this._type) {
      case SignatureScheme.Ed25519:
        return "Ed25519";
      case SignatureScheme.Schnorr:
        return "Schnorr";
      case SignatureScheme.Ecdsa:
        return "Ecdsa";
      case SignatureScheme.Sr25519:
        return "Sr25519";
      case SignatureScheme.MLDSA44:
        return "MLDSA-44";
      case SignatureScheme.MLDSA65:
        return "MLDSA-65";
      case SignatureScheme.MLDSA87:
        return "MLDSA-87";
      case SignatureScheme.SshEd25519:
        return "SshEd25519";
      case SignatureScheme.SshDsa:
        return "SshDsa";
      case SignatureScheme.SshEcdsaP256:
        return "SshEcdsaP256";
      case SignatureScheme.SshEcdsaP384:
        return "SshEcdsaP384";
      default:
        return this._type;
    }
  }

  /**
   * Returns the raw signature data.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Returns the Schnorr signature data if this is a Schnorr signature.
   *
   * @returns The 64-byte signature data if this is a Schnorr signature, null otherwise
   */
  toSchnorr(): Uint8Array | null {
    if (this._type === SignatureScheme.Schnorr) {
      return this._data;
    }
    return null;
  }

  /**
   * Checks if this is a Schnorr signature.
   */
  isSchnorr(): boolean {
    return this._type === SignatureScheme.Schnorr;
  }

  /**
   * Returns the ECDSA signature data if this is an ECDSA signature.
   *
   * @returns The 64-byte signature data if this is an ECDSA signature, null otherwise
   */
  toEcdsa(): Uint8Array | null {
    if (this._type === SignatureScheme.Ecdsa) {
      return this._data;
    }
    return null;
  }

  /**
   * Checks if this is an ECDSA signature.
   */
  isEcdsa(): boolean {
    return this._type === SignatureScheme.Ecdsa;
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
   * Returns the MLDSASignature if this is an MLDSA signature.
   *
   * @returns The MLDSASignature if this is an MLDSA signature, null otherwise
   */
  toMldsa(): MLDSASignature | null {
    if (isMldsaScheme(this._type) && this._mldsaSignature !== undefined) {
      return this._mldsaSignature;
    }
    return null;
  }

  /**
   * Checks if this is an MLDSA signature.
   */
  isMldsa(): boolean {
    return isMldsaScheme(this._type);
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
   * Format (matching Rust bc-components):
   * - Schnorr: h'<64-byte-signature>' (bare byte string)
   * - ECDSA:   [1, h'<64-byte-signature>']
   * - Ed25519: [2, h'<64-byte-signature>']
   * - Sr25519: [3, h'<64-byte-signature>']
   */
  untaggedCbor(): Cbor {
    switch (this._type) {
      case SignatureScheme.Schnorr:
        // Rust: CBOR::to_byte_string(data) - bare byte string
        return toByteString(this._data);
      case SignatureScheme.Ecdsa:
        return cbor([1, toByteString(this._data)]);
      case SignatureScheme.Ed25519:
        return cbor([2, toByteString(this._data)]);
      case SignatureScheme.Sr25519:
        return cbor([3, toByteString(this._data)]);
      case SignatureScheme.MLDSA44:
      case SignatureScheme.MLDSA65:
      case SignatureScheme.MLDSA87: {
        if (this._mldsaSignature === undefined) {
          throw new Error("MLDSA signature is missing");
        }
        // Rust: delegates to MLDSASignature (which produces tagged CBOR)
        return this._mldsaSignature.taggedCbor();
      }
      case SignatureScheme.SshEd25519:
      case SignatureScheme.SshDsa:
      case SignatureScheme.SshEcdsaP256:
      case SignatureScheme.SshEcdsaP384:
        throw new Error(`SSH signature scheme ${this._type} is not supported for CBOR encoding`);
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
   * Format (matching Rust bc-components):
   * - h'<64-byte-signature>' (bare byte string) for Schnorr
   * - [1, h'<64-byte-signature>'] for ECDSA
   * - [2, h'<64-byte-signature>'] for Ed25519
   * - [3, h'<64-byte-signature>'] for Sr25519
   */
  fromUntaggedCbor(cborValue: Cbor): Signature {
    // Rust format: Schnorr is a bare byte string
    if (isBytes(cborValue)) {
      const signatureData = expectBytes(cborValue);
      return Signature.schnorrFromData(signatureData);
    }

    // Array format for ECDSA, Ed25519, Sr25519
    if (isArray(cborValue)) {
      const elements = expectArray(cborValue);

      if (elements.length !== 2) {
        throw new Error("Signature array must have 2 elements");
      }

      const discriminator = expectUnsigned(elements[0]);
      const signatureData = expectBytes(elements[1]);

      switch (Number(discriminator)) {
        case 1: // ECDSA
          return Signature.ecdsaFromData(signatureData);
        case 2: // Ed25519
          return Signature.ed25519FromData(signatureData);
        case 3: // Sr25519
          return Signature.sr25519FromData(signatureData);
        default:
          throw new Error(`Unknown signature discriminator: ${discriminator}`);
      }
    }

    // Tagged format for MLDSA
    if (isTagged(cborValue)) {
      const tagged = cborValue.asTagged();
      if (tagged?.[0].value === TAG_MLDSA_SIGNATURE.value) {
        const mldsaSig = MLDSASignature.fromTaggedCbor(cborValue);
        return Signature.mldsaFromSignature(mldsaSig);
      }
    }

    throw new Error(
      "Signature must be a byte string (Schnorr), array (ECDSA/Ed25519/Sr25519), or tagged MLDSA",
    );
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
    const dummy = new Signature(SignatureScheme.Ed25519, new Uint8Array(ED25519_SIGNATURE_SIZE));
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
    const dummy = new Signature(SignatureScheme.Ed25519, new Uint8Array(ED25519_SIGNATURE_SIZE));
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR (Uniform Resource) Serialization
  // ============================================================================

  /**
   * Get the UR type for signatures.
   */
  static readonly UR_TYPE = "signature";

  /**
   * Returns the UR representation of the signature.
   */
  ur(): UR {
    return UR.new(Signature.UR_TYPE, this.taggedCbor());
  }

  /**
   * Returns the UR string representation of the signature.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a Signature from a UR.
   */
  static fromUR(ur: UR): Signature {
    ur.checkType(Signature.UR_TYPE);
    return Signature.fromTaggedCbor(ur.cbor());
  }

  /**
   * Creates a Signature from a UR string.
   */
  static fromURString(urString: string): Signature {
    const ur = UR.fromURString(urString);
    return Signature.fromUR(ur);
  }

  /**
   * Alias for fromURString for Rust API compatibility.
   */
  static fromUrString(urString: string): Signature {
    return Signature.fromURString(urString);
  }
}
