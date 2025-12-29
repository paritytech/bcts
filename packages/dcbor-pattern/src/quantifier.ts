/**
 * Quantifier for pattern repetition.
 *
 * This module provides the Quantifier class which combines an interval
 * (how many times to match) with a reluctance (matching strategy).
 *
 * @module quantifier
 */

import { Interval } from "./interval";
import { type Reluctance, DEFAULT_RELUCTANCE, reluctanceSuffix } from "./reluctance";

/**
 * Defines how many times a pattern may or must match, with an interval and a
 * reluctance.
 *
 * @example
 * ```typescript
 * // Zero or more, greedy
 * const star = Quantifier.zeroOrMore();
 *
 * // One or more, lazy
 * const plusLazy = Quantifier.oneOrMore(Reluctance.Lazy);
 *
 * // Exactly 3 times
 * const exact = Quantifier.exactly(3);
 *
 * // Between 2 and 5, possessive
 * const range = Quantifier.between(2, 5, Reluctance.Possessive);
 * ```
 */
export class Quantifier {
  readonly #interval: Interval;
  readonly #reluctance: Reluctance;

  /**
   * Creates a new Quantifier.
   *
   * @param interval - The interval defining how many times to match
   * @param reluctance - The matching strategy (default: Greedy)
   */
  constructor(interval: Interval, reluctance: Reluctance = DEFAULT_RELUCTANCE) {
    this.#interval = interval;
    this.#reluctance = reluctance;
  }

  /**
   * Creates a quantifier from min/max values.
   *
   * @param min - Minimum occurrences
   * @param max - Maximum occurrences (undefined for unbounded)
   * @param reluctance - The matching strategy
   */
  static from(min: number, max?: number, reluctance: Reluctance = DEFAULT_RELUCTANCE): Quantifier {
    return new Quantifier(new Interval(min, max), reluctance);
  }

  /**
   * Creates a quantifier for exactly n occurrences.
   */
  static exactly(n: number, reluctance: Reluctance = DEFAULT_RELUCTANCE): Quantifier {
    return new Quantifier(Interval.exactly(n), reluctance);
  }

  /**
   * Creates a quantifier for at least n occurrences.
   */
  static atLeast(n: number, reluctance: Reluctance = DEFAULT_RELUCTANCE): Quantifier {
    return new Quantifier(Interval.atLeast(n), reluctance);
  }

  /**
   * Creates a quantifier for at most n occurrences.
   */
  static atMost(n: number, reluctance: Reluctance = DEFAULT_RELUCTANCE): Quantifier {
    return new Quantifier(Interval.atMost(n), reluctance);
  }

  /**
   * Creates a quantifier for between min and max occurrences.
   */
  static between(
    min: number,
    max: number,
    reluctance: Reluctance = DEFAULT_RELUCTANCE,
  ): Quantifier {
    return new Quantifier(new Interval(min, max), reluctance);
  }

  /**
   * Creates a quantifier for zero or more occurrences (*).
   */
  static zeroOrMore(reluctance: Reluctance = DEFAULT_RELUCTANCE): Quantifier {
    return new Quantifier(Interval.zeroOrMore(), reluctance);
  }

  /**
   * Creates a quantifier for one or more occurrences (+).
   */
  static oneOrMore(reluctance: Reluctance = DEFAULT_RELUCTANCE): Quantifier {
    return new Quantifier(Interval.oneOrMore(), reluctance);
  }

  /**
   * Creates a quantifier for zero or one occurrence (?).
   */
  static zeroOrOne(reluctance: Reluctance = DEFAULT_RELUCTANCE): Quantifier {
    return new Quantifier(Interval.zeroOrOne(), reluctance);
  }

  /**
   * Returns the minimum number of occurrences.
   */
  min(): number {
    return this.#interval.min();
  }

  /**
   * Returns the maximum number of occurrences, or undefined if unbounded.
   */
  max(): number | undefined {
    return this.#interval.max();
  }

  /**
   * Returns the interval.
   */
  interval(): Interval {
    return this.#interval;
  }

  /**
   * Returns the reluctance (matching strategy).
   */
  reluctance(): Reluctance {
    return this.#reluctance;
  }

  /**
   * Checks if the given count is within the quantifier's range.
   */
  contains(count: number): boolean {
    return this.#interval.contains(count);
  }

  /**
   * Checks if the quantifier is unbounded (no maximum).
   */
  isUnbounded(): boolean {
    return this.#interval.isUnbounded();
  }

  /**
   * Returns a string representation of the quantifier.
   *
   * @example
   * ```typescript
   * Quantifier.zeroOrMore().toString()              // "*"
   * Quantifier.zeroOrMore(Reluctance.Lazy).toString() // "*?"
   * Quantifier.between(1, 5).toString()             // "{1,5}"
   * ```
   */
  toString(): string {
    return `${this.#interval.shorthandNotation()}${reluctanceSuffix(this.#reluctance)}`;
  }

  /**
   * Checks equality with another Quantifier.
   */
  equals(other: Quantifier): boolean {
    return this.#interval.equals(other.#interval) && this.#reluctance === other.#reluctance;
  }

  /**
   * Converts to an Interval (discarding reluctance).
   */
  toInterval(): Interval {
    return this.#interval;
  }
}

/**
 * Default quantifier is exactly 1 occurrence, greedy.
 */
export const DEFAULT_QUANTIFIER = Quantifier.exactly(1);
