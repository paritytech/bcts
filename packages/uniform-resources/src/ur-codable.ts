/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import type { UREncodable } from "./ur-encodable.js";
import type { URDecodable } from "./ur-decodable.js";

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
 *   fromUR(ur: UR): MyType {
 *     // Decode from UR
 *   }
 *
 *   fromURString(urString: string): MyType {
 *     // Decode from UR string (convenience method)
 *     return this.fromUR(UR.fromURString(urString));
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
    typeof obj === "object" &&
    obj !== null &&
    "ur" in obj &&
    "urString" in obj &&
    "fromUR" in obj &&
    typeof (obj as Record<string, unknown>)["ur"] === "function" &&
    typeof (obj as Record<string, unknown>)["urString"] === "function" &&
    typeof (obj as Record<string, unknown>)["fromUR"] === "function"
  );
}
