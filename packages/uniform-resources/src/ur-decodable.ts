/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import type { UR } from "./ur.js";

/**
 * A type that can be decoded from a UR (Uniform Resource).
 *
 * Types implementing this interface should be able to create themselves
 * from a UR containing their data.
 *
 * @example
 * ```typescript
 * class MyType implements URDecodable {
 *   fromUR(ur: UR): MyType {
 *     const cbor = ur.cbor();
 *     // Decode from CBOR and return MyType instance
 *   }
 *
 *   fromURString(urString: string): MyType {
 *     return this.fromUR(UR.fromURString(urString));
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

  /**
   * Creates an instance of this type from a UR string.
   *
   * This is a convenience method that parses the UR string and then
   * calls fromUR().
   *
   * @param urString - The UR string to decode from (e.g., "ur:type/...")
   * @returns An instance of this type
   * @throws If the UR string is invalid or data is malformed
   */
  fromURString?(urString: string): unknown;
}

/**
 * Helper function to check if an object implements URDecodable.
 */
export function isURDecodable(obj: unknown): obj is URDecodable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "fromUR" in obj &&
    typeof (obj as Record<string, unknown>)["fromUR"] === "function"
  );
}
