import { InvalidTypeError } from './error';
import { isValidURType } from './utils';

/**
 * Represents a UR (Uniform Resource) type identifier.
 *
 * Valid UR types contain only lowercase letters, digits, and hyphens.
 *
 * @example
 * ```typescript
 * const urType = new URType('test');
 * console.log(urType.string()); // "test"
 * ```
 */
export class URType {
	private readonly _type: string;

	/**
	 * Creates a new URType from the provided type string.
	 *
	 * @param urType - The UR type as a string
	 * @throws {InvalidTypeError} If the type contains invalid characters
	 *
	 * @example
	 * ```typescript
	 * const urType = new URType('test');
	 * ```
	 */
	constructor(urType: string) {
		if (!isValidURType(urType)) {
			throw new InvalidTypeError();
		}
		this._type = urType;
	}

	/**
	 * Returns the string representation of the URType.
	 *
	 * @example
	 * ```typescript
	 * const urType = new URType('test');
	 * console.log(urType.string()); // "test"
	 * ```
	 */
	string(): string {
		return this._type;
	}

	/**
	 * Checks equality with another URType based on the type string.
	 */
	equals(other: URType): boolean {
		return this._type === other._type;
	}

	/**
	 * Returns the string representation.
	 */
	toString(): string {
		return this._type;
	}

	/**
	 * Creates a URType from a string, throwing an error if invalid.
	 *
	 * @param value - The UR type string
	 * @returns A new URType instance
	 * @throws {InvalidTypeError} If the type is invalid
	 */
	static from(value: string): URType {
		return new URType(value);
	}

	/**
	 * Safely creates a URType, returning an error if invalid.
	 *
	 * @param value - The UR type string
	 * @returns Either a URType or an error
	 */
	static tryFrom(value: string): URType | InvalidTypeError {
		try {
			return new URType(value);
		} catch (error) {
			return error as InvalidTypeError;
		}
	}
}
