/**
 * A value in a namespace of unsigned integers that represents a stand-alone
 * ontological concept.
 *
 * Known Values provide a compact, deterministic way to represent commonly used
 * ontological concepts such as relationships between entities, classes of
 * entities, properties, or enumerated values. They are particularly useful as
 * predicates in Gordian Envelope assertions, offering a more compact and
 * deterministic alternative to URIs. However, known values are not exclusive
 * to Gordian Envelopes and can be used in any context where a compact, unique
 * identifier for a concept is needed.
 *
 * A Known Value is represented as a 64-bit unsigned integer with an optional
 * human-readable name. This approach ensures:
 *
 * - **Compact binary representation** - Each Known Value requires only 1-9
 *   bytes depending on value range
 * - **Deterministic encoding** - Every concept has exactly one valid binary
 *   representation
 * - **Enhanced security** - Eliminates URI manipulation vulnerabilities
 * - **Standardized semantics** - Values are registered in a central registry
 *
 * While Known Values are most commonly used as predicates in assertions, they
 * can appear in any position in an Envelope (subject, predicate, or object).
 *
 * @example
 * ```typescript
 * import { KnownValue } from '@bcts/known-values';
 *
 * // Create a Known Value with a numeric value
 * const knownValue = new KnownValue(42);
 * console.log(knownValue.value()); // 42
 *
 * // Create a Known Value with a name
 * const namedValue = new KnownValue(1, 'isA');
 * console.log(namedValue.value()); // 1
 * console.log(namedValue.name()); // "isA"
 *
 * // CBOR encoding
 * const cbor = namedValue.taggedCbor();
 * const bytes = namedValue.toCborData();
 *
 * // CBOR decoding
 * const decoded = KnownValue.fromTaggedCbor(cbor);
 * const decodedFromBytes = KnownValue.fromCborData(bytes);
 *
 * // Use a pre-defined Known Value from the registry
 * import { IS_A } from '@bcts/known-values';
 * console.log(IS_A.value()); // 1
 * console.log(IS_A.name()); // "isA"
 * ```
 *
 * @specification
 *
 * Known Values are defined in
 * [BCR-2023-002](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-002-known-value.md)
 * and implemented as an Envelope extension in
 * [BCR-2023-003](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-003-envelope-known-value.md).
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  cborData,
  decodeCbor,
  MajorType,
} from "@bcts/dcbor";
import { KNOWN_VALUE, Digest, type DigestProvider } from "@bcts/components";

/**
 * The numeric value for the CBOR tag used for Known Values.
 * This is Tag 40000 as defined in the Blockchain Commons registry.
 */
export const TAG_KNOWN_VALUE = KNOWN_VALUE.value;

/**
 * The CBOR tag used for Known Values.
 * This is Tag 40000 as defined in the Blockchain Commons registry.
 */
export const KNOWN_VALUE_TAG: Tag = KNOWN_VALUE;

/**
 * Type for values that can be used to create a KnownValue.
 * Supports both number (for values up to 2^53-1) and bigint (for full 64-bit range).
 */
export type KnownValueInput = number | bigint;

export class KnownValue
  implements CborTaggedEncodable, CborTaggedDecodable<KnownValue>, DigestProvider
{
  private readonly _value: bigint;
  private readonly _assignedName: string | undefined;

  /**
   * Creates a new KnownValue with the given numeric value and optional name.
   *
   * @param value - The numeric value (number or bigint). Numbers are converted to bigint internally.
   * @param assignedName - Optional human-readable name for the value
   *
   * @example
   * ```typescript
   * const knownValue = new KnownValue(42);
   * console.log(knownValue.value()); // 42
   *
   * const namedValue = new KnownValue(1, 'isA');
   * console.log(namedValue.name()); // "isA"
   *
   * // Using bigint for large values
   * const largeValue = new KnownValue(9007199254740993n);
   * ```
   */
  constructor(value: KnownValueInput, assignedName?: string) {
    this._value = typeof value === "bigint" ? value : BigInt(value);
    this._assignedName = assignedName;
  }

  // ===========================================================================
  // Value Accessors (backward compatible API)
  // ===========================================================================

  /**
   * Returns the numeric value of the KnownValue.
   *
   * This is the raw unsigned integer that identifies the concept.
   * Returns a number for backward compatibility. For values > MAX_SAFE_INTEGER,
   * use `valueBigInt()`.
   *
   * @example
   * ```typescript
   * import { IS_A, NOTE } from '@bcts/known-values';
   * console.log(IS_A.value()); // 1
   * console.log(NOTE.value()); // 4
   * ```
   */
  value(): number {
    if (this._value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError(
        `KnownValue ${this._value} exceeds MAX_SAFE_INTEGER. Use valueBigInt() instead.`,
      );
    }
    return Number(this._value);
  }

  /**
   * Returns the numeric value of the KnownValue as a bigint.
   *
   * Use this for values that may exceed Number.MAX_SAFE_INTEGER (2^53-1).
   *
   * @example
   * ```typescript
   * const largeValue = new KnownValue(9007199254740993n);
   * console.log(largeValue.valueBigInt()); // 9007199254740993n
   * ```
   */
  valueBigInt(): bigint {
    return this._value;
  }

  /**
   * Returns the assigned name of the KnownValue, if one exists.
   *
   * @example
   * ```typescript
   * const namedValue = new KnownValue(1, 'isA');
   * console.log(namedValue.assignedName()); // "isA"
   *
   * const unnamedValue = new KnownValue(42);
   * console.log(unnamedValue.assignedName()); // undefined
   * ```
   */
  assignedName(): string | undefined {
    return this._assignedName;
  }

  /**
   * Returns a human-readable name for the KnownValue.
   *
   * If the KnownValue has an assigned name, that name is returned.
   * Otherwise, the string representation of the numeric value is returned.
   *
   * @example
   * ```typescript
   * const namedValue = new KnownValue(1, 'isA');
   * console.log(namedValue.name()); // "isA"
   *
   * const unnamedValue = new KnownValue(42);
   * console.log(unnamedValue.name()); // "42"
   * ```
   */
  name(): string {
    return this._assignedName ?? this._value.toString();
  }

  // ===========================================================================
  // Equality and Hashing
  // ===========================================================================

  /**
   * Compares this KnownValue with another for equality.
   * Equality is based solely on the numeric value, ignoring the name.
   *
   * @param other - The KnownValue to compare with
   * @returns true if the values are equal
   *
   * @example
   * ```typescript
   * const kv1 = new KnownValue(1, 'isA');
   * const kv2 = new KnownValue(1, 'different');
   * console.log(kv1.equals(kv2)); // true (same value, different name)
   * ```
   */
  equals(other: KnownValue): boolean {
    return this._value === other._value;
  }

  /**
   * Hash code based on the numeric value.
   * Useful for using KnownValue in hash-based collections.
   */
  hashCode(): number {
    // Convert bigint to a 32-bit hash
    return Number(this._value & BigInt(0xffffffff));
  }

  // ===========================================================================
  // DigestProvider Implementation
  // ===========================================================================

  /**
   * Returns the cryptographic digest of this KnownValue.
   *
   * The digest is computed from the tagged CBOR encoding of the value,
   * providing a unique content-addressable identifier.
   *
   * This is used for Envelope integration where KnownValues are hashed
   * for tree construction.
   *
   * @returns A Digest of the tagged CBOR encoding
   *
   * @example
   * ```typescript
   * const kv = new KnownValue(1, "isA");
   * const digest = kv.digest();
   * console.log(digest.hex()); // SHA-256 hash of the CBOR encoding
   * ```
   */
  digest(): Digest {
    return Digest.fromImage(this.toCborData());
  }

  /**
   * String representation of the KnownValue.
   *
   * If a name is assigned, the name is displayed. Otherwise, the numeric value
   * is displayed.
   */
  toString(): string {
    return this.name();
  }

  // ===========================================================================
  // CBOR Encoding (CborTaggedEncodable interface)
  // ===========================================================================

  /**
   * Returns the CBOR tags associated with KnownValue.
   *
   * The primary tag is TAG_KNOWN_VALUE (201).
   *
   * @returns Array containing the KnownValue tag
   */
  cborTags(): Tag[] {
    return [KNOWN_VALUE_TAG];
  }

  /**
   * Returns the untagged CBOR encoding of this KnownValue.
   *
   * The untagged representation is simply the unsigned integer value.
   *
   * @returns CBOR representation of the value (unsigned integer)
   */
  untaggedCbor(): Cbor {
    return cbor(this._value);
  }

  /**
   * Returns the tagged CBOR encoding of this KnownValue.
   *
   * This wraps the unsigned integer value with tag 201.
   *
   * @returns Tagged CBOR representation
   *
   * @example
   * ```typescript
   * const kv = new KnownValue(1, 'isA');
   * const tagged = kv.taggedCbor();
   * console.log(tagged.toHex()); // "d8c901" (tag 201, value 1)
   * ```
   */
  taggedCbor(): Cbor {
    return cbor({
      tag: TAG_KNOWN_VALUE,
      value: this._value,
    });
  }

  /**
   * Returns the tagged CBOR encoding as binary data.
   *
   * @returns Binary CBOR representation
   *
   * @example
   * ```typescript
   * const kv = new KnownValue(1, 'isA');
   * const bytes = kv.toCborData();
   * // bytes is Uint8Array containing the CBOR encoding
   * ```
   */
  toCborData(): Uint8Array {
    return cborData(this.taggedCbor());
  }

  /**
   * Alias for `toCborData()` to match the dcbor interface.
   */
  taggedCborData(): Uint8Array {
    return this.toCborData();
  }

  // ===========================================================================
  // CBOR Decoding (CborTaggedDecodable interface)
  // ===========================================================================

  /**
   * Creates a KnownValue from untagged CBOR (an unsigned integer).
   * Instance method for interface compliance.
   *
   * @param cborValue - The CBOR value (must be an unsigned integer)
   * @returns A new KnownValue
   * @throws {Error} If the CBOR is not an unsigned integer
   */
  fromUntaggedCbor(cborValue: Cbor): KnownValue {
    return KnownValue.fromUntaggedCbor(cborValue);
  }

  /**
   * Creates a KnownValue from tagged CBOR (tag 201).
   * Instance method for interface compliance.
   *
   * @param cborValue - The tagged CBOR value
   * @returns A new KnownValue
   * @throws {Error} If the CBOR is not properly tagged or contains invalid data
   */
  fromTaggedCbor(cborValue: Cbor): KnownValue {
    return KnownValue.fromTaggedCbor(cborValue);
  }

  // ===========================================================================
  // Static Factory Methods
  // ===========================================================================

  /**
   * Creates a KnownValue from untagged CBOR (an unsigned integer).
   *
   * @param cborValue - The CBOR value (must be an unsigned integer)
   * @returns A new KnownValue
   * @throws {Error} If the CBOR is not an unsigned integer
   *
   * @example
   * ```typescript
   * const cborValue = cbor(42);
   * const kv = KnownValue.fromUntaggedCbor(cborValue);
   * console.log(kv.value()); // 42
   * ```
   */
  static fromUntaggedCbor(cborValue: Cbor): KnownValue {
    if (cborValue.type !== MajorType.Unsigned) {
      throw new Error(`Expected unsigned integer for KnownValue, got major type ${cborValue.type}`);
    }
    const numValue = cborValue.value as number | bigint;
    return new KnownValue(typeof numValue === "bigint" ? numValue : BigInt(numValue));
  }

  /**
   * Creates a KnownValue from tagged CBOR (tag 201).
   *
   * @param cborValue - The tagged CBOR value
   * @returns A new KnownValue
   * @throws {Error} If the CBOR is not properly tagged or contains invalid data
   *
   * @example
   * ```typescript
   * const kv = KnownValue.fromTaggedCbor(taggedCborValue);
   * ```
   */
  static fromTaggedCbor(cborValue: Cbor): KnownValue {
    if (cborValue.type !== MajorType.Tagged) {
      throw new Error(`Expected tagged CBOR for KnownValue, got major type ${cborValue.type}`);
    }

    const tag = cborValue.tag;
    if (tag !== BigInt(TAG_KNOWN_VALUE) && tag !== TAG_KNOWN_VALUE) {
      throw new Error(`Expected tag ${TAG_KNOWN_VALUE} for KnownValue, got ${tag}`);
    }

    return KnownValue.fromUntaggedCbor(cborValue.value);
  }

  /**
   * Creates a KnownValue from binary CBOR data.
   *
   * @param data - Binary CBOR data (must be a tagged KnownValue)
   * @returns A new KnownValue
   * @throws {Error} If the data cannot be decoded or is not a valid KnownValue
   *
   * @example
   * ```typescript
   * const bytes = new Uint8Array([0xd8, 0xc9, 0x01]); // tag 201, value 1
   * const kv = KnownValue.fromCborData(bytes);
   * console.log(kv.value()); // 1
   * ```
   */
  static fromCborData(data: Uint8Array): KnownValue {
    const cborValue = decodeCbor(data);
    return KnownValue.fromTaggedCbor(cborValue);
  }

  /**
   * Creates a KnownValue from a CBOR value, automatically detecting
   * whether it's tagged or untagged.
   *
   * @param cborValue - The CBOR value (tagged or untagged)
   * @returns A new KnownValue
   * @throws {Error} If the CBOR cannot be converted to a KnownValue
   *
   * @example
   * ```typescript
   * // Works with both tagged and untagged
   * const kv1 = KnownValue.fromCbor(cbor(42));
   * const kv2 = KnownValue.fromCbor(taggedCborValue);
   * ```
   */
  static fromCbor(cborValue: Cbor): KnownValue {
    if (cborValue.type === MajorType.Tagged) {
      return KnownValue.fromTaggedCbor(cborValue);
    }
    return KnownValue.fromUntaggedCbor(cborValue);
  }
}
