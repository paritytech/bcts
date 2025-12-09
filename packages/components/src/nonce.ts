/**
 * A random nonce ("number used once").
 *
 * Ported from bc-components-rust/src/nonce.rs
 *
 * A `Nonce` is a cryptographic primitive consisting of a random or
 * pseudo-random number that is used only once in a cryptographic
 * communication. Nonces are often used in authentication protocols, encryption
 * algorithms, and digital signatures to prevent replay attacks and ensure
 * the uniqueness of encrypted messages.
 *
 * In this implementation, a `Nonce` is a 12-byte random value. The size is
 * chosen to be sufficiently large to prevent collisions while remaining
 * efficient for storage and transmission.
 *
 * # CBOR Serialization
 *
 * `Nonce` implements the CBOR tagged encoding interfaces, which means it can be
 * serialized to and deserialized from CBOR with a specific tag (TAG_NONCE = 40014).
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `Nonce` is represented as a
 * binary blob with the type "nonce".
 *
 * # Common Uses
 *
 * - In authenticated encryption schemes like AES-GCM or ChaCha20-Poly1305
 * - For initializing counters in counter-mode block ciphers
 * - In challenge-response authentication protocols
 * - To prevent replay attacks in secure communications
 *
 * @example
 * ```typescript
 * import { Nonce } from '@blockchain-commons/components';
 *
 * // Generate a new random nonce
 * const nonce = Nonce.new();
 *
 * // Create a nonce from a byte array
 * const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
 * const nonce2 = Nonce.fromData(data);
 *
 * // Access the nonce data
 * const nonceData = nonce2.data();
 * ```
 */

import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import { SYMMETRIC_NONCE_SIZE } from "@blockchain-commons/crypto";
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
} from "@blockchain-commons/dcbor";
import { NONCE as TAG_NONCE } from "@blockchain-commons/tags";
import { UR, type UREncodable } from "@blockchain-commons/uniform-resources";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

export class Nonce implements CborTaggedEncodable, CborTaggedDecodable<Nonce>, UREncodable {
  static readonly NONCE_SIZE = SYMMETRIC_NONCE_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== Nonce.NONCE_SIZE) {
      throw CryptoError.invalidSize(Nonce.NONCE_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new random nonce.
   */
  static new(): Nonce {
    const rng = new SecureRandomNumberGenerator();
    return new Nonce(rng.randomData(Nonce.NONCE_SIZE));
  }

  /**
   * Create a new random nonce (alias for compatibility).
   */
  static random(): Nonce {
    return Nonce.new();
  }

  /**
   * Restores a nonce from data.
   */
  static fromData(data: Uint8Array): Nonce {
    return new Nonce(new Uint8Array(data));
  }

  /**
   * Restores a nonce from data (validates length).
   */
  static fromDataRef(data: Uint8Array): Nonce {
    if (data.length !== Nonce.NONCE_SIZE) {
      throw CryptoError.invalidSize(Nonce.NONCE_SIZE, data.length);
    }
    return Nonce.fromData(data);
  }

  /**
   * Create a Nonce from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): Nonce {
    return Nonce.fromData(data);
  }

  /**
   * Create a new nonce from the given hexadecimal string.
   *
   * @throws Error if the string is not exactly 24 hexadecimal digits.
   */
  static fromHex(hex: string): Nonce {
    return new Nonce(hexToBytes(hex));
  }

  /**
   * Generate a random nonce using provided RNG.
   */
  static randomUsing(rng: SecureRandomNumberGenerator): Nonce {
    return new Nonce(rng.randomData(Nonce.NONCE_SIZE));
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Get the data of the nonce.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Get the nonce as a byte slice.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get the raw nonce bytes as a copy.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * The data as a hexadecimal string.
   */
  hex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Get hex string representation (alias for hex()).
   */
  toHex(): string {
    return this.hex();
  }

  /**
   * Get base64 representation.
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Compare with another Nonce.
   */
  equals(other: Nonce): boolean {
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
    return `Nonce(${this.hex()})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with Nonce.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_NONCE.value]);
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
   * Creates a Nonce by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): Nonce {
    const data = expectBytes(cbor);
    return Nonce.fromDataRef(data);
  }

  /**
   * Creates a Nonce by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): Nonce {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): Nonce {
    const instance = new Nonce(new Uint8Array(Nonce.NONCE_SIZE));
    return instance.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): Nonce {
    const cbor = decodeCbor(data);
    return Nonce.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): Nonce {
    const cbor = decodeCbor(data);
    const bytes = expectBytes(cbor);
    return Nonce.fromDataRef(bytes);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the Nonce.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("nonce", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a Nonce from a UR.
   */
  static fromUR(ur: UR): Nonce {
    ur.checkType("nonce");
    const instance = new Nonce(new Uint8Array(Nonce.NONCE_SIZE));
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a Nonce from a UR string.
   */
  static fromURString(urString: string): Nonce {
    const ur = UR.fromURString(urString);
    return Nonce.fromUR(ur);
  }
}
