/**
 * eXtensible Identifier (XID) - 32-byte identifier bound to a public key
 *
 * A XID is a unique 32-byte identifier for a subject entity (person,
 * organization, device, or any other entity). XIDs have the following
 * characteristics:
 *
 * - They're cryptographically tied to a public key at inception (the
 *   "inception key")
 * - They remain stable throughout their lifecycle even as their keys and
 *   permissions change
 * - They can be extended to XID documents containing keys, endpoints,
 *   permissions, and delegation info
 * - They support key rotation and multiple verification schemes
 * - They allow for delegation of specific permissions to other entities
 * - They can include resolution methods to locate and verify the XID document
 *
 * A XID is created by taking the SHA-256 hash of the CBOR encoding of a public
 * signing key. This ensures the XID is cryptographically tied to the key.
 *
 * As defined in [BCR-2024-010](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-010-xid.md).
 *
 * # CBOR Serialization
 *
 * `XID` is serialized to CBOR with tag 40024 (standard XID tag).
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `XID` is represented with the
 * type "xid".
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  toByteString,
  expectBytes,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { XID as TAG_XID } from "@bcts/tags";
import {
  UR,
  type UREncodable,
  encodeBytewordsIdentifier,
  encodeBytemojisIdentifier,
} from "@bcts/uniform-resources";
import { CryptoError } from "../error.js";
import { bytesToHex, toBase64 } from "../utils.js";

/** XID prefix for bytewords/bytemoji identifiers */
const XID_PREFIX = "🅧";

const XID_SIZE = 32;

export class XID implements CborTaggedEncodable, CborTaggedDecodable<XID>, UREncodable {
  static readonly XID_SIZE = XID_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== XID_SIZE) {
      throw CryptoError.invalidSize(XID_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new XID from data.
   */
  static fromData(data: Uint8Array): XID {
    return new XID(new Uint8Array(data));
  }

  /**
   * Create a new XID from data (validates length).
   *
   * Returns error if the data is not the correct length.
   */
  static fromDataRef(data: Uint8Array): XID {
    if (data.length !== XID_SIZE) {
      throw CryptoError.invalidSize(XID_SIZE, data.length);
    }
    return XID.fromData(data);
  }

  /**
   * Create an XID from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): XID {
    return XID.fromData(data);
  }

  /**
   * Create an XID from hex string (64 hex characters).
   */
  static fromHex(hex: string): XID {
    if (hex.length !== 64) {
      throw CryptoError.invalidFormat(`XID hex must be 64 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      data[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return new XID(data);
  }

  /**
   * Generate a random XID (for testing purposes).
   *
   * Note: In practice, XIDs should be created from the SHA-256 hash of a
   * public signing key's CBOR encoding.
   */
  static random(): XID {
    const data = new Uint8Array(XID_SIZE);
    const crypto = globalThis.crypto as Crypto | undefined;
    if (crypto !== undefined && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(data);
    } else {
      // Fallback: fill with available random data
      for (let i = 0; i < XID_SIZE; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
    }
    return new XID(data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Return the data of the XID.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Get the data of the XID as a byte slice.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get a copy of the raw XID bytes.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Get hex string representation (lowercase, matching Rust implementation).
   */
  toHex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Get base64 representation.
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Get short description (first 4 bytes) as hex.
   */
  shortDescription(): string {
    return bytesToHex(this._data.slice(0, 4));
  }

  /**
   * Get short reference (first 4 bytes) as hex (alias for shortDescription).
   */
  shortReference(): string {
    return this.shortDescription();
  }

  /**
   * Get the first four bytes of the XID as upper-case ByteWords.
   *
   * @param prefix - If true, prepends the XID prefix "🅧 "
   * @returns Space-separated uppercase bytewords, e.g., "🅧 URGE DICE GURU IRIS"
   */
  bytewordsIdentifier(prefix = false): string {
    const words = encodeBytewordsIdentifier(this._data.slice(0, 4)).toUpperCase();
    return prefix ? `${XID_PREFIX} ${words}` : words;
  }

  /**
   * Get the first four bytes of the XID as Bytemoji.
   *
   * @param prefix - If true, prepends the XID prefix "🅧 "
   * @returns Space-separated emojis, e.g., "🅧 🐻 😻 🍞 💐"
   */
  bytemojisIdentifier(prefix = false): string {
    const emojis = encodeBytemojisIdentifier(this._data.slice(0, 4));
    return prefix ? `${XID_PREFIX} ${emojis}` : emojis;
  }

  /**
   * Compare with another XID.
   */
  equals(other: XID): boolean {
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
    return `XID(${this.toHex()})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with XID.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_XID.value]);
  }

  /**
   * Returns the untagged CBOR encoding (as a byte string).
   */
  untaggedCbor(): Cbor {
    return toByteString(this._data);
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
   * Creates a XID by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): XID {
    const data = expectBytes(cbor);
    return XID.fromDataRef(data);
  }

  /**
   * Creates a XID by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): XID {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): XID {
    const instance = new XID(new Uint8Array(XID_SIZE));
    return instance.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): XID {
    const cbor = decodeCbor(data);
    return XID.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): XID {
    const cbor = decodeCbor(data);
    const bytes = expectBytes(cbor);
    return XID.fromDataRef(bytes);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the XID.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("xid", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a XID from a UR.
   */
  static fromUR(ur: UR): XID {
    ur.checkType("xid");
    const instance = new XID(new Uint8Array(XID_SIZE));
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a XID from a UR string.
   */
  static fromURString(urString: string): XID {
    const ur = UR.fromURString(urString);
    return XID.fromUR(ur);
  }
}
