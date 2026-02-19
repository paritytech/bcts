/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Reluctance for quantifiers.
 *
 * This module defines the matching behavior for quantified patterns,
 * controlling how greedily the pattern matcher consumes input.
 *
 * @module reluctance
 */

/**
 * Reluctance for quantifiers.
 *
 * Controls how a quantified pattern matches:
 * - `Greedy`: Match as many as possible, backtrack if needed
 * - `Lazy`: Match as few as possible, add more if needed
 * - `Possessive`: Match as many as possible, never backtrack
 */
export enum Reluctance {
  /**
   * Grabs as many repetitions as possible, then backtracks if the rest of
   * the pattern cannot match.
   */
  Greedy = "greedy",

  /**
   * Starts with as few repetitions as possible, adding more only if the rest
   * of the pattern cannot match.
   */
  Lazy = "lazy",

  /**
   * Grabs as many repetitions as possible and never backtracks; if the rest
   * of the pattern cannot match, the whole match fails.
   */
  Possessive = "possessive",
}

/**
 * Default reluctance is Greedy.
 */
export const DEFAULT_RELUCTANCE = Reluctance.Greedy;

/**
 * Returns the suffix character for a reluctance type.
 *
 * @param reluctance - The reluctance type
 * @returns The suffix string ("" for Greedy, "?" for Lazy, "+" for Possessive)
 *
 * @example
 * ```typescript
 * reluctanceSuffix(Reluctance.Greedy)     // ""
 * reluctanceSuffix(Reluctance.Lazy)       // "?"
 * reluctanceSuffix(Reluctance.Possessive) // "+"
 * ```
 */
export const reluctanceSuffix = (reluctance: Reluctance): string => {
  switch (reluctance) {
    case Reluctance.Greedy:
      return "";
    case Reluctance.Lazy:
      return "?";
    case Reluctance.Possessive:
      return "+";
  }
};
