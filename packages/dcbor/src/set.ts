/**
 * Set data structure for CBOR with tag(258) encoding.
 *
 * A Set is encoded as an array with no duplicate elements,
 * tagged with tag(258) to indicate set semantics.
 *
 * @module set
 */

import { type Cbor, MajorType, type CborInput } from "./cbor";
import { cbor, cborData } from "./cbor";
import { CborMap } from "./map";
import { createTag, type Tag } from "./tag";
import { TAG_SET } from "./tags";
import {
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
} from "./cbor-tagged";
import { extractCbor } from "./conveniences";
import { CborError } from "./error";

/**
 * CBOR Set type with tag(258) encoding.
 *
 * Internally uses a CborMap to ensure unique elements with deterministic ordering.
 * Elements are ordered by their CBOR encoding (lexicographic byte order).
 *
 * @example
 * ```typescript
 * // Create set
 * const set = CborSet.fromArray([1, 2, 3]);
 * const set2 = CborSet.fromSet(new Set([1, 2, 3]));
 *
 * // Add elements
 * set.insert(4);
 * set.insert(2); // Duplicate, no effect
 *
 * // Check membership
 * console.log(set.contains(2)); // true
 * console.log(set.contains(99)); // false
 *
 * // Encode to CBOR
 * const tagged = set.taggedCbor();
 * ```
 */
export class CborSet implements CborTaggedEncodable, CborTaggedDecodable<CborSet> {
  private readonly _map: CborMap;

  constructor() {
    this._map = new CborMap();
  }

  // =========================================================================
  // Factory Methods
  // =========================================================================

  /**
   * Create CborSet from array.
   *
   * Duplicates are automatically removed.
   *
   * @param items - Array of items to add to the set
   * @returns New CborSet instance
   *
   * @example
   * ```typescript
   * const set = CborSet.fromArray([1, 2, 3, 2, 1]);
   * console.log(set.size); // 3
   * ```
   */
  static fromArray<T extends CborInput>(items: T[]): CborSet {
    const set = new CborSet();
    for (const item of items) {
      set.insert(item);
    }
    return set;
  }

  /**
   * Create CborSet from JavaScript Set.
   *
   * @param items - JavaScript Set of items
   * @returns New CborSet instance
   *
   * @example
   * ```typescript
   * const jsSet = new Set([1, 2, 3]);
   * const cborSet = CborSet.fromSet(jsSet);
   * ```
   */
  static fromSet<T extends CborInput>(items: Set<T>): CborSet {
    return CborSet.fromArray(Array.from(items));
  }

  /**
   * Create CborSet from iterable.
   *
   * @param items - Iterable of items
   * @returns New CborSet instance
   */
  static fromIterable<T extends CborInput>(items: Iterable<T>): CborSet {
    return CborSet.fromArray(Array.from(items));
  }

  // =========================================================================
  // Core Methods
  // =========================================================================

  /**
   * Insert an element into the set.
   *
   * If the element already exists, has no effect.
   *
   * @param value - Value to insert
   *
   * @example
   * ```typescript
   * const set = new CborSet();
   * set.insert(1);
   * set.insert(2);
   * set.insert(1); // No effect, already exists
   * ```
   */
  insert(value: CborInput): void {
    const cborValue = encodeCborValue(value);
    // In a set, key and value are the same
    this._map.set(cborValue, cborValue);
  }

  /**
   * Check if set contains an element.
   *
   * @param value - Value to check
   * @returns true if element is in the set
   *
   * @example
   * ```typescript
   * const set = CborSet.fromArray([1, 2, 3]);
   * console.log(set.contains(2)); // true
   * console.log(set.contains(99)); // false
   * ```
   */
  contains(value: CborInput): boolean {
    const cborValue = encodeCborValue(value);
    return this._map.has(cborValue);
  }

  /**
   * Remove an element from the set.
   *
   * @param value - Value to remove
   * @returns true if element was removed, false if not found
   *
   * @example
   * ```typescript
   * const set = CborSet.fromArray([1, 2, 3]);
   * set.delete(2); // Returns true
   * set.delete(99); // Returns false
   * ```
   */
  delete(value: CborInput): boolean {
    const cborValue = encodeCborValue(value);
    return this._map.delete(cborValue);
  }

  /**
   * Remove all elements from the set.
   */
  clear(): void {
    this._map.clear();
  }

  /**
   * Get the number of elements in the set.
   *
   * @returns Number of elements
   */
  get size(): number {
    return this._map.size;
  }

  /**
   * Check if the set is empty.
   *
   * @returns true if set has no elements
   */
  isEmpty(): boolean {
    return this._map.size === 0;
  }

  // =========================================================================
  // Set Operations
  // =========================================================================

  /**
   * Create a new set containing elements in this set or the other set.
   *
   * @param other - Other set
   * @returns New set with union of elements
   *
   * @example
   * ```typescript
   * const set1 = CborSet.fromArray([1, 2, 3]);
   * const set2 = CborSet.fromArray([3, 4, 5]);
   * const union = set1.union(set2);
   * // union contains [1, 2, 3, 4, 5]
   * ```
   */
  union(other: CborSet): CborSet {
    const result = new CborSet();
    for (const value of this) {
      result.insert(extractCbor(value) as CborInput);
    }
    for (const value of other) {
      result.insert(extractCbor(value) as CborInput);
    }
    return result;
  }

  /**
   * Create a new set containing elements in both this set and the other set.
   *
   * @param other - Other set
   * @returns New set with intersection of elements
   *
   * @example
   * ```typescript
   * const set1 = CborSet.fromArray([1, 2, 3]);
   * const set2 = CborSet.fromArray([2, 3, 4]);
   * const intersection = set1.intersection(set2);
   * // intersection contains [2, 3]
   * ```
   */
  intersection(other: CborSet): CborSet {
    const result = new CborSet();
    for (const value of this) {
      const extracted = extractCbor(value) as CborInput;
      if (other.contains(extracted)) {
        result.insert(extracted);
      }
    }
    return result;
  }

  /**
   * Create a new set containing elements in this set but not in the other set.
   *
   * @param other - Other set
   * @returns New set with difference of elements
   *
   * @example
   * ```typescript
   * const set1 = CborSet.fromArray([1, 2, 3]);
   * const set2 = CborSet.fromArray([2, 3, 4]);
   * const diff = set1.difference(set2);
   * // diff contains [1]
   * ```
   */
  difference(other: CborSet): CborSet {
    const result = new CborSet();
    for (const value of this) {
      const extracted = extractCbor(value) as CborInput;
      if (!other.contains(extracted)) {
        result.insert(extracted);
      }
    }
    return result;
  }

  /**
   * Check if this set is a subset of another set.
   *
   * @param other - Other set
   * @returns true if all elements of this set are in the other set
   */
  isSubsetOf(other: CborSet): boolean {
    for (const value of this) {
      if (!other.contains(extractCbor(value) as CborInput)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if this set is a superset of another set.
   *
   * @param other - Other set
   * @returns true if all elements of the other set are in this set
   */
  isSupersetOf(other: CborSet): boolean {
    return other.isSubsetOf(this);
  }

  // =========================================================================
  // Iteration
  // =========================================================================

  /**
   * Iterate over elements in the set.
   *
   * Elements are returned in deterministic order (by CBOR encoding).
   *
   * @example
   * ```typescript
   * const set = CborSet.fromArray([3, 1, 2]);
   * for (const value of set) {
   *   console.log(extractCbor(value));
   * }
   * ```
   */
  *[Symbol.iterator](): Iterator<Cbor> {
    for (const [_, value] of this._map) {
      yield value;
    }
  }

  /**
   * Get all values as an array.
   *
   * @returns Array of CBOR values in deterministic order
   *
   * @example
   * ```typescript
   * const set = CborSet.fromArray([3, 1, 2]);
   * const values = set.values();
   * // Values in deterministic order
   * ```
   */
  values(): Cbor[] {
    return Array.from(this);
  }

  /**
   * Execute a function for each element.
   *
   * @param callback - Function to call for each element
   *
   * @example
   * ```typescript
   * set.forEach(value => {
   *   console.log(extractCbor(value));
   * });
   * ```
   */
  forEach(callback: (value: Cbor) => void): void {
    for (const value of this) {
      callback(value);
    }
  }

  // =========================================================================
  // CborTagged Implementation
  // =========================================================================

  cborTags(): Tag[] {
    return [createTag(TAG_SET, "set")];
  }

  untaggedCbor(): Cbor {
    // Encode as an array of values
    const values = this.values();
    return cbor(values);
  }

  taggedCbor(): Cbor {
    return createTaggedCbor(this);
  }

  fromUntaggedCbor(c: Cbor): CborSet {
    if (c.type !== MajorType.Array) {
      throw new CborError({ type: "WrongType" });
    }

    this.clear();
    for (const value of c.value) {
      this.insert(extractCbor(value) as CborInput);
    }

    return this;
  }

  fromTaggedCbor(c: Cbor): CborSet {
    const expectedTags = this.cborTags();
    validateTag(c, expectedTags);
    const content = extractTaggedContent(c);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Decode a CborSet from tagged CBOR (static method).
   *
   * @param cbor - Tagged CBOR value with tag(258)
   * @returns Decoded CborSet instance
   */
  static fromTaggedCborStatic(cbor: Cbor): CborSet {
    return new CborSet().fromTaggedCbor(cbor);
  }

  // =========================================================================
  // Conversion
  // =========================================================================

  /**
   * Convert to CBOR array (untagged).
   *
   * @returns CBOR array
   */
  toCbor(): Cbor {
    return this.untaggedCbor();
  }

  /**
   * Convert to CBOR bytes (tagged).
   *
   * @returns Encoded CBOR bytes
   */
  toBytes(): Uint8Array {
    return cborData(this.taggedCbor());
  }

  /**
   * Convert to JavaScript Set.
   *
   * @returns JavaScript Set with extracted values
   *
   * @example
   * ```typescript
   * const cborSet = CborSet.fromArray([1, 2, 3]);
   * const jsSet = cborSet.toSet();
   * console.log(jsSet.has(1)); // true
   * ```
   */
  toSet(): Set<unknown> {
    const result = new Set();
    for (const value of this) {
      result.add(extractCbor(value));
    }
    return result;
  }

  /**
   * Convert to JavaScript Array.
   *
   * @returns Array with extracted values
   */
  toArray(): unknown[] {
    return Array.from(this.toSet());
  }

  // =========================================================================
  // Display
  // =========================================================================

  /**
   * Get diagnostic notation for the set.
   *
   * @returns String representation
   *
   * @example
   * ```typescript
   * const set = CborSet.fromArray([1, 2, 3]);
   * console.log(set.diagnostic); // "[1, 2, 3]"
   * ```
   */
  get diagnostic(): string {
    const items = this.values()
      .map((v) => {
        const extracted = extractCbor(v);
        if (typeof extracted === "string") {
          return `"${extracted}"`;
        }
        return String(extracted);
      })
      .join(", ");
    return `[${items}]`;
  }

  /**
   * Convert to string (same as diagnostic).
   *
   * @returns String representation
   */
  toString(): string {
    return this.diagnostic;
  }

  /**
   * Convert to JSON (returns array of values).
   *
   * @returns Array for JSON serialization
   */
  toJSON(): unknown[] {
    return this.toArray();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a value to CBOR for use in set operations.
 *
 * @internal
 */
function encodeCborValue(value: CborInput): Cbor {
  if (typeof value === "object" && value !== null && "isCbor" in value && value.isCbor === true) {
    return value as Cbor;
  }
  return cbor(value);
}
