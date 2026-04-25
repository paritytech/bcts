/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { CborTaggedDecodable } from "@bcts/dcbor";

import { UR } from "./ur.js";

/**
 * A type that can be decoded from a UR (Uniform Resource).
 *
 * Types implementing this interface should be able to create themselves
 * from a UR containing their data.
 *
 * Mirrors Rust's `URDecodable` trait (`bc-ur-rust/src/ur_decodable.rs`),
 * which has a blanket impl `impl<T> URDecodable for T where T:
 * CBORTaggedDecodable`. TypeScript has no equivalent of blanket impls, so
 * implementers either write `fromUR()` directly *or* — for a type that
 * already implements `CborTaggedDecodable` — call the helper functions
 * {@link decodableFromUR} / {@link decodableFromURString} below to get the
 * same auto-derivation that Rust provides for free.
 *
 * @example
 * ```typescript
 * class MyType implements URDecodable, CborTaggedDecodable<MyType> {
 *   cborTags(): Tag[] {
 *     return [createTag(40000, "mytype")];
 *   }
 *   fromUntaggedCbor(cbor: Cbor): MyType { ... }
 *   fromTaggedCbor(cbor: Cbor): MyType { ... }
 *
 *   // Auto-derived from the first cbor tag's name, matching Rust.
 *   fromUR(ur: UR): MyType { return decodableFromUR(this, ur); }
 *   fromURString(s: string): MyType { return decodableFromURString(this, s); }
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
 * Concrete equivalent of Rust's default `URDecodable::from_ur` impl
 * (`bc-ur-rust/src/ur_decodable.rs:7-15`):
 *
 *   1. Read the first tag returned by `decodable.cborTags()`.
 *   2. Verify the UR's type matches that tag's name via `UR#checkType`
 *      (this is what Rust's `ur.check_type(...)` does — surface
 *      `UnexpectedTypeError` on mismatch).
 *   3. Delegate to `decodable.fromUntaggedCbor(ur.cbor())`.
 *
 * Use from a class implementing both `URDecodable` and
 * `CborTaggedDecodable<T>` to skip the type-check / delegate boilerplate.
 */
export function decodableFromUR<T>(
  decodable: CborTaggedDecodable<T>,
  ur: UR,
): T {
  const tags = decodable.cborTags();
  const tag = tags[0];
  if (tag === undefined) {
    throw new Error("URDecodable: cborTags() returned no tags");
  }
  if (tag.name === undefined) {
    throw new Error(
      `CBOR tag ${tag.value} must have a name. Did you call register_tags()?`,
    );
  }
  ur.checkType(tag.name);
  return decodable.fromUntaggedCbor(ur.cbor());
}

/**
 * Concrete equivalent of Rust's default `URDecodable::from_ur_string` impl
 * (`bc-ur-rust/src/ur_decodable.rs:17-22`):
 * `Self::from_ur(UR::from_ur_string(s)?)`.
 */
export function decodableFromURString<T>(
  decodable: CborTaggedDecodable<T>,
  urString: string,
): T {
  return decodableFromUR(decodable, UR.fromURString(urString));
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
