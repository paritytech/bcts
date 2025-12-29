/**
 * Sequence assigner for array pattern matching.
 *
 * Handles element-to-pattern assignment logic, encapsulating the complex logic
 * for mapping array elements to sequence patterns.
 *
 * @module pattern/structure/array-pattern/assigner
 */

import type { Cbor } from "@bcts/dcbor";
import type { Pattern } from "../../index";
import { hasRepeatPatternsInSlice } from "./helpers";
import { GenericBacktracker, BooleanBacktrackState, AssignmentBacktrackState } from "./backtrack";

/**
 * Helper class for handling element-to-pattern assignment logic.
 * Encapsulates the complex logic for mapping array elements to sequence
 * patterns that was previously duplicated between matching and capture
 * collection.
 */
export class SequenceAssigner {
  readonly #patterns: Pattern[];
  readonly #arr: Cbor[];
  readonly #matchFn: (pattern: Pattern, value: Cbor) => boolean;

  constructor(
    patterns: Pattern[],
    arr: Cbor[],
    matchFn: (pattern: Pattern, value: Cbor) => boolean,
  ) {
    this.#patterns = patterns;
    this.#arr = arr;
    this.#matchFn = matchFn;
  }

  /**
   * Check if the sequence can match against the array elements (boolean result).
   */
  canMatch(): boolean {
    // Simple case: if no patterns, then empty array should match
    if (this.#patterns.length === 0) {
      return this.#arr.length === 0;
    }

    // Check if we have any repeat patterns that require backtracking
    const hasRepeatPatterns = hasRepeatPatternsInSlice(this.#patterns);

    // Simple case: if pattern count equals element count AND no repeat patterns
    if (this.#patterns.length === this.#arr.length && !hasRepeatPatterns) {
      // Try one-to-one matching
      return this.#patterns.every((pattern, i) => this.#matchFn(pattern, this.#arr[i]));
    }

    // Complex case: use generic backtracking framework
    const backtracker = new GenericBacktracker(this.#patterns, this.#arr, this.#matchFn);
    const state = new BooleanBacktrackState();
    return backtracker.backtrack(state, 0, 0);
  }

  /**
   * Find the element-to-pattern assignments (returns assignment pairs).
   */
  findAssignments(): [number, number][] | undefined {
    // Simple case: if no patterns, then empty array should match
    if (this.#patterns.length === 0) {
      return this.#arr.length === 0 ? [] : undefined;
    }

    // Check if we have any repeat patterns that require backtracking
    const hasRepeatPatterns = hasRepeatPatternsInSlice(this.#patterns);

    // Simple case: if pattern count equals element count AND no repeat patterns
    if (this.#patterns.length === this.#arr.length && !hasRepeatPatterns) {
      const assignments: [number, number][] = [];
      for (let patternIdx = 0; patternIdx < this.#patterns.length; patternIdx++) {
        const pattern = this.#patterns[patternIdx];
        const element = this.#arr[patternIdx];
        if (this.#matchFn(pattern, element)) {
          assignments.push([patternIdx, patternIdx]);
        } else {
          return undefined; // Pattern doesn't match its corresponding element
        }
      }
      return assignments;
    }

    // Complex case: use generic backtracking framework
    const backtracker = new GenericBacktracker(this.#patterns, this.#arr, this.#matchFn);
    const state = new AssignmentBacktrackState();
    if (backtracker.backtrack(state, 0, 0)) {
      return state.assignments;
    }
    return undefined;
  }
}
