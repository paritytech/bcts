import { UR } from './ur';

/**
 * A type that can be decoded from a UR (Uniform Resource).
 *
 * Types implementing this interface should be able to create themselves
 * from a UR containing their data.
 *
 * @example
 * ```typescript
 * class MyType implements URDecodable {
 *   static fromUR(ur: UR): MyType {
 *     const cbor = ur.cbor();
 *     // Decode from CBOR and return MyType instance
 *   }
 * }
 * ```
 */
export interface URDecodable {
	/**
	 * Creates an instance of this type from a UR.
	 *
	 * @param ur - The UR to decode from
	 * @returns An instance of this type
	 * @throws If the UR type is wrong or data is malformed
	 */
	fromUR(ur: UR): unknown;
}

/**
 * Helper function to check if an object implements URDecodable.
 */
export function isURDecodable(obj: unknown): obj is URDecodable {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'fromUR' in obj &&
		typeof (obj as Record<string, unknown>)['fromUR'] === 'function'
	);
}
