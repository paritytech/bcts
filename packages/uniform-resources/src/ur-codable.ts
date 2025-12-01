import { UREncodable } from './ur-encodable';
import { URDecodable } from './ur-decodable';

/**
 * A type that can be both encoded to and decoded from a UR.
 *
 * This combines the UREncodable and URDecodable interfaces for types
 * that support bidirectional UR conversion.
 *
 * @example
 * ```typescript
 * class MyType implements URCodable {
 *   ur(): UR {
 *     // Encode to UR
 *   }
 *
 *   urString(): string {
 *     // Return UR string
 *   }
 *
 *   static fromUR(ur: UR): MyType {
 *     // Decode from UR
 *   }
 * }
 * ```
 */
export interface URCodable extends UREncodable, URDecodable {}

/**
 * Helper function to check if an object implements URCodable.
 */
export function isURCodable(obj: unknown): obj is URCodable {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'ur' in obj &&
		'urString' in obj &&
		'fromUR' in obj &&
		typeof (obj as Record<string, unknown>)['ur'] === 'function' &&
		typeof (obj as Record<string, unknown>)['urString'] === 'function' &&
		typeof (obj as Record<string, unknown>)['fromUR'] === 'function'
	);
}
