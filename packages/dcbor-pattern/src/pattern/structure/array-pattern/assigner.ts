/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
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
  private readonly _patterns: Pattern[];
  private readonly _arr: Cbor[];
  private readonly _matchFn: (pattern: Pattern, value: Cbor) => boolean;

  constructor(
    patterns: Pattern[],
    arr: Cbor[],
    matchFn: (pattern: Pattern, value: Cbor) => boolean,
  ) {
    this._patterns = patterns;
    this._arr = arr;
    this._matchFn = matchFn;
  }

  /**
   * Check if the sequence can match against the array elements (boolean result).
   */
  canMatch(): boolean {
    // Simple case: if no patterns, then empty array should match
    if (this._patterns.length === 0) {
      return this._arr.length === 0;
    }

    // Check if we have any repeat patterns that require backtracking
    const hasRepeatPatterns = hasRepeatPatternsInSlice(this._patterns);

    // Simple case: if pattern count equals element count AND no repeat patterns
    if (this._patterns.length === this._arr.length && !hasRepeatPatterns) {
      // Try one-to-one matching
      return this._patterns.every((pattern, i) => this._matchFn(pattern, this._arr[i]));
    }

    // Complex case: use generic backtracking framework
    const backtracker = new GenericBacktracker(this._patterns, this._arr, this._matchFn);
    const state = new BooleanBacktrackState();
    return backtracker.backtrack(state, 0, 0);
  }

  /**
   * Find the element-to-pattern assignments (returns assignment pairs).
   */
  findAssignments(): [number, number][] | undefined {
    // Simple case: if no patterns, then empty array should match
    if (this._patterns.length === 0) {
      return this._arr.length === 0 ? [] : undefined;
    }

    // Check if we have any repeat patterns that require backtracking
    const hasRepeatPatterns = hasRepeatPatternsInSlice(this._patterns);

    // Simple case: if pattern count equals element count AND no repeat patterns
    if (this._patterns.length === this._arr.length && !hasRepeatPatterns) {
      const assignments: [number, number][] = [];
      for (let patternIdx = 0; patternIdx < this._patterns.length; patternIdx++) {
        const pattern = this._patterns[patternIdx];
        const element = this._arr[patternIdx];
        if (this._matchFn(pattern, element)) {
          assignments.push([patternIdx, patternIdx]);
        } else {
          return undefined; // Pattern doesn't match its corresponding element
        }
      }
      return assignments;
    }

    // Complex case: use generic backtracking framework
    const backtracker = new GenericBacktracker(this._patterns, this._arr, this._matchFn);
    const state = new AssignmentBacktrackState();
    if (backtracker.backtrack(state, 0, 0)) {
      return state.assignments;
    }
    return undefined;
  }
}
