/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { InvalidTypeError } from "./error";
import { isValidURType } from "./utils";

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
   * Safely creates a URType, returning a typed `Result`-shaped
   * discriminated union instead of throwing.
   *
   * Mirrors Rust `impl TryFrom<&str> for URType` /
   * `impl TryFrom<String> for URType` (`bc-ur-rust/src/ur_type.rs`),
   * which return `Result<URType, Error>`. The TS shape is the
   * idiomatic discriminated form so callers can branch on `ok`
   * without `instanceof`:
   *
   * @example
   * ```typescript
   * const r = URType.tryFrom("test");
   * if (r.ok) {
   *   console.log(r.value.string()); // "test"
   * } else {
   *   console.error(r.error.message);
   * }
   * ```
   *
   * @param value - The UR type string
   * @returns A typed Result: `{ ok: true; value: URType }` on success,
   *   `{ ok: false; error: InvalidTypeError }` on failure.
   */
  static tryFrom(
    value: string,
  ): { ok: true; value: URType } | { ok: false; error: InvalidTypeError } {
    try {
      return { ok: true, value: new URType(value) };
    } catch (error) {
      return { ok: false, error: error as InvalidTypeError };
    }
  }
}
