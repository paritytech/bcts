/**
 * Random salt used to decorrelate other information.
 *
 * Ported from bc-components-rust/src/salt.rs
 *
 * A `Salt` is a cryptographic primitive consisting of random data that is used
 * to modify the output of a cryptographic function. Salts are primarily used
 * in password hashing to defend against dictionary attacks, rainbow table
 * attacks, and pre-computation attacks. They are also used in other
 * cryptographic contexts to ensure uniqueness and prevent correlation between
 * different parts of a cryptosystem.
 *
 * Unlike a `Nonce` which has a fixed size, a `Salt` in this implementation can
 * have a variable length (minimum 8 bytes). Different salt creation methods
 * are provided to generate salts of appropriate sizes for different use cases.
 *
 * # Minimum Size Requirement
 *
 * For security reasons, salts must be at least 8 bytes long. Attempting to
 * create a salt with fewer than 8 bytes will result in an error.
 *
 * # CBOR Serialization
 *
 * `Salt` implements the CBOR tagged encoding interfaces, which means it can be
 * serialized to and deserialized from CBOR with a specific tag (TAG_SALT = 40018).
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `Salt` is represented as a
 * binary blob with the type "salt".
 *
 * # Common Uses
 *
 * - Password hashing and key derivation functions
 * - Preventing correlation in cryptographic protocols
 * - Randomizing data before encryption to prevent pattern recognition
 * - Adding entropy to improve security in various cryptographic functions
 *
 * @example
 * ```typescript
 * import { Salt } from '@bcts/components';
 *
 * // Generate a salt with 16 bytes
 * const salt = Salt.newWithLen(16);
 * console.log(salt.len()); // 16
 *
 * // Generate a salt proportional to 100 bytes of data
 * const salt2 = Salt.newForSize(100);
 *
 * // Generate a salt with length between 16 and 32 bytes
 * const salt3 = Salt.newInRange(16, 32);
 * ```
 */

import {
  SecureRandomNumberGenerator,
  type RandomNumberGenerator,
  rngNextInClosedRangeI32,
} from "@bcts/rand";
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
import { SALT as TAG_SALT } from "@bcts/tags";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

const MIN_SALT_SIZE = 8;

export class Salt implements CborTaggedEncodable, CborTaggedDecodable<Salt>, UREncodable {
  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new salt from data.
   * Note: Does not validate minimum size to allow for CBOR deserialization.
   */
  static fromData(data: Uint8Array): Salt {
    return new Salt(new Uint8Array(data));
  }

  /**
   * Create a Salt from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): Salt {
    return Salt.fromData(data);
  }

  /**
   * Create a new salt from the given hexadecimal string.
   */
  static fromHex(hex: string): Salt {
    return Salt.fromData(hexToBytes(hex));
  }

  /**
   * Create a specific number of bytes of salt.
   *
   * @throws Error if the number of bytes is less than 8.
   */
  static newWithLen(count: number): Salt {
    const rng = new SecureRandomNumberGenerator();
    return Salt.newWithLenUsing(count, rng);
  }

  /**
   * Create a specific number of bytes of salt using provided RNG.
   *
   * @throws Error if the number of bytes is less than 8.
   */
  static newWithLenUsing(count: number, rng: RandomNumberGenerator): Salt {
    if (count < MIN_SALT_SIZE) {
      throw CryptoError.dataTooShort("salt", MIN_SALT_SIZE, count);
    }
    return new Salt(rng.randomData(count));
  }

  /**
   * Create a number of bytes of salt chosen randomly from the given range.
   *
   * @throws Error if the minimum number of bytes is less than 8.
   */
  static newInRange(minSize: number, maxSize: number): Salt {
    if (minSize < MIN_SALT_SIZE) {
      throw CryptoError.dataTooShort("salt", MIN_SALT_SIZE, minSize);
    }
    const rng = new SecureRandomNumberGenerator();
    return Salt.newInRangeUsing(minSize, maxSize, rng);
  }

  /**
   * Create a number of bytes of salt chosen randomly from the given range using provided RNG.
   *
   * @throws Error if the minimum number of bytes is less than 8.
   */
  static newInRangeUsing(minSize: number, maxSize: number, rng: RandomNumberGenerator): Salt {
    if (minSize < MIN_SALT_SIZE) {
      throw CryptoError.dataTooShort("salt", MIN_SALT_SIZE, minSize);
    }
    const count = rngNextInClosedRangeI32(rng, minSize, maxSize);
    return Salt.newWithLenUsing(count, rng);
  }

  /**
   * Create a number of bytes of salt generally proportionate to the size of
   * the object being salted.
   */
  static newForSize(size: number): Salt {
    const rng = new SecureRandomNumberGenerator();
    return Salt.newForSizeUsing(size, rng);
  }

  /**
   * Create a number of bytes of salt generally proportionate to the size of
   * the object being salted using provided RNG.
   */
  static newForSizeUsing(size: number, rng: RandomNumberGenerator): Salt {
    const count = size;
    const minSize = Math.max(MIN_SALT_SIZE, Math.ceil(count * 0.05));
    const maxSize = Math.max(minSize + 8, Math.ceil(count * 0.25));
    return Salt.newInRangeUsing(minSize, maxSize, rng);
  }

  /**
   * Generate a random salt with specified size (legacy alias for newWithLen).
   */
  static random(size = 16): Salt {
    return Salt.newWithLen(size);
  }

  /**
   * Generate a random salt with specified size using provided RNG (legacy alias).
   */
  static randomUsing(rng: RandomNumberGenerator, size = 16): Salt {
    return Salt.newWithLenUsing(size, rng);
  }

  /**
   * Generate a proportionally-sized salt (legacy alias for newForSize).
   */
  static proportional(dataSize: number): Salt {
    return Salt.newForSize(dataSize);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Return the length of the salt.
   */
  len(): number {
    return this._data.length;
  }

  /**
   * Return the length of the salt (alias for len).
   */
  size(): number {
    return this.len();
  }

  /**
   * Return true if the salt is empty (this is not recommended).
   */
  isEmpty(): boolean {
    return this._data.length === 0;
  }

  /**
   * Return the data of the salt.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get the raw salt bytes as a copy.
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
   * Compare with another Salt.
   */
  equals(other: Salt): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation showing the salt's length.
   */
  toString(): string {
    return `Salt(${this.len()})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with Salt.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SALT.value]);
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
   * Creates a Salt by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): Salt {
    const data = expectBytes(cbor);
    return Salt.fromData(data);
  }

  /**
   * Creates a Salt by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): Salt {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): Salt {
    const instance = new Salt(new Uint8Array(0));
    return instance.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): Salt {
    const cbor = decodeCbor(data);
    return Salt.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): Salt {
    const cbor = decodeCbor(data);
    const bytes = expectBytes(cbor);
    return Salt.fromData(bytes);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the Salt.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("salt", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a Salt from a UR.
   */
  static fromUR(ur: UR): Salt {
    ur.checkType("salt");
    const instance = new Salt(new Uint8Array(0));
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a Salt from a UR string.
   */
  static fromURString(urString: string): Salt {
    const ur = UR.fromURString(urString);
    return Salt.fromUR(ur);
  }
}
