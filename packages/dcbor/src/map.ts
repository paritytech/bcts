/**
 * Map Support in dCBOR
 *
 * A deterministic CBOR map implementation that ensures maps with the same
 * content always produce identical binary encodings, regardless of insertion
 * order.
 *
 * ## Deterministic Map Representation
 *
 * The `CborMap` type follows strict deterministic encoding rules as specified by
 * dCBOR:
 *
 * - Map keys are always sorted in lexicographic order of their encoded CBOR bytes
 * - Duplicate keys are not allowed (enforced by the implementation)
 * - Keys and values can be any type that can be converted to CBOR
 * - Numeric reduction is applied (e.g., 3.0 is stored as integer 3)
 *
 * This deterministic encoding ensures that equivalent maps always produce
 * identical byte representations, which is crucial for applications that rely
 * on consistent hashing, digital signatures, or other cryptographic operations.
 *
 * @module map
 */

import { SortedMap } from "collections/sorted-map";
import { type Cbor, type CborInput, MajorType } from "./cbor";
import { cbor, cborData, encodeCbor } from "./cbor";
import { areBytesEqual, lexicographicallyCompareBytes } from "./stdlib";
import { bytesToHex } from "./dump";
import { diagnostic } from "./diag";
import { extractCbor } from "./conveniences";
import { CborError } from "./error";

type MapKey = Uint8Array;
export interface MapEntry {
  readonly key: Cbor;
  readonly value: Cbor;
}

/**
 * A deterministic CBOR map implementation.
 *
 * Maps are always encoded with keys sorted lexicographically by their
 * encoded CBOR representation, ensuring deterministic encoding.
 */
export class CborMap {
  #dict: SortedMap<MapKey, MapEntry>;

  /**
   * Creates a new, empty CBOR Map.
   * Optionally initializes from a JavaScript Map.
   */
  constructor(map?: Map<unknown, unknown>) {
    this.#dict = new SortedMap(null, areBytesEqual, lexicographicallyCompareBytes);

    if (map !== undefined) {
      for (const [key, value] of map.entries()) {
        this.set(key as CborInput, value as CborInput);
      }
    }
  }

  /**
   * Creates a new, empty CBOR Map.
   * Matches Rust's Map::new().
   */
  static new(): CborMap {
    return new CborMap();
  }

  /**
   * Inserts a key-value pair into the map.
   * Matches Rust's Map::insert().
   */
  set<K extends CborInput, V extends CborInput>(key: K, value: V): void {
    const keyCbor = cbor(key);
    const valueCbor = cbor(value);
    const keyData = cborData(keyCbor);
    this.#dict.set(keyData, { key: keyCbor, value: valueCbor });
  }

  /**
   * Alias for set() to match Rust's insert() method.
   */
  insert<K extends CborInput, V extends CborInput>(key: K, value: V): void {
    this.set(key, value);
  }

  #makeKey<K extends CborInput>(key: K): MapKey {
    const keyCbor = cbor(key);
    return cborData(keyCbor);
  }

  /**
   * Get a value from the map, given a key.
   * Returns undefined if the key is not present in the map.
   * Matches Rust's Map::get().
   */
  get<K extends CborInput, V>(key: K): V | undefined {
    const keyData = this.#makeKey(key);
    const value = this.#dict.get(keyData);
    if (value === undefined) {
      return undefined;
    }
    // Extract CBOR value: primitives become native types, maps/arrays preserve structure
    return extractCbor(value.value) as V;
  }

  /**
   * Get a value from the map, given a key.
   * Throws an error if the key is not present.
   * Matches Rust's Map::extract().
   */
  extract<K extends CborInput, V>(key: K): V {
    const value = this.get<K, V>(key);
    if (value === undefined) {
      throw new CborError({ type: "MissingMapKey" });
    }
    return value;
  }

  /**
   * Tests if the map contains a key.
   * Matches Rust's Map::contains_key().
   */
  containsKey<K extends CborInput>(key: K): boolean {
    const keyData = this.#makeKey(key);
    return this.#dict.has(keyData);
  }

  delete<K extends CborInput>(key: K): boolean {
    const keyData = this.#makeKey(key);
    const existed = this.#dict.has(keyData);
    this.#dict.delete(keyData);
    return existed;
  }

  has<K extends CborInput>(key: K): boolean {
    const keyData = this.#makeKey(key);
    return this.#dict.has(keyData);
  }

  clear(): void {
    this.#dict = new SortedMap(null, areBytesEqual, lexicographicallyCompareBytes);
  }

  /**
   * Returns the number of entries in the map.
   * Matches Rust's Map::len().
   */
  get length(): number {
    return this.#dict.length;
  }

  /**
   * Alias for length to match JavaScript Map API.
   * Also matches Rust's Map::len().
   */
  get size(): number {
    return this.#dict.length;
  }

  /**
   * Returns the number of entries in the map.
   * Matches Rust's Map::len().
   */
  len(): number {
    return this.#dict.length;
  }

  /**
   * Checks if the map is empty.
   * Matches Rust's Map::is_empty().
   */
  isEmpty(): boolean {
    return this.#dict.length === 0;
  }

  /**
   * Get the entries of the map as an array.
   * Keys are sorted in lexicographic order of their encoded CBOR bytes.
   */
  get entriesArray(): MapEntry[] {
    return this.#dict.map((value: MapEntry, _key: MapKey) => ({
      key: value.key,
      value: value.value,
    }));
  }

  /**
   * Gets an iterator over the entries of the CBOR map, sorted by key.
   * Key sorting order is lexicographic by the key's binary-encoded CBOR.
   * Matches Rust's Map::iter().
   */
  iter(): MapEntry[] {
    return this.entriesArray;
  }

  /**
   * Returns an iterator of [key, value] tuples for JavaScript Map API compatibility.
   * This matches the standard JavaScript Map.entries() method behavior.
   */
  *entries(): IterableIterator<[Cbor, Cbor]> {
    for (const entry of this.entriesArray) {
      yield [entry.key, entry.value];
    }
  }

  /**
   * Inserts the next key-value pair into the map during decoding.
   * This is used for efficient map building during CBOR decoding.
   * Throws if the key is not in ascending order or is a duplicate.
   * Matches Rust's Map::insert_next().
   */
  setNext<K extends CborInput, V extends CborInput>(key: K, value: V): void {
    const lastEntry = this.#dict.max();
    if (lastEntry === undefined) {
      this.set(key, value);
      return;
    }
    const keyCbor = cbor(key);
    const newKey = cborData(keyCbor);
    if (this.#dict.has(newKey)) {
      throw new CborError({ type: "DuplicateMapKey" });
    }
    const lastEntryKey = this.#makeKey(lastEntry.key);
    if (lexicographicallyCompareBytes(newKey, lastEntryKey) <= 0) {
      throw new CborError({ type: "MisorderedMapKey" });
    }
    this.#dict.set(newKey, { key: keyCbor, value: cbor(value) });
  }

  get debug(): string {
    return `map({${this.entriesArray.map(CborMap.entryDebug).join(", ")}})`;
  }

  get diagnostic(): string {
    return `{${this.entriesArray.map(CborMap.entryDiagnostic).join(", ")}}`;
  }

  private static entryDebug(this: void, entry: MapEntry): string {
    // Format with full type information for debug output
    const keyDebug = CborMap.formatDebug(entry.key);
    const valueDebug = CborMap.formatDebug(entry.value);
    return `0x${bytesToHex(encodeCbor(entry.key))}: (${keyDebug}, ${valueDebug})`;
  }

  private static formatDebug(this: void, cbor: Cbor): string {
    switch (cbor.type) {
      case MajorType.Unsigned:
        return `unsigned(${cbor.value})`;
      case MajorType.Negative: {
        const negValue = typeof cbor.value === "bigint" ? -cbor.value - 1n : -cbor.value - 1;
        return `negative(${negValue})`;
      }
      case MajorType.ByteString: {
        return `bytes(${bytesToHex(cbor.value)})`;
      }
      case MajorType.Text:
        return `text("${cbor.value}")`;
      case MajorType.Array: {
        const items = cbor.value.map(CborMap.formatDebug);
        return `array([${items.join(", ")}])`;
      }
      case MajorType.Map: {
        return cbor.value.debug;
      }
      case MajorType.Tagged:
        return `tagged(${cbor.tag}, ${CborMap.formatDebug(cbor.value)})`;
      case MajorType.Simple: {
        const simple = cbor.value;
        if (typeof simple === "object" && simple !== null && "type" in simple) {
          switch (simple.type) {
            case "True":
              return "simple(true)";
            case "False":
              return "simple(false)";
            case "Null":
              return "simple(null)";
            case "Float":
              return `simple(${simple.value})`;
          }
        }
        return "simple";
      }
      default:
        return diagnostic(cbor);
    }
  }

  private static entryDiagnostic(this: void, entry: MapEntry): string {
    return `${diagnostic(entry.key)}: ${diagnostic(entry.value)}`;
  }

  *[Symbol.iterator](): Iterator<[Cbor, Cbor]> {
    for (const entry of this.entriesArray) {
      yield [entry.key, entry.value];
    }
  }

  toMap<K, V>(): Map<K, V> {
    const map = new Map<K, V>();
    for (const entry of this.entriesArray) {
      map.set(extractCbor(entry.key) as K, extractCbor(entry.value) as V);
    }
    return map;
  }
}
