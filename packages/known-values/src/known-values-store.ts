import { KnownValue } from "./known-value";

/**
 * A store that maps between Known Values and their assigned names.
 *
 * The `KnownValuesStore` provides a bidirectional mapping between:
 * - Numeric values (number) and their corresponding KnownValue instances
 * - String names and their corresponding KnownValue instances
 *
 * This enables efficient lookup in both directions, making it possible to:
 * - Find the name for a given numeric value
 * - Find the numeric value for a given name
 * - Retrieve complete KnownValue instances by either name or value
 *
 * The store is typically populated with predefined Known Values from the
 * registry, but can also be extended with custom values.
 *
 * @example
 * ```typescript
 * import { KnownValuesStore, IS_A, NOTE, SIGNED } from '@leonardocustodio/blockchain-commons/known-values';
 *
 * // Create a store with predefined Known Values
 * const store = new KnownValuesStore([IS_A, NOTE, SIGNED]);
 *
 * // Look up a Known Value by name
 * const isA = store.knownValueNamed('isA');
 * console.log(isA?.value()); // 1
 *
 * // Look up a name for a raw value
 * const name = store.name(new KnownValue(3));
 * console.log(name); // "signed"
 *
 * // Insert a custom Known Value
 * const customStore = store.clone();
 * customStore.insert(new KnownValue(100, 'customValue'));
 * console.log(customStore.knownValueNamed('customValue')?.value()); // 100
 * ```
 */
export class KnownValuesStore {
  private knownValuesByRawValue: Map<number, KnownValue>;
  private knownValuesByAssignedName: Map<string, KnownValue>;

  /**
   * Creates a new KnownValuesStore with the provided Known Values.
   *
   * This constructor takes an iterable of KnownValue instances and
   * populates the store with them, creating mappings from both raw
   * values and names to the corresponding KnownValue instances.
   *
   * @param knownValues - Iterable of KnownValue instances to populate the store
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, IS_A, NOTE, SIGNED } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * // Create a store with predefined Known Values
   * const store = new KnownValuesStore([IS_A, NOTE, SIGNED]);
   *
   * // Look up Known Values
   * console.log(store.knownValueNamed('isA')?.value()); // 1
   * console.log(store.knownValueNamed('note')?.value()); // 4
   * ```
   */
  constructor(knownValues: Iterable<KnownValue> = []) {
    this.knownValuesByRawValue = new Map();
    this.knownValuesByAssignedName = new Map();

    for (const knownValue of knownValues) {
      this._insert(knownValue);
    }
  }

  /**
   * Inserts a KnownValue into the store.
   *
   * If the KnownValue has an assigned name, it will be indexed by both its
   * raw value and its name. If a KnownValue with the same raw value or name
   * already exists in the store, it will be replaced.
   *
   * @param knownValue - The KnownValue to insert
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, KnownValue } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * const store = new KnownValuesStore();
   * store.insert(new KnownValue(100, 'customValue'));
   * console.log(store.knownValueNamed('customValue')?.value()); // 100
   * ```
   */
  insert(knownValue: KnownValue): void {
    this._insert(knownValue);
  }

  /**
   * Returns the assigned name for a KnownValue, if present in the store.
   *
   * @param knownValue - The KnownValue to look up
   * @returns The assigned name, or undefined if not found
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, IS_A } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * const store = new KnownValuesStore([IS_A]);
   * console.log(store.assignedName(IS_A)); // "isA"
   * console.log(store.assignedName(new KnownValue(999))); // undefined
   * ```
   */
  assignedName(knownValue: KnownValue): string | undefined {
    return this.knownValuesByRawValue.get(knownValue.value())?.assignedName();
  }

  /**
   * Returns a human-readable name for a KnownValue.
   *
   * If the KnownValue has an assigned name in the store, that name is
   * returned. Otherwise, the KnownValue's default name (which may be its
   * numeric value as a string) is returned.
   *
   * @param knownValue - The KnownValue to get the name for
   * @returns The name (assigned or numeric)
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, IS_A } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * const store = new KnownValuesStore([IS_A]);
   * console.log(store.name(IS_A)); // "isA"
   * console.log(store.name(new KnownValue(999))); // "999"
   * ```
   */
  name(knownValue: KnownValue): string {
    const assignedName = this.assignedName(knownValue);
    return assignedName ?? knownValue.name();
  }

  /**
   * Looks up a KnownValue by its assigned name.
   *
   * Returns the KnownValue if found, or undefined if no KnownValue
   * with the given name exists in the store.
   *
   * @param assignedName - The name to look up
   * @returns The KnownValue, or undefined if not found
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, IS_A } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * const store = new KnownValuesStore([IS_A]);
   *
   * const isA = store.knownValueNamed('isA');
   * console.log(isA?.value()); // 1
   *
   * console.log(store.knownValueNamed('nonexistent')); // undefined
   * ```
   */
  knownValueNamed(assignedName: string): KnownValue | undefined {
    return this.knownValuesByAssignedName.get(assignedName);
  }

  /**
   * Retrieves a KnownValue for a raw value, using a store if provided.
   *
   * This static method allows looking up a KnownValue by its raw numeric
   * value:
   * - If a store is provided and contains a mapping for the raw value, that
   *   KnownValue is returned
   * - Otherwise, a new KnownValue with no assigned name is created and
   *   returned
   *
   * @param rawValue - The numeric value to look up
   * @param knownValues - Optional store to search in
   * @returns The KnownValue from the store or a new unnamed KnownValue
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, IS_A } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * const store = new KnownValuesStore([IS_A]);
   *
   * // Known value from store
   * const isA = KnownValuesStore.knownValueForRawValue(1, store);
   * console.log(isA.name()); // "isA"
   *
   * // Unknown value creates a new KnownValue
   * const unknown = KnownValuesStore.knownValueForRawValue(999, store);
   * console.log(unknown.name()); // "999"
   *
   * // No store provided also creates a new KnownValue
   * const unknown2 = KnownValuesStore.knownValueForRawValue(1, undefined);
   * console.log(unknown2.name()); // "1"
   * ```
   */
  static knownValueForRawValue(rawValue: number, knownValues?: KnownValuesStore): KnownValue {
    if (knownValues !== undefined) {
      const value = knownValues.knownValuesByRawValue.get(rawValue);
      if (value !== undefined) {
        return value;
      }
    }
    return new KnownValue(rawValue);
  }

  /**
   * Attempts to find a KnownValue by its name, using a store if provided.
   *
   * This static method allows looking up a KnownValue by its name:
   * - If a store is provided and contains a mapping for the name, that
   *   KnownValue is returned
   * - Otherwise, undefined is returned
   *
   * @param name - The name to look up
   * @param knownValues - Optional store to search in
   * @returns The KnownValue if found, or undefined
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, IS_A } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * const store = new KnownValuesStore([IS_A]);
   *
   * // Known value from store
   * const isA = KnownValuesStore.knownValueForName('isA', store);
   * console.log(isA?.value()); // 1
   *
   * // Unknown name returns undefined
   * console.log(KnownValuesStore.knownValueForName('unknown', store)); // undefined
   *
   * // No store provided also returns undefined
   * console.log(KnownValuesStore.knownValueForName('isA', undefined)); // undefined
   * ```
   */
  static knownValueForName(name: string, knownValues?: KnownValuesStore): KnownValue | undefined {
    return knownValues?.knownValueNamed(name);
  }

  /**
   * Returns a human-readable name for a KnownValue, using a store if provided.
   *
   * This static method allows getting a name for a KnownValue:
   * - If a store is provided and contains a mapping for the KnownValue, its
   *   assigned name is returned
   * - Otherwise, the KnownValue's default name (which may be its numeric
   *   value as a string) is returned
   *
   * @param knownValue - The KnownValue to get the name for
   * @param knownValues - Optional store to use for lookup
   * @returns The name (assigned or numeric)
   *
   * @example
   * ```typescript
   * import { KnownValuesStore, IS_A } from '@leonardocustodio/blockchain-commons/known-values';
   *
   * const store = new KnownValuesStore([IS_A]);
   *
   * // Known value from store
   * let name = KnownValuesStore.nameForKnownValue(IS_A, store);
   * console.log(name); // "isA"
   *
   * // Unknown value in store uses KnownValue's name method
   * name = KnownValuesStore.nameForKnownValue(new KnownValue(999), store);
   * console.log(name); // "999"
   *
   * // No store provided also uses KnownValue's name method
   * name = KnownValuesStore.nameForKnownValue(IS_A, undefined);
   * console.log(name); // "isA"
   * ```
   */
  static nameForKnownValue(knownValue: KnownValue, knownValues?: KnownValuesStore): string {
    if (knownValues !== undefined) {
      const assignedName = knownValues.assignedName(knownValue);
      if (assignedName !== undefined && assignedName !== "") {
        return assignedName;
      }
    }
    return knownValue.name();
  }

  /**
   * Creates a shallow clone of this store.
   *
   * @returns A new KnownValuesStore with the same entries
   */
  clone(): KnownValuesStore {
    const cloned = new KnownValuesStore();
    cloned.knownValuesByRawValue = new Map(this.knownValuesByRawValue);
    cloned.knownValuesByAssignedName = new Map(this.knownValuesByAssignedName);
    return cloned;
  }

  /**
   * Internal helper method to insert a KnownValue into the store's maps.
   */
  private _insert(knownValue: KnownValue): void {
    this.knownValuesByRawValue.set(knownValue.value(), knownValue);
    const assignedName = knownValue.assignedName();
    if (assignedName !== undefined && assignedName !== "") {
      this.knownValuesByAssignedName.set(assignedName, knownValue);
    }
  }
}
