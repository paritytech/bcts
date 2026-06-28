/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Set data structure for CBOR.
 *
 * A Set is encoded as a plain (untagged) CBOR array with no duplicate
 * elements, whose elements are in canonical ascending CBOR-byte order. This
 * matches the authoritative Rust `dcbor` reference, whose `Set` serializes via
 * `From<Set> for CBOR` to an untagged array — it carries NO tag (the IANA
 * tag-258 "set" tag is intentionally not used by dcbor itself).
 *
 * @module set
 */

import { type Cbor, MajorType, type CborInput } from "./cbor";
import { cbor, cborData } from "./cbor";
import { CborMap } from "./map";
import { extractCbor } from "./conveniences";
import { CborError } from "./error";

/**
 * CBOR Set type, encoded as a plain (untagged) array.
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
 * // Encode to CBOR (untagged array)
 * const c = set.toCbor();
 * ```
 */
export class CborSet {
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
   * Insert an element into the set, requiring it to be strictly greater
   * (in canonical CBOR-encoded byte order) than every previously-inserted
   * element. Used by the decoder to reject misordered or duplicate
   * elements in the (untagged) array set encoding.
   *
   * Mirrors Rust `Set::insert_next` (`pub(crate)`); exposed here because
   * TypeScript doesn't have a crate-private visibility level.
   *
   * @throws CborError of type `MisorderedMap` if `value` would not preserve
   *   strict ascending CBOR-byte order, or `DuplicateMapKey` for an exact
   *   repeat.
   */
  insertNext(value: CborInput): void {
    const cborValue = encodeCborValue(value);
    // Set is `Map<key=value, value>` in Rust. `Map::insert_next` enforces
    // strict ascending order on the encoded key bytes.
    this._map.setNext(cborValue, cborValue);
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
  // CBOR Encoding / Decoding (untagged array — Rust parity)
  // =========================================================================

  /**
   * Encode the set as an (untagged) CBOR array of its elements, in canonical
   * ascending CBOR-byte order. Matches Rust `From<Set> for CBOR`.
   *
   * @returns CBOR array
   */
  untaggedCbor(): Cbor {
    // Encode as an array of values
    const values = this.values();
    return cbor(values);
  }

  /**
   * Decode a CborSet from a CBOR (untagged) array into this instance.
   *
   * Mirrors Rust `Set::try_from_vec`, which calls `insert_next` per item: the
   * array must already be in strict ascending CBOR-byte order with no
   * duplicates, otherwise a `MisorderedMapKey`/`DuplicateMapKey` error is
   * thrown.
   *
   * @param c - CBOR array value
   * @returns this
   * @throws CborError of type `WrongType` if `c` is not an array.
   */
  fromUntaggedCbor(c: Cbor): CborSet {
    if (c.type !== MajorType.Array) {
      throw new CborError({ type: "WrongType" });
    }

    this.clear();
    for (const value of c.value) {
      this.insertNext(extractCbor(value) as CborInput);
    }

    return this;
  }

  /**
   * Decode a CborSet from a CBOR (untagged) array.
   *
   * @param c - CBOR array value
   * @returns Decoded CborSet instance
   */
  static fromCbor(c: Cbor): CborSet {
    return new CborSet().fromUntaggedCbor(c);
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
   * Convert to CBOR bytes (untagged array).
   *
   * @returns Encoded CBOR bytes
   */
  toBytes(): Uint8Array {
    return cborData(this.untaggedCbor());
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
