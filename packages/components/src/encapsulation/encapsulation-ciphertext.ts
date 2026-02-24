/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Encapsulation ciphertext for key encapsulation mechanisms
 *
 * This type represents the ciphertext produced during key encapsulation.
 * For X25519, this is actually an ephemeral public key used in ECDH.
 * For MLKEM, this is the ciphertext from the ML-KEM encapsulation.
 *
 * # CBOR Serialization
 *
 * For X25519, the ciphertext is serialized with the X25519 public key tag (40011).
 * For MLKEM, the ciphertext is serialized with tag 40102.
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
import {
  X25519_PUBLIC_KEY as TAG_X25519_PUBLIC_KEY,
  MLKEM_CIPHERTEXT as TAG_MLKEM_CIPHERTEXT,
} from "@bcts/tags";
import { X25519PublicKey } from "../x25519/x25519-public-key.js";
import { EncapsulationScheme } from "./encapsulation-scheme.js";
import { MLKEMCiphertext } from "../mlkem/mlkem-ciphertext.js";
import { MLKEMLevel } from "../mlkem/mlkem-level.js";
import { bytesToHex } from "../utils.js";

/**
 * Convert MLKEMLevel to EncapsulationScheme
 */
function mlkemLevelToScheme(level: MLKEMLevel): EncapsulationScheme {
  switch (level) {
    case MLKEMLevel.MLKEM512:
      return EncapsulationScheme.MLKEM512;
    case MLKEMLevel.MLKEM768:
      return EncapsulationScheme.MLKEM768;
    case MLKEMLevel.MLKEM1024:
      return EncapsulationScheme.MLKEM1024;
  }
}

/**
 * Check if a scheme is an MLKEM scheme
 */
function isMlkemScheme(scheme: EncapsulationScheme): boolean {
  return (
    scheme === EncapsulationScheme.MLKEM512 ||
    scheme === EncapsulationScheme.MLKEM768 ||
    scheme === EncapsulationScheme.MLKEM1024
  );
}

/**
 * Represents the ciphertext from a key encapsulation operation.
 *
 * For X25519, this wraps an ephemeral public key.
 * For MLKEM, this wraps an MLKEMCiphertext.
 */
export class EncapsulationCiphertext
  implements CborTaggedEncodable, CborTaggedDecodable<EncapsulationCiphertext>
{
  private readonly _scheme: EncapsulationScheme;
  private readonly _x25519PublicKey: X25519PublicKey | undefined;
  private readonly _mlkemCiphertext: MLKEMCiphertext | undefined;

  private constructor(
    scheme: EncapsulationScheme,
    x25519PublicKey?: X25519PublicKey,
    mlkemCiphertext?: MLKEMCiphertext,
  ) {
    this._scheme = scheme;
    this._x25519PublicKey = x25519PublicKey;
    this._mlkemCiphertext = mlkemCiphertext;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an EncapsulationCiphertext from an X25519PublicKey.
   */
  static fromX25519PublicKey(publicKey: X25519PublicKey): EncapsulationCiphertext {
    return new EncapsulationCiphertext(EncapsulationScheme.X25519, publicKey, undefined);
  }

  /**
   * Create an EncapsulationCiphertext from raw X25519 data.
   */
  static fromX25519Data(data: Uint8Array): EncapsulationCiphertext {
    const publicKey = X25519PublicKey.fromDataRef(data);
    return EncapsulationCiphertext.fromX25519PublicKey(publicKey);
  }

  /**
   * Create an EncapsulationCiphertext from an MLKEMCiphertext.
   */
  static fromMlkem(ciphertext: MLKEMCiphertext): EncapsulationCiphertext {
    const scheme = mlkemLevelToScheme(ciphertext.level());
    return new EncapsulationCiphertext(scheme, undefined, ciphertext);
  }

  /**
   * Create an EncapsulationCiphertext from raw MLKEM ciphertext bytes.
   */
  static fromMlkemData(level: MLKEMLevel, data: Uint8Array): EncapsulationCiphertext {
    const ciphertext = MLKEMCiphertext.fromBytes(level, data);
    return EncapsulationCiphertext.fromMlkem(ciphertext);
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
   * Returns true if this is an MLKEM ciphertext.
   */
  isMlkem(): boolean {
    return isMlkemScheme(this._scheme);
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
   * Returns the MLKEM ciphertext if this is an MLKEM ciphertext.
   * @throws Error if this is not an MLKEM ciphertext
   */
  mlkemCiphertext(): MLKEMCiphertext {
    if (this._mlkemCiphertext === undefined) {
      throw new Error("Not an MLKEM ciphertext");
    }
    return this._mlkemCiphertext;
  }

  /**
   * Returns the X25519 public key if available, or null.
   */
  toX25519(): X25519PublicKey | null {
    return this._x25519PublicKey ?? null;
  }

  /**
   * Returns the MLKEM ciphertext if available, or null.
   */
  toMlkem(): MLKEMCiphertext | null {
    return this._mlkemCiphertext ?? null;
  }

  /**
   * Returns the raw ciphertext data.
   */
  data(): Uint8Array {
    if (this._scheme === EncapsulationScheme.X25519) {
      const pk = this._x25519PublicKey;
      if (pk === undefined) throw new Error("X25519 public key not set");
      return pk.data();
    } else if (isMlkemScheme(this._scheme)) {
      const ct = this._mlkemCiphertext;
      if (ct === undefined) throw new Error("MLKEM ciphertext not set");
      return ct.data();
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
  }

  /**
   * Compare with another EncapsulationCiphertext.
   */
  equals(other: EncapsulationCiphertext): boolean {
    if (this._scheme !== other._scheme) return false;
    if (this._scheme === EncapsulationScheme.X25519) {
      const thisPk = this._x25519PublicKey;
      const otherPk = other._x25519PublicKey;
      if (thisPk === undefined || otherPk === undefined) return false;
      return thisPk.equals(otherPk);
    } else if (isMlkemScheme(this._scheme)) {
      const thisCt = this._mlkemCiphertext;
      const otherCt = other._mlkemCiphertext;
      if (thisCt === undefined || otherCt === undefined) return false;
      return thisCt.equals(otherCt);
    }
    return false;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    if (this._scheme === EncapsulationScheme.X25519) {
      return `EncapsulationCiphertext(X25519, ${bytesToHex(this.data()).substring(0, 16)}...)`;
    } else if (isMlkemScheme(this._scheme)) {
      return `EncapsulationCiphertext(${String(this._scheme)}, ${bytesToHex(this.data()).substring(0, 16)}...)`;
    }
    return `EncapsulationCiphertext(${String(this._scheme)})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with this ciphertext.
   */
  cborTags(): Tag[] {
    if (this._scheme === EncapsulationScheme.X25519) {
      return tagsForValues([TAG_X25519_PUBLIC_KEY.value]);
    } else if (isMlkemScheme(this._scheme)) {
      return tagsForValues([TAG_MLKEM_CIPHERTEXT.value]);
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
  }

  /**
   * Returns the untagged CBOR encoding.
   */
  untaggedCbor(): Cbor {
    if (this._scheme === EncapsulationScheme.X25519) {
      const pk = this._x25519PublicKey;
      if (pk === undefined) throw new Error("X25519 public key not set");
      return toByteString(pk.data());
    } else if (isMlkemScheme(this._scheme)) {
      const ct = this._mlkemCiphertext;
      if (ct === undefined) throw new Error("MLKEM ciphertext not set");
      return ct.untaggedCbor();
    }
    throw new Error(`Unsupported scheme: ${String(this._scheme)}`);
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

    if (tag === TAG_MLKEM_CIPHERTEXT.value) {
      const mlkemCiphertext = MLKEMCiphertext.fromTaggedCbor(cborValue);
      return EncapsulationCiphertext.fromMlkem(mlkemCiphertext);
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
