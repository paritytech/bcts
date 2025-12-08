/**
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
 * Visitor function type with state threading.
 *
 * @template State - The type of state passed through the traversal
 * @param element - The element being visited
 * @param level - The depth level in the tree (0 = root)
 * @param edge - Information about the edge leading to this element
 * @param state - Current state value
 * @returns Tuple of [newState, stopDescent] where:
 *   - newState: The updated state to pass to subsequent visits
 *   - stopDescent: If true, don't descend into children of this element
 */
export type Visitor<State> = (
  element: WalkElement,
  level: number,
  edge: EdgeTypeVariant,
  state: State,
) => [State, boolean];

/**
 * Walk a CBOR tree, visiting each element with a visitor function.
 *
 * The visitor function is called for each element in the tree, in depth-first order.
 * State is threaded through the traversal, allowing accumulation of results.
 *
 * For maps, the visitor is called with:
 * 1. A 'keyvalue' element containing both key and value
 * 2. The key individually (if descent wasn't stopped)
 * 3. The value individually (if descent wasn't stopped)
 *
 * @template State - The type of state to thread through the traversal
 * @param cbor - The CBOR value to traverse
 * @param initialState - Initial state value
 * @param visitor - Function to call for each element
 * @returns Final state after traversal
 *
 * @example
 * ```typescript
 * // Count all text strings in a structure
 * interface CountState { count: number }
 *
 * const structure = cbor({ name: 'Alice', tags: ['urgent', 'draft'] });
 * const result = walk(structure, { count: 0 }, (element, level, edge, state) => {
 *   if (element.type === 'single' && element.cbor.type === MajorType.Text) {
 *     return [{ count: state.count + 1 }, false];
 *   }
 *   return [state, false];
 * });
 * console.log(result.count); // 3 (name, urgent, draft)
 * ```
 *
 * @example
 * ```typescript
 * // Find first occurrence and stop
 * const structure = cbor([1, 2, 3, 'found', 5, 6]);
 * let found = false;
 *
 * walk(structure, null, (element, level, edge) => {
 *   if (element.type === 'single' &&
 *       element.cbor.type === MajorType.Text &&
 *       element.cbor.value === 'found') {
 *     found = true;
 *     return [null, true]; // Stop descending
 *   }
 *   return [null, false];
 * });
 * ```
 */
export const walk = <State>(cbor: Cbor, initialState: State, visitor: Visitor<State>): State => {
  return walkInternal(cbor, 0, { type: EdgeType.None }, initialState, visitor);
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
  skipVisit = false,
): State {
  let currentState = state;
  let stopDescent = false;

  // Visit the current element (unless skipVisit is true)
  if (!skipVisit) {
    const element: WalkElement = { type: "single", cbor };
    const [newState, stop] = visitor(element, level, edge, currentState);
    currentState = newState;
    stopDescent = stop;

    // If visitor says to stop descending, return immediately
    if (stopDescent) {
      return currentState;
    }
  }

  // Recursively visit children based on CBOR type
  // Only container types (Array, Map, Tagged) need special handling; leaf nodes use default
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (cbor.type) {
    case MajorType.Array:
      currentState = walkArray(cbor, level, currentState, visitor);
      break;

    case MajorType.Map:
      currentState = walkMap(cbor, level, currentState, visitor);
      break;

    case MajorType.Tagged:
      currentState = walkTagged(cbor, level, currentState, visitor);
      break;

    // Leaf nodes: Unsigned, Negative, Bytes, Text, Simple
    default:
      // No children to visit
      break;
  }

  return currentState;
}

/**
 * Walk an array's elements.
 *
 * @internal
 */
function walkArray<State>(
  cbor: CborArrayType,
  level: number,
  state: State,
  visitor: Visitor<State>,
): State {
  let currentState = state;

  for (let index = 0; index < cbor.value.length; index++) {
    const item = cbor.value[index];
    if (item === undefined) {
      throw new CborError({
        type: "Custom",
        message: `Array element at index ${index} is undefined`,
      });
    }
    currentState = walkInternal(
      item,
      level + 1,
      { type: EdgeType.ArrayElement, index },
      currentState,
      visitor,
    );
  }

  return currentState;
}

/**
 * Walk a map's key-value pairs.
 *
 * For each entry:
 * 1. Visit the key-value pair as a semantic unit
 * 2. If not stopped, visit the key individually
 * 3. If not stopped, visit the value individually
 *
 * @internal
 */
function walkMap<State>(
  cbor: CborMapType,
  level: number,
  state: State,
  visitor: Visitor<State>,
): State {
  let currentState = state;

  for (const entry of cbor.value.entriesArray) {
    const { key, value } = entry;

    // First, visit the key-value pair as a semantic unit
    const kvElement: WalkElement = { type: "keyvalue", key, value };
    const [kvState, kvStop] = visitor(
      kvElement,
      level + 1,
      { type: EdgeType.MapKeyValue },
      currentState,
    );
    currentState = kvState;

    // If not stopped, visit key and value individually
    if (!kvStop) {
      currentState = walkInternal(key, level + 1, { type: EdgeType.MapKey }, currentState, visitor);

      currentState = walkInternal(
        value,
        level + 1,
        { type: EdgeType.MapValue },
        currentState,
        visitor,
      );
    }
  }

  return currentState;
}

/**
 * Walk a tagged value's content.
 *
 * @internal
 */
function walkTagged<State>(
  cbor: CborTaggedType,
  level: number,
  state: State,
  visitor: Visitor<State>,
): State {
  return walkInternal(cbor.value, level + 1, { type: EdgeType.TaggedContent }, state, visitor);
}

/**
 * Helper: Count all elements in a CBOR tree.
 *
 * @param cbor - The CBOR value to count
 * @returns Total number of elements visited
 *
 * @example
 * ```typescript
 * const structure = cbor([1, 2, [3, 4]]);
 * const count = countElements(structure);
 * console.log(count); // 6 (array, 1, 2, inner array, 3, 4)
 * ```
 */
export const countElements = (cbor: Cbor): number => {
  interface CountState {
    count: number;
  }

  const result = walk<CountState>(cbor, { count: 0 }, (_element, _level, _edge, state) => {
    return [{ count: state.count + 1 }, false];
  });

  return result.count;
};

/**
 * Helper: Collect all elements at a specific depth level.
 *
 * @param cbor - The CBOR value to traverse
 * @param targetLevel - The depth level to collect (0 = root)
 * @returns Array of CBOR values at the target level
 *
 * @example
 * ```typescript
 * const structure = cbor([[1, 2], [3, 4]]);
 * const level1 = collectAtLevel(structure, 1);
 * // Returns: [[1, 2], [3, 4]]
 * const level2 = collectAtLevel(structure, 2);
 * // Returns: [1, 2, 3, 4]
 * ```
 */
export const collectAtLevel = (cbor: Cbor, targetLevel: number): Cbor[] => {
  interface CollectState {
    items: Cbor[];
  }

  const result = walk<CollectState>(cbor, { items: [] }, (element, level, _edge, state) => {
    if (level === targetLevel && element.type === "single") {
      return [{ items: [...state.items, element.cbor] }, false];
    }
    return [state, false];
  });

  return result.items;
};

/**
 * Helper: Find first element matching a predicate.
 *
 * @template T - Type of extracted value
 * @param cbor - The CBOR value to search
 * @param predicate - Function to test each element
 * @returns First matching element, or undefined if not found
 *
 * @example
 * ```typescript
 * const structure = cbor({ users: [
 *   { name: 'Alice', age: 30 },
 *   { name: 'Bob', age: 25 }
 * ]});
 *
 * const bob = findFirst(structure, (element) => {
 *   if (element.type === 'single' &&
 *       element.cbor.type === MajorType.Text &&
 *       element.cbor.value === 'Bob') {
 *     return true;
 *   }
 *   return false;
 * });
 * ```
 */
export const findFirst = (
  cbor: Cbor,
  predicate: (element: WalkElement) => boolean,
): Cbor | undefined => {
  interface FindState {
    found?: Cbor;
  }

  const result = walk<FindState>(cbor, {}, (element, _level, _edge, state) => {
    if (state.found !== undefined) {
      // Already found, stop descending
      return [state, true];
    }

    if (predicate(element)) {
      if (element.type === "single") {
        return [{ found: element.cbor }, true]; // Stop after finding
      }
      // Matched but not a single element, stop anyway
      return [state, true];
    }

    return [state, false];
  });

  return result.found;
};

/**
 * Helper: Collect all text strings in a CBOR tree.
 *
 * @param cbor - The CBOR value to traverse
 * @returns Array of all text string values found
 *
 * @example
 * ```typescript
 * const doc = cbor({
 *   title: 'Document',
 *   tags: ['urgent', 'draft'],
 *   author: { name: 'Alice' }
 * });
 *
 * const texts = collectAllText(doc);
 * // Returns: ['Document', 'urgent', 'draft', 'Alice']
 * ```
 */
export const collectAllText = (cbor: Cbor): string[] => {
  interface TextState {
    texts: string[];
  }

  const result = walk<TextState>(cbor, { texts: [] }, (element, _level, _edge, state) => {
    if (element.type === "single" && element.cbor.type === MajorType.Text) {
      return [{ texts: [...state.texts, element.cbor.value] }, false];
    }
    return [state, false];
  });

  return result.texts;
};

/**
 * Helper: Get the maximum depth of a CBOR tree.
 *
 * @param cbor - The CBOR value to measure
 * @returns Maximum depth (0 for leaf values, 1+ for containers)
 *
 * @example
 * ```typescript
 * const flat = cbor([1, 2, 3]);
 * console.log(maxDepth(flat)); // 1
 *
 * const nested = cbor([[[1]]]);
 * console.log(maxDepth(nested)); // 3
 * ```
 */
export const maxDepth = (cbor: Cbor): number => {
  interface DepthState {
    maxDepth: number;
  }

  const result = walk<DepthState>(cbor, { maxDepth: 0 }, (_element, level, _edge, state) => {
    const newMaxDepth = Math.max(state.maxDepth, level);
    return [{ maxDepth: newMaxDepth }, false];
  });

  return result.maxDepth;
};
