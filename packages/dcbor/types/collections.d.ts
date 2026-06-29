declare module "collections/sorted-map" {
  /**
   * Backing sorted set of a SortedMap. Its elements are `{ key, value }`
   * items ordered by `key` via the SortedMap's compare function.
   */
  export interface SortedMapStore<K, V> {
    /** Greatest item by key, or undefined if empty. */
    max(): { key: K; value: V } | undefined;
    /** Least item by key, or undefined if empty. */
    min(): { key: K; value: V } | undefined;
  }

  export class SortedMap<K = any, V = any> {
    constructor(
      entries?: ReadonlyArray<[K, V]> | null,
      equals?: (a: K, b: K) => boolean,
      compare?: (a: K, b: K) => number,
    );

    set(key: K, value: V): this;
    get(key: K): V | undefined;
    delete(key: K): boolean;
    has(key: K): boolean;
    forEach(callbackfn: (value: V, index: K, map: SortedMap<K, V>) => void, thisArg?: any): void;
    map<T>(callbackfn: (value: V, index: K, map: SortedMap<K, V>) => T, thisArg?: any): T[];
    length: number;
    max(): V | undefined;
    /** Underlying sorted set of `{ key, value }` items, ordered by key. */
    readonly store: SortedMapStore<K, V>;
  }
}
