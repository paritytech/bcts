/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { CborTaggedEncodable } from "@bcts/dcbor";

import { UR } from "./ur.js";

/**
 * A type that can be encoded to a UR (Uniform Resource).
 *
 * Types implementing this interface should be able to convert themselves
 * to CBOR data and associate that with a UR type identifier.
 *
 * Mirrors Rust's `UREncodable` trait (`bc-ur-rust/src/ur_encodable.rs`),
 * which has a blanket impl `impl<T> UREncodable for T where T:
 * CBORTaggedEncodable`. TypeScript has no equivalent of blanket impls, so
 * implementers either write `ur()` / `urString()` directly *or* — for a
 * type that already implements `CborTaggedEncodable` — call the helper
 * functions {@link urFromEncodable} / {@link urStringFromEncodable} below
 * to get the same auto-derivation that Rust provides for free.
 *
 * @example
 * ```typescript
 * class MyType implements UREncodable, CborTaggedEncodable {
 *   cborTags(): Tag[] {
 *     return [createTag(40000, "mytype")];
 *   }
 *
 *   untaggedCbor(): Cbor { ... }
 *   taggedCbor(): Cbor { return createTaggedCbor(this); }
 *
 *   // Auto-derived from the first cbor tag's name, just like Rust.
 *   ur(): UR { return urFromEncodable(this); }
 *   urString(): string { return urStringFromEncodable(this); }
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
 * Concrete equivalent of Rust's default `UREncodable::ur` impl
 * (`bc-ur-rust/src/ur_encodable.rs:8-18`):
 *
 * - Reads the first tag returned by `encodable.cborTags()`.
 * - Uses that tag's `name` as the UR type, throwing if no name is set —
 *   matching Rust's `panic!("CBOR tag {} must have a name. Did you call
 *   `register_tags()`?", tag.value())`.
 * - Wraps the encodable's `untaggedCbor()` in a fresh {@link UR} bound to
 *   that type.
 *
 * Use from a class implementing both `UREncodable` and
 * `CborTaggedEncodable` to skip writing the boilerplate yourself.
 */
export function urFromEncodable(encodable: CborTaggedEncodable): UR {
  const tags = encodable.cborTags();
  const tag = tags[0];
  if (tag === undefined) {
    throw new Error("UREncodable: cborTags() returned no tags");
  }
  if (tag.name === undefined) {
    throw new Error(`CBOR tag ${tag.value} must have a name. Did you call register_tags()?`);
  }
  return UR.new(tag.name, encodable.untaggedCbor());
}

/**
 * Concrete equivalent of Rust's default `UREncodable::ur_string` impl
 * (`bc-ur-rust/src/ur_encodable.rs:21`): `self.ur().string()`.
 */
export function urStringFromEncodable(encodable: CborTaggedEncodable): string {
  return urFromEncodable(encodable).string();
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
