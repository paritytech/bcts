/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Tree traversal system for CBOR data structures.
 *
 * This module provides a visitor pattern implementation for traversing
 * CBOR trees, allowing users to inspect and process elements at any depth.
 *
 * @module walk
 */

import {
  type Cbor,
  MajorType,
  type CborMapType,
  type CborArrayType,
  type CborTaggedType,
} from "./cbor";
import { CborError } from "./error";

/**
 * Types of edges in the CBOR tree traversal.
 */
export enum EdgeType {
  /** No specific edge type (root element) */
  None = "none",
  /** Element within an array */
  ArrayElement = "array_element",
  /** Key-value pair in a map (semantic unit) */
  MapKeyValue = "map_key_value",
  /** Key within a map */
  MapKey = "map_key",
  /** Value within a map */
  MapValue = "map_value",
  /** Content of a tagged value */
  TaggedContent = "tagged_content",
}

/**
 * Discriminated union for edge type information.
 */
export type EdgeTypeVariant =
  | { type: EdgeType.None }
  | { type: EdgeType.ArrayElement; index: number }
  | { type: EdgeType.MapKeyValue }
  | { type: EdgeType.MapKey }
  | { type: EdgeType.MapValue }
  | { type: EdgeType.TaggedContent };

/**
 * Returns a short text label for the edge type, or undefined if no label is needed.
 *
 * This is primarily used for tree formatting to identify relationships between elements.
 *
 * @param edge - The edge type variant to get a label for
 * @returns Short label string, or undefined for None edge type
 *
 * @example
 * ```typescript
 * edgeLabel({ type: EdgeType.ArrayElement, index: 0 }); // Returns "arr[0]"
 * edgeLabel({ type: EdgeType.MapKeyValue }); // Returns "kv"
 * edgeLabel({ type: EdgeType.MapKey }); // Returns "key"
 * edgeLabel({ type: EdgeType.MapValue }); // Returns "val"
 * edgeLabel({ type: EdgeType.TaggedContent }); // Returns "content"
 * edgeLabel({ type: EdgeType.None }); // Returns undefined
 * ```
 */
export const edgeLabel = (edge: EdgeTypeVariant): string | undefined => {
  switch (edge.type) {
    case EdgeType.ArrayElement:
      return `arr[${edge.index}]`;
    case EdgeType.MapKeyValue:
      return "kv";
    case EdgeType.MapKey:
      return "key";
    case EdgeType.MapValue:
      return "val";
    case EdgeType.TaggedContent:
      return "content";
    case EdgeType.None:
      return undefined;
  }
};

/**
 * Element visited during tree traversal.
 * Can be either a single CBOR value or a key-value pair from a map.
 */
export type WalkElement =
  | { type: "single"; cbor: Cbor }
  | { type: "keyvalue"; key: Cbor; value: Cbor };

/**
 * Helper functions for WalkElement
 */

/**
 * Returns the single CBOR element if this is a 'single' variant.
 *
 * @param element - The walk element to extract from
 * @returns The CBOR value if single, undefined otherwise
 *
 * @example
 * ```typescript
 * const element: WalkElement = { type: 'single', cbor: someCbor };
 * const cbor = asSingle(element); // Returns someCbor
 * ```
 */
export const asSingle = (element: WalkElement): Cbor | undefined => {
  return element.type === "single" ? element.cbor : undefined;
};

/**
 * Returns the key-value pair if this is a 'keyvalue' variant.
 *
 * @param element - The walk element to extract from
 * @returns Tuple of [key, value] if keyvalue, undefined otherwise
 *
 * @example
 * ```typescript
 * const element: WalkElement = { type: 'keyvalue', key: keyValue, value: valValue };
 * const pair = asKeyValue(element); // Returns [keyValue, valValue]
 * ```
 */
export const asKeyValue = (element: WalkElement): [Cbor, Cbor] | undefined => {
  return element.type === "keyvalue" ? [element.key, element.value] : undefined;
};

/**
 * Visitor function type.
 *
 * @template State - The type of state passed into each visit
 * @param element - The element being visited
 * @param level - The depth level in the tree (0 = root)
 * @param edge - Information about the edge leading to this element
 * @param state - The state value cloned from the parent visit
 * @returns Tuple of [newState, stopDescent] where:
 *   - newState: The state to pass into descendants of this element. Each
 *     descendant receives an independent clone of `newState`; sibling
 *     subtrees do *not* see each other's mutations.
 *   - stopDescent: If true, do not descend into children of this element.
 */
export type Visitor<State> = (
  element: WalkElement,
  level: number,
  edge: EdgeTypeVariant,
  state: State,
) => [State, boolean];

/**
 * Clone helper used to give each descendant subtree an independent copy of
 * the post-visit state — mirrors Rust `State: Clone` + `state.clone()` per
 * child in `walk.rs`. Falls back to the value as-is for primitives (which
 * don't need cloning) and uses `structuredClone` for objects.
 */
const cloneState = <S>(s: S): S => {
  if (s === null) return s;
  const t = typeof s;
  if (t !== "object" && t !== "function") return s;
  // `structuredClone` is a host-provided global available in modern Node
  // (≥ 17) and every modern browser; declare it inline so eslint's
  // `no-undef` is satisfied without a project-wide globals declaration.
  return (globalThis as { structuredClone(v: unknown): unknown }).structuredClone(s) as S;
};

/**
 * Walk a CBOR tree, visiting each element with a visitor function.
 *
 * The visitor function is called for each element in the tree, in depth-first order.
 * State semantics mirror Rust's `walk_internal`:
 *
 * - The visitor's returned `newState` propagates **down** to descendants of
 *   the just-visited node only.
 * - Sibling subtrees each receive an independent clone of the parent's
 *   post-visit state, so accumulating mutations in one subtree never leak
 *   into a sibling.
 * - State changes do not propagate **up**: the public `walk` returns `void`.
 *
 * For maps, the visitor is called with:
 * 1. A 'keyvalue' element containing both key and value
 * 2. The key individually (if descent wasn't stopped)
 * 3. The value individually (if descent wasn't stopped)
 *
 * @template State - The type of state to pass into each visit
 * @param cbor - The CBOR value to traverse
 * @param initialState - Initial state value
 * @param visitor - Function to call for each element
 */
export const walk = <State>(cbor: Cbor, initialState: State, visitor: Visitor<State>): void => {
  walkInternal(cbor, 0, { type: EdgeType.None }, initialState, visitor);
};

/**
 * Internal recursive walk implementation.
 *
 * @internal
 */
function walkInternal<State>(
  cbor: Cbor,
  level: number,
  edge: EdgeTypeVariant,
  state: State,
  visitor: Visitor<State>,
): void {
  // Visit the current element.
  const element: WalkElement = { type: "single", cbor };
  const [postVisitState, stop] = visitor(element, level, edge, state);
  if (stop) return;

  // Recursively visit children based on CBOR type. Each child receives an
  // independent clone of `postVisitState`, matching Rust `state.clone()`.
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (cbor.type) {
    case MajorType.Array:
      walkArray(cbor, level, postVisitState, visitor);
      break;
    case MajorType.Map:
      walkMap(cbor, level, postVisitState, visitor);
      break;
    case MajorType.Tagged:
      walkTagged(cbor, level, postVisitState, visitor);
      break;
    default:
      // Leaf nodes (Unsigned, Negative, Bytes, Text, Simple) have no children.
      break;
  }
}

/**
 * Walk an array's elements. Each element is visited with an independent
 * clone of `parentState`.
 *
 * @internal
 */
function walkArray<State>(
  cbor: CborArrayType,
  level: number,
  parentState: State,
  visitor: Visitor<State>,
): void {
  for (let index = 0; index < cbor.value.length; index++) {
    const item = cbor.value[index];
    if (item === undefined) {
      throw new CborError({
        type: "Custom",
        message: `Array element at index ${index} is undefined`,
      });
    }
    walkInternal(
      item,
      level + 1,
      { type: EdgeType.ArrayElement, index },
      cloneState(parentState),
      visitor,
    );
  }
}

/**
 * Walk a map's key-value pairs.
 *
 * Each kv pair receives a clone of `parentState`. If descent isn't stopped,
 * the key and value subtrees receive independent clones of the kv-visit's
 * post-visit state.
 *
 * @internal
 */
function walkMap<State>(
  cbor: CborMapType,
  level: number,
  parentState: State,
  visitor: Visitor<State>,
): void {
  for (const entry of cbor.value.entriesArray) {
    const { key, value } = entry;

    const kvElement: WalkElement = { type: "keyvalue", key, value };
    const [kvPostState, kvStop] = visitor(
      kvElement,
      level + 1,
      { type: EdgeType.MapKeyValue },
      cloneState(parentState),
    );
    if (kvStop) continue;

    walkInternal(
      key,
      level + 1,
      { type: EdgeType.MapKey },
      cloneState(kvPostState),
      visitor,
    );
    walkInternal(
      value,
      level + 1,
      { type: EdgeType.MapValue },
      cloneState(kvPostState),
      visitor,
    );
  }
}

/**
 * Walk a tagged value's content. The content visit receives a clone of
 * `parentState`.
 *
 * @internal
 */
function walkTagged<State>(
  cbor: CborTaggedType,
  level: number,
  parentState: State,
  visitor: Visitor<State>,
): void {
  walkInternal(
    cbor.value,
    level + 1,
    { type: EdgeType.TaggedContent },
    cloneState(parentState),
    visitor,
  );
}
