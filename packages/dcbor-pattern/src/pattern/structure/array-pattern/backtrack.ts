/**
 * Generic backtracking framework for array pattern matching.
 *
 * This module provides a generic backtracking algorithm that can work with
 * different types of state management (boolean matching vs assignment tracking).
 *
 * @module pattern/structure/array-pattern/backtrack
 */

import type { Cbor } from "@bcts/dcbor";
import type { Pattern } from "../../index";
import type { RepeatPattern } from "../../meta/repeat-pattern";
import { extractCaptureWithRepeat, calculateRepeatBounds, canRepeatMatch } from "./helpers";

/**
 * Generic backtracking state interface.
 * Abstracts the differences between boolean matching and assignment tracking.
 */
export interface BacktrackState<T> {
  /**
   * Try to advance the state with a new assignment and return true if successful.
   */
  tryAdvance(patternIdx: number, elementIdx: number): boolean;

  /**
   * Backtrack by removing the last state change.
   */
  backtrack(): void;

  /**
   * Check if we've reached a successful final state.
   */
  isSuccess(
    patternIdx: number,
    elementIdx: number,
    patternsLen: number,
    elementsLen: number,
  ): boolean;

  /**
   * Get the final result.
   */
  getResult(): T;
}

/**
 * Boolean backtracking state - just tracks success/failure.
 */
export class BooleanBacktrackState implements BacktrackState<boolean> {
  tryAdvance(_patternIdx: number, _elementIdx: number): boolean {
    return true; // Always allow advancement for boolean matching
  }

  backtrack(): void {
    // Nothing to backtrack for boolean state
  }

  isSuccess(
    patternIdx: number,
    elementIdx: number,
    patternsLen: number,
    elementsLen: number,
  ): boolean {
    return patternIdx >= patternsLen && elementIdx >= elementsLen;
  }

  getResult(): boolean {
    return true; // If we get here, we succeeded
  }
}

/**
 * Assignment tracking backtracking state - collects pattern-element pairs.
 */
export class AssignmentBacktrackState implements BacktrackState<[number, number][]> {
  readonly assignments: [number, number][] = [];

  tryAdvance(patternIdx: number, elementIdx: number): boolean {
    this.assignments.push([patternIdx, elementIdx]);
    return true;
  }

  backtrack(): void {
    this.assignments.pop();
  }

  isSuccess(
    patternIdx: number,
    elementIdx: number,
    patternsLen: number,
    elementsLen: number,
  ): boolean {
    return patternIdx >= patternsLen && elementIdx >= elementsLen;
  }

  getResult(): [number, number][] {
    return this.assignments;
  }

  len(): number {
    return this.assignments.length;
  }

  truncate(len: number): void {
    this.assignments.length = len;
  }
}

/**
 * Generic backtracking algorithm that works with any BacktrackState.
 */
export class GenericBacktracker {
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
   * Generic backtracking algorithm that works with any state type.
   */
  backtrack<T>(state: BacktrackState<T>, patternIdx: number, elementIdx: number): boolean {
    // Base case: if we've matched all patterns
    if (state.isSuccess(patternIdx, elementIdx, this.#patterns.length, this.#arr.length)) {
      return true;
    }

    if (patternIdx >= this.#patterns.length) {
      return false; // No more patterns but still have elements
    }

    const currentPattern = this.#patterns[patternIdx];

    // Check if this is a repeat pattern
    if (currentPattern.kind === "Meta" && currentPattern.pattern.type === "Repeat") {
      const repeatPattern = currentPattern.pattern.pattern;
      return this.tryRepeatBacktrack(repeatPattern, state, patternIdx, elementIdx);
    }

    // Check if this is a capture pattern
    if (currentPattern.kind === "Meta" && currentPattern.pattern.type === "Capture") {
      // Check if the capture pattern contains a repeat pattern
      const repeatPattern = extractCaptureWithRepeat(currentPattern);
      if (repeatPattern !== undefined) {
        // Handle this like a repeat pattern
        return this.tryRepeatBacktrack(repeatPattern, state, patternIdx, elementIdx);
      }

      // Handle as a normal single-element capture
      if (elementIdx < this.#arr.length) {
        const element = this.#arr[elementIdx];
        const matches = this.#matchFn(currentPattern, element);

        if (matches && state.tryAdvance(patternIdx, elementIdx)) {
          if (this.backtrack(state, patternIdx + 1, elementIdx + 1)) {
            return true;
          }
          // Backtracking is handled by the recursive call failing
          state.backtrack();
        }
      }
      return false;
    }

    // Non-repeat pattern: must match exactly one element
    if (elementIdx < this.#arr.length) {
      const element = this.#arr[elementIdx];
      const matches = this.#matchFn(currentPattern, element);

      if (matches && state.tryAdvance(patternIdx, elementIdx)) {
        if (this.backtrack(state, patternIdx + 1, elementIdx + 1)) {
          return true;
        }
        // Backtracking is handled by the recursive call failing
        state.backtrack();
      }
    }
    return false;
  }

  /**
   * Helper for repeat pattern backtracking with generic state.
   */
  private tryRepeatBacktrack<T>(
    repeatPattern: RepeatPattern,
    state: BacktrackState<T>,
    patternIdx: number,
    elementIdx: number,
  ): boolean {
    const quantifier = repeatPattern.quantifier;
    const [minCount, maxCount] = calculateRepeatBounds(quantifier, elementIdx, this.#arr.length);

    // Try different numbers of repetitions (greedy: start with max)
    for (let repCount = maxCount; repCount >= minCount; repCount--) {
      if (
        elementIdx + repCount <= this.#arr.length &&
        canRepeatMatch(repeatPattern, this.#arr, elementIdx, repCount, this.#matchFn)
      ) {
        // Record state for all consumed elements
        let advancedCount = 0;
        let canAdvance = true;
        for (let i = 0; i < repCount; i++) {
          if (!state.tryAdvance(patternIdx, elementIdx + i)) {
            // If we can't advance, backtrack what we've added
            // and try next repCount
            for (let j = 0; j < advancedCount; j++) {
              state.backtrack();
            }
            canAdvance = false;
            break;
          }
          advancedCount++;
        }

        if (!canAdvance) {
          continue;
        }

        // Try to match the rest of the sequence recursively
        if (this.backtrack(state, patternIdx + 1, elementIdx + repCount)) {
          return true;
        }

        // Backtrack: undo all the advances we made for this repCount
        for (let i = 0; i < repCount; i++) {
          state.backtrack();
        }
      }
    }
    return false;
  }
}
