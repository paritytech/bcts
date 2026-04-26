/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * A globally unique reference to a globally unique object.
 *
 * Ported from bc-components-rust/src/reference.rs
 *
 * `Reference` is a 32-byte fixed-size identifier — typically derived from a
 * SHA-256 digest of an object's serialized form, but Rust also exposes
 * `Reference::from_data` for cases (like `XID`) where the underlying bytes
 * are themselves directly the reference identity.
 *
 * CDDL:
 * ```cddl
 * Reference = #6.40025(bytes .size 32)
 * ```
 */

import {
  type Cbor,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  type Tag,
  toByteString,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  expectBytes,
  tagsForValues,
} from "@bcts/dcbor";
import { REFERENCE as TAG_REFERENCE } from "@bcts/tags";
import { UR, encodeBytewordsIdentifier, encodeBytemojisIdentifier } from "@bcts/uniform-resources";

import { Digest } from "./digest.js";
import type { DigestProvider } from "./digest-provider.js";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

/** Encoding format for short Reference identifiers. */
export type ReferenceEncodingFormat = "hex" | "bytewords" | "bytemojis";

/**
 * Implementers of this interface provide a globally unique reference to themselves.
 *
 * Mirrors Rust's `ReferenceProvider` trait. The reference is derived from a
 * cryptographic digest of the object's serialized form, ensuring that it
 * uniquely identifies the object's contents.
 */
export interface ReferenceProvider {
  /** Returns a cryptographic reference that uniquely identifies this object. */
  reference(): Reference;
}

/**
 * Type guard to check if an object implements the ReferenceProvider interface.
 */
export function isReferenceProvider(obj: unknown): obj is ReferenceProvider {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "reference" in obj &&
    typeof (obj as ReferenceProvider).reference === "function"
  );
}

/**
 * A globally unique reference to a globally unique object.
 *
 * Internally stores 32 raw bytes (matches Rust's `Reference([u8; 32])`).
 * Most callers obtain a `Reference` via `fromDigest`, but `XID` (and similar
 * content-addressable types whose bytes _are_ the reference) construct
 * via `fromData` directly.
 */
export class Reference
  implements CborTaggedEncodable, CborTaggedDecodable<Reference>, DigestProvider, ReferenceProvider
{
  /** Reference data size in bytes — matches Rust `Reference::REFERENCE_SIZE`. */
  static readonly REFERENCE_SIZE = 32;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    this._data = data;
  }

  // ============================================================================
  // Factories
  // ============================================================================

  /** Create a Reference from exactly 32 bytes. Mirrors Rust `Reference::from_data`. */
  static fromData(data: Uint8Array): Reference {
    if (data.length !== Reference.REFERENCE_SIZE) {
      throw CryptoError.invalidSize(Reference.REFERENCE_SIZE, data.length);
    }
    return new Reference(new Uint8Array(data));
  }

  /** Alias of `fromData` for parity with Rust `from_data_ref`. */
  static fromDataRef(data: Uint8Array): Reference {
    return Reference.fromData(data);
  }

  /** Create a Reference from a Digest's underlying bytes. */
  static fromDigest(digest: Digest): Reference {
    return new Reference(new Uint8Array(digest.toData()));
  }

  /** Backwards-compatible alias of `fromDigest`. */
  static from(digest: Digest): Reference {
    return Reference.fromDigest(digest);
  }

  /** Create a Reference from a 64-character hex string. */
  static fromHex(hex: string): Reference {
    return Reference.fromData(hexToBytes(hex));
  }

  /**
   * Create a Reference whose bytes are the SHA-256 digest of the input.
   *
   * @deprecated Prefer `Reference.fromDigest(Digest.fromImage(data))` for
   *   clarity, or `Reference.fromData(data)` if `data` is already 32 bytes
   *   that should be wrapped without hashing (matches Rust `from_data`).
   */
  static hash(data: Uint8Array): Reference {
    return Reference.fromDigest(Digest.fromImage(data));
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  /** Returns the 32 reference bytes (copy). */
  data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /** Alias of `data()`. */
  asBytes(): Uint8Array {
    return this.data();
  }

  /** Returns a `Digest` constructed from these 32 bytes (no hashing). */
  getDigest(): Digest {
    return Digest.fromData(this._data);
  }

  /** The full 64-character lowercase hex of the reference. */
  refHex(): string {
    return bytesToHex(this._data);
  }

  /** The first 4 bytes of the reference. */
  refDataShort(): Uint8Array {
    return this._data.slice(0, 4);
  }

  /** The first 4 bytes of the reference, as 8 lowercase hex characters. */
  refHexShort(): string {
    return bytesToHex(this._data.slice(0, 4));
  }

  /**
   * The first 4 bytes as upper-case bytewords identifier.
   *
   * @param prefix - Optional prefix prepended with a single space.
   */
  bytewordsIdentifier(prefix?: string): string {
    const s = encodeBytewordsIdentifier(this.refDataShort()).toUpperCase();
    return prefix !== undefined ? `${prefix} ${s}` : s;
  }

  /**
   * The first 4 bytes as upper-case bytemojis identifier.
   *
   * @param prefix - Optional prefix prepended with a single space.
   */
  bytemojiIdentifier(prefix?: string): string {
    const s = encodeBytemojisIdentifier(this.refDataShort()).toUpperCase();
    return prefix !== undefined ? `${prefix} ${s}` : s;
  }

  // ============================================================================
  // Backwards-compatible accessors
  // ============================================================================

  /** Backwards-compatible alias of `refHex()`. */
  toHex(): string {
    return this.refHex();
  }

  /** Backwards-compatible alias of `refHex()`. */
  fullReference(): string {
    return this.refHex();
  }

  /** Returns the 32 raw bytes encoded as base64. */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Returns a short representation of this reference in the requested format.
   *
   * Mirrors the legacy TS API; new code should prefer `refHexShort`,
   * `bytewordsIdentifier`, or `bytemojiIdentifier` directly.
   */
  shortReference(format: ReferenceEncodingFormat = "hex"): string {
    switch (format) {
      case "hex":
        return this.refHexShort();
      case "bytewords":
        return encodeBytewordsIdentifier(this.refDataShort());
      case "bytemojis":
        return encodeBytemojisIdentifier(this.refDataShort());
      default: {
        const _exhaustive: never = format;
        throw CryptoError.invalidFormat(`Unknown reference format: ${String(_exhaustive)}`);
      }
    }
  }

  // ============================================================================
  // ReferenceProvider / DigestProvider
  // ============================================================================

  /** A Reference to this Reference (matches Rust's blanket `ReferenceProvider` impl). */
  reference(): Reference {
    return Reference.fromDigest(this.digest());
  }

  /**
   * SHA-256 of `taggedCbor().toCborData()`.
   *
   * Matches Rust's `DigestProvider for Reference` —
   * `Digest::from_image(self.tagged_cbor().to_cbor_data())`.
   */
  digest(): Digest {
    return Digest.fromImage(this.taggedCborData());
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  cborTags(): Tag[] {
    return tagsForValues([TAG_REFERENCE.value]);
  }

  /** Untagged CBOR — a single byte string of the 32 raw bytes. */
  untaggedCbor(): Cbor {
    return toByteString(this._data);
  }

  taggedCbor(): Cbor {
    return createTaggedCbor(this);
  }

  taggedCborData(): Uint8Array {
    return this.taggedCbor().toData();
  }

  // ============================================================================
  // CBOR Deserialization (CborTaggedDecodable)
  // ============================================================================

  fromUntaggedCbor(cbor: Cbor): Reference {
    return Reference.fromData(expectBytes(cbor));
  }

  fromTaggedCbor(cbor: Cbor): Reference {
    validateTag(cbor, this.cborTags());
    return this.fromUntaggedCbor(extractTaggedContent(cbor));
  }

  static fromTaggedCbor(cbor: Cbor): Reference {
    const dummy = new Reference(new Uint8Array(Reference.REFERENCE_SIZE));
    return dummy.fromTaggedCbor(cbor);
  }

  static fromTaggedCborData(data: Uint8Array): Reference {
    return Reference.fromTaggedCbor(decodeCbor(data));
  }

  static fromUntaggedCborData(data: Uint8Array): Reference {
    const dummy = new Reference(new Uint8Array(Reference.REFERENCE_SIZE));
    return dummy.fromUntaggedCbor(decodeCbor(data));
  }

  // ============================================================================
  // UR
  // ============================================================================

  static readonly UR_TYPE = "reference";

  /** UR representation — `ur:reference/...`, untagged CBOR payload. */
  ur(): UR {
    return UR.new(Reference.UR_TYPE, this.untaggedCbor());
  }

  urString(): string {
    return this.ur().string();
  }

  static fromUR(ur: UR): Reference {
    ur.checkType(Reference.UR_TYPE);
    const dummy = new Reference(new Uint8Array(Reference.REFERENCE_SIZE));
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  static fromURString(s: string): Reference {
    return Reference.fromUR(UR.fromURString(s));
  }

  // ============================================================================
  // Equality / display
  // ============================================================================

  equals(other: Reference): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /** Debug-style representation: `Reference(<8-hex-prefix>)`. */
  toString(): string {
    return `Reference(${this.refHexShort()})`;
  }
}
