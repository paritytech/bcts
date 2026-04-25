/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * CBOR-encoding-based array sorting helpers.
 *
 * Ported from `bc-dcbor-rust/src/array.rs` (`sort_array_by_cbor_encoding` +
 * `CBORSortable<T>` trait). dCBOR / CDE deterministic ordering is bytewise
 * lexicographic over the CBOR encoding of each element — this is the same
 * comparator that `Map`/`Set` use internally for key ordering.
 *
 * @module sortable
 */

import { type CborInput, cbor } from "./cbor";
import { lexicographicallyCompareBytes } from "./stdlib";

/**
 * Return a new array sorted by the bytewise lexicographic order of each
 * element's CBOR encoding.
 *
 * Mirrors Rust `pub fn sort_array_by_cbor_encoding<T>(array)`.
 *
 * @example
 * ```typescript
 * const sorted = sortArrayByCborEncoding([3, 1, 2]); // [1, 2, 3]
 * ```
 */
export function sortArrayByCborEncoding<T extends CborInput>(array: readonly T[]): T[] {
  const annotated: { encoding: Uint8Array; item: T }[] = array.map((item) => ({
    encoding: cbor(item).toData(),
    item,
  }));
  annotated.sort((a, b) => lexicographicallyCompareBytes(a.encoding, b.encoding));
  return annotated.map((entry) => entry.item);
}

/**
 * Sortable-by-CBOR-encoding trait shape.
 *
 * Mirrors Rust `pub trait CBORSortable<T> { fn sort_by_cbor_encoding(&self)
 * -> Vec<T>; }` with blanket implementations for `Vec<T>`, `&[T]`,
 * `HashSet<T>`. In TypeScript we expose a narrow interface plus
 * `arraySortable` / `setSortable` helpers that wrap any iterable into a
 * `CBORSortable` view.
 */
export interface CBORSortable<T extends CborInput> {
  sortByCborEncoding(): T[];
}

/**
 * Wrap a readonly array as a {@link CBORSortable}. Equivalent to Rust's
 * blanket `impl CBORSortable<T> for Vec<T>` / `for &[T]`.
 */
export function arraySortable<T extends CborInput>(array: readonly T[]): CBORSortable<T> {
  return {
    sortByCborEncoding: () => sortArrayByCborEncoding(array),
  };
}

/**
 * Wrap a `Set<T>` as a {@link CBORSortable}. Equivalent to Rust's
 * `impl CBORSortable<T> for HashSet<T>`.
 */
export function setSortable<T extends CborInput>(set: ReadonlySet<T>): CBORSortable<T> {
  return {
    sortByCborEncoding: () => sortArrayByCborEncoding(Array.from(set)),
  };
}
