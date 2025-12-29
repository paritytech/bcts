/**
 * Late-binding registry for pattern matching functions.
 * This avoids circular dependencies between pattern modules.
 *
 * @module pattern/match-registry
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../format";

// Forward declare Pattern type to avoid circular import
// The actual Pattern type is defined in ./index.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pattern = any;

/**
 * Match result with paths and captures.
 */
export interface MatchResultInternal {
  readonly paths: Path[];
  readonly captures: Map<string, Path[]>;
}

/**
 * Registry for the pattern matching function.
 * This gets set by pattern/index.ts after all modules are loaded.
 */
export let matchFn: ((pattern: Pattern, haystack: Cbor) => boolean) | undefined;

/**
 * Registry for the pattern paths function.
 * This gets set by pattern/index.ts after all modules are loaded.
 */
export let pathsFn: ((pattern: Pattern, haystack: Cbor) => Path[]) | undefined;

/**
 * Registry for the pattern paths with captures function (VM-based).
 * This gets set by pattern/index.ts after all modules are loaded.
 */
export let pathsWithCapturesFn:
  | ((pattern: Pattern, haystack: Cbor) => MatchResultInternal)
  | undefined;

/**
 * Registry for the direct pattern paths with captures function (non-VM).
 * This is used by the VM to avoid infinite recursion.
 */
export let pathsWithCapturesDirectFn:
  | ((pattern: Pattern, haystack: Cbor) => MatchResultInternal)
  | undefined;

/**
 * Sets the pattern matching function.
 * Called by pattern/index.ts during module initialization.
 */
export const setMatchFn = (fn: (pattern: Pattern, haystack: Cbor) => boolean): void => {
  matchFn = fn;
};

/**
 * Sets the pattern paths function.
 * Called by pattern/index.ts during module initialization.
 */
export const setPathsFn = (fn: (pattern: Pattern, haystack: Cbor) => Path[]): void => {
  pathsFn = fn;
};

/**
 * Sets the pattern paths with captures function.
 * Called by pattern/index.ts during module initialization.
 */
export const setPathsWithCapturesFn = (
  fn: (pattern: Pattern, haystack: Cbor) => MatchResultInternal,
): void => {
  pathsWithCapturesFn = fn;
};

/**
 * Sets the direct pattern paths with captures function (non-VM).
 * Called by pattern/index.ts during module initialization.
 */
export const setPathsWithCapturesDirectFn = (
  fn: (pattern: Pattern, haystack: Cbor) => MatchResultInternal,
): void => {
  pathsWithCapturesDirectFn = fn;
};

/**
 * Matches a pattern against a CBOR value using the registered function.
 * @throws Error if the match function hasn't been registered yet.
 */
export const matchPattern = (pattern: Pattern, haystack: Cbor): boolean => {
  if (matchFn === undefined) {
    throw new Error("Pattern match function not initialized");
  }
  return matchFn(pattern, haystack);
};

/**
 * Gets paths for a pattern against a CBOR value using the registered function.
 * @throws Error if the paths function hasn't been registered yet.
 */
export const getPatternPaths = (pattern: Pattern, haystack: Cbor): Path[] => {
  if (pathsFn === undefined) {
    throw new Error("Pattern paths function not initialized");
  }
  return pathsFn(pattern, haystack);
};

/**
 * Gets paths with captures for a pattern against a CBOR value (VM-based).
 * @throws Error if the function hasn't been registered yet.
 */
export const getPatternPathsWithCaptures = (
  pattern: Pattern,
  haystack: Cbor,
): MatchResultInternal => {
  if (pathsWithCapturesFn === undefined) {
    throw new Error("Pattern paths with captures function not initialized");
  }
  return pathsWithCapturesFn(pattern, haystack);
};

/**
 * Gets paths with captures directly without the VM (non-recursive).
 * This is used by the VM to avoid infinite recursion.
 * @throws Error if the function hasn't been registered yet.
 */
export const getPatternPathsWithCapturesDirect = (
  pattern: Pattern,
  haystack: Cbor,
): MatchResultInternal => {
  if (pathsWithCapturesDirectFn === undefined) {
    throw new Error("Direct pattern paths with captures function not initialized");
  }
  return pathsWithCapturesDirectFn(pattern, haystack);
};
