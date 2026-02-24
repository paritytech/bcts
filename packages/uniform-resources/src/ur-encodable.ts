/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { UR } from "./ur.js";

/**
 * A type that can be encoded to a UR (Uniform Resource).
 *
 * Types implementing this interface should be able to convert themselves
 * to CBOR data and associate that with a UR type identifier.
 *
 * @example
 * ```typescript
 * class MyType implements UREncodable {
 *   toCBOR(): CBOR {
 *     // Convert to CBOR
 *   }
 *
 *   ur(): UR {
 *     const cbor = this.toCBOR();
 *     return UR.new('mytype', cbor);
 *   }
 * }
 * ```
 */
export interface UREncodable {
  /**
   * Returns the UR representation of the object.
   */
  ur(): UR;

  /**
   * Returns the UR string representation of the object.
   */
  urString(): string;
}

/**
 * Helper function to check if an object implements UREncodable.
 */
export function isUREncodable(obj: unknown): obj is UREncodable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "ur" in obj &&
    "urString" in obj &&
    typeof (obj as Record<string, unknown>)["ur"] === "function" &&
    typeof (obj as Record<string, unknown>)["urString"] === "function"
  );
}
