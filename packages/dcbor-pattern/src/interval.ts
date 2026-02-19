/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Provides an `Interval` type representing a range of values with a
 * minimum and optional maximum.
 *
 * This module is used in the context of pattern matching for dCBOR items
 * to represent cardinality specifications like `{n}`, `{n,m}`, or `{n,}`
 * in pattern expressions.
 *
 * @module interval
 */

/**
 * Represents an inclusive interval with a minimum value and an optional
 * maximum value.
 *
 * When the maximum is `undefined`, the interval is considered unbounded above.
 *
 * @example
 * ```typescript
 * // Single value interval
 * const exact = new Interval(3, 3);  // Matches exactly 3
 *
 * // Bounded range
 * const range = new Interval(1, 5);  // Matches 1 to 5 inclusive
 *
 * // Unbounded range
 * const unbounded = new Interval(2); // Matches 2 or more
 * ```
 */
export class Interval {
  private readonly _min: number;
  private readonly _max: number | undefined;

  /**
   * Creates a new Interval.
   *
   * @param min - The minimum value (inclusive)
   * @param max - The maximum value (inclusive), or undefined for unbounded
   */
  constructor(min: number, max?: number) {
    this._min = min;
    this._max = max;
  }

  /**
   * Creates an interval from a range specification.
   *
   * @param start - The start of the range (inclusive)
   * @param end - The end of the range (inclusive), or undefined for unbounded
   * @returns A new Interval
   */
  static from(start: number, end?: number): Interval {
    return new Interval(start, end);
  }

  /**
   * Creates an interval for exactly n occurrences.
   *
   * @param n - The exact count
   * @returns A new Interval with min = max = n
   */
  static exactly(n: number): Interval {
    return new Interval(n, n);
  }

  /**
   * Creates an interval for at least n occurrences.
   *
   * @param n - The minimum count
   * @returns A new Interval with min = n and no maximum
   */
  static atLeast(n: number): Interval {
    return new Interval(n, undefined);
  }

  /**
   * Creates an interval for at most n occurrences.
   *
   * @param n - The maximum count
   * @returns A new Interval with min = 0 and max = n
   */
  static atMost(n: number): Interval {
    return new Interval(0, n);
  }

  /**
   * Creates an interval for zero or more occurrences (0..).
   *
   * @returns A new Interval representing *
   */
  static zeroOrMore(): Interval {
    return new Interval(0, undefined);
  }

  /**
   * Creates an interval for one or more occurrences (1..).
   *
   * @returns A new Interval representing +
   */
  static oneOrMore(): Interval {
    return new Interval(1, undefined);
  }

  /**
   * Creates an interval for zero or one occurrence (0..=1).
   *
   * @returns A new Interval representing ?
   */
  static zeroOrOne(): Interval {
    return new Interval(0, 1);
  }

  /**
   * Returns the minimum value of the interval.
   */
  min(): number {
    return this._min;
  }

  /**
   * Returns the maximum value of the interval, or `undefined` if unbounded.
   */
  max(): number | undefined {
    return this._max;
  }

  /**
   * Checks if the given count falls within this interval.
   *
   * @param count - The count to check
   * @returns true if count is within the interval
   */
  contains(count: number): boolean {
    return count >= this._min && (this._max === undefined || count <= this._max);
  }

  /**
   * Checks if the interval represents a single value (i.e., min equals max).
   */
  isSingle(): boolean {
    return this._max !== undefined && this._min === this._max;
  }

  /**
   * Checks if the interval is unbounded (i.e., has no maximum value).
   */
  isUnbounded(): boolean {
    return this._max === undefined;
  }

  /**
   * Returns a string representation of the interval using standard range notation.
   *
   * @returns The range notation string
   *
   * @example
   * ```typescript
   * new Interval(3, 3).rangeNotation()  // "{3}"
   * new Interval(1, 5).rangeNotation()  // "{1,5}"
   * new Interval(2).rangeNotation()     // "{2,}"
   * ```
   */
  rangeNotation(): string {
    if (this._max !== undefined && this._min === this._max) {
      return `{${this._min}}`;
    }
    if (this._max !== undefined) {
      return `{${this._min},${this._max}}`;
    }
    return `{${this._min},}`;
  }

  /**
   * Returns a string representation of the interval using shorthand notation
   * where applicable.
   *
   * @returns The shorthand notation string
   *
   * @example
   * ```typescript
   * new Interval(0, 1).shorthandNotation()  // "?"
   * new Interval(0).shorthandNotation()     // "*"
   * new Interval(1).shorthandNotation()     // "+"
   * new Interval(1, 5).shorthandNotation()  // "{1,5}"
   * ```
   */
  shorthandNotation(): string {
    // Check for optional (?)
    if (this._min === 0 && this._max === 1) {
      return "?";
    }
    // Check for single value
    if (this._max !== undefined && this._min === this._max) {
      return `{${this._min}}`;
    }
    // Check for bounded range
    if (this._max !== undefined) {
      return `{${this._min},${this._max}}`;
    }
    // Check for zero or more (*)
    if (this._min === 0) {
      return "*";
    }
    // Check for one or more (+)
    if (this._min === 1) {
      return "+";
    }
    // General unbounded case
    return `{${this._min},}`;
  }

  /**
   * Returns a string representation using range notation.
   */
  toString(): string {
    return this.rangeNotation();
  }

  /**
   * Checks equality with another Interval.
   */
  equals(other: Interval): boolean {
    return this._min === other._min && this._max === other._max;
  }
}

/**
 * Default interval is exactly 1 occurrence.
 */
export const DEFAULT_INTERVAL = Interval.exactly(1);
