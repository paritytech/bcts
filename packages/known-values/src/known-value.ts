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
 * import { KnownValue } from '@blockchain-commons/known-values';
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
 * // Use a pre-defined Known Value from the registry
 * import { IS_A } from '@blockchain-commons/known-values';
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
export class KnownValue {
	private readonly _value: number;
	private readonly _assignedName: string | undefined;

	/**
	 * Creates a new KnownValue with the given numeric value and optional name.
	 *
	 * @param value - The numeric value (0-18446744073709551615 for BigInt compatibility)
	 * @param assignedName - Optional human-readable name for the value
	 *
	 * @example
	 * ```typescript
	 * const knownValue = new KnownValue(42);
	 * console.log(knownValue.value()); // 42
	 *
	 * const namedValue = new KnownValue(1, 'isA');
	 * console.log(namedValue.name()); // "isA"
	 * ```
	 */
	constructor(value: number, assignedName?: string) {
		this._value = value;
		this._assignedName = assignedName;
	}

	/**
	 * Returns the numeric value of the KnownValue.
	 *
	 * This is the raw unsigned integer that identifies the concept.
	 *
	 * @example
	 * ```typescript
	 * import { IS_A, NOTE } from '@blockchain-commons/known-values';
	 * console.log(IS_A.value()); // 1
	 * console.log(NOTE.value()); // 4
	 * ```
	 */
	value(): number {
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

	/**
	 * Equality for KnownValue is based solely on the numeric value, ignoring the name.
	 */
	equals(other: KnownValue): boolean {
		return this._value === other._value;
	}

	/**
	 * Hash code based on the numeric value.
	 */
	hashCode(): number {
		return this._value;
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
}
