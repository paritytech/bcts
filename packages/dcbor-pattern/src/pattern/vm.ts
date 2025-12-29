/**
 * Tiny Thompson-style VM for walking dCBOR trees.
 *
 * The VM runs byte-code produced by Pattern compile methods.
 *
 * @module pattern/vm
 */

import type { Cbor } from "@bcts/dcbor";
import {
  isArray,
  isMap,
  isTagged,
  arrayLength,
  arrayItem,
  mapKeys,
  mapValue,
  tagContent,
} from "@bcts/dcbor";
import type { Path } from "../format";
import type { Pattern } from "./index";
import type { Quantifier } from "../quantifier";
import { Reluctance } from "../reluctance";
import { getPatternPaths, getPatternPathsWithCapturesDirect } from "./match-registry";
import {
  searchPatternPathsWithCaptures,
  searchPattern as createSearchPattern,
} from "./meta/search-pattern";

/**
 * Navigation axis for traversing dCBOR tree structures.
 */
export type Axis = "ArrayElement" | "MapKey" | "MapValue" | "TaggedContent";

/**
 * Return child CBOR values reachable from `cbor` via the given axis.
 */
export const axisChildren = (axis: Axis, cbor: Cbor): Cbor[] => {
  switch (axis) {
    case "ArrayElement": {
      if (!isArray(cbor)) return [];
      const len = arrayLength(cbor);
      if (len === undefined) return [];
      const children: Cbor[] = [];
      for (let i = 0; i < len; i++) {
        const item = arrayItem(cbor, i);
        if (item !== undefined) {
          children.push(item);
        }
      }
      return children;
    }
    case "MapKey": {
      if (!isMap(cbor)) return [];
      const keys = mapKeys(cbor);
      if (keys === undefined || keys === null) return [];
      return keys;
    }
    case "MapValue": {
      if (!isMap(cbor)) return [];
      const keys = mapKeys(cbor);
      if (keys === undefined || keys === null) return [];
      const values: Cbor[] = [];
      for (const key of keys) {
        const value = mapValue(cbor, key);
        if (value !== undefined && value !== null) {
          values.push(value as Cbor);
        }
      }
      return values;
    }
    case "TaggedContent": {
      if (!isTagged(cbor)) return [];
      const content = tagContent(cbor);
      if (content === undefined) return [];
      return [content];
    }
  }
};

/**
 * Bytecode instructions for the pattern VM.
 */
export type Instr =
  | { type: "MatchPredicate"; literalIndex: number }
  | { type: "MatchStructure"; literalIndex: number }
  | { type: "Split"; a: number; b: number }
  | { type: "Jump"; address: number }
  | { type: "PushAxis"; axis: Axis }
  | { type: "Pop" }
  | { type: "Save" }
  | { type: "Accept" }
  | {
      type: "Search";
      patternIndex: number;
      captureMap: [string, number][];
    }
  | { type: "ExtendSequence" }
  | { type: "CombineSequence" }
  | { type: "NotMatch"; patternIndex: number }
  | { type: "Repeat"; patternIndex: number; quantifier: Quantifier }
  | { type: "CaptureStart"; captureIndex: number }
  | { type: "CaptureEnd"; captureIndex: number };

/**
 * A compiled pattern program.
 */
export interface Program {
  code: Instr[];
  literals: Pattern[];
  captureNames: string[];
}

/**
 * Internal back-tracking state.
 */
interface Thread {
  pc: number;
  cbor: Cbor;
  path: Path;
  savedPaths: Path[];
  captures: Path[][];
  captureStack: number[][];
}

/**
 * Compares two CBOR values for equality by their serialized form.
 */
const cborEquals = (a: Cbor, b: Cbor): boolean => {
  // Simple reference equality check first
  if (a === b) return true;

  // Compare by JSON representation (simplified)
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/**
 * Hash a path for deduplication.
 * Uses CBOR diagnostic notation for proper serialization.
 */
const pathHash = (path: Path): string => {
  // Use toDiagnostic for proper CBOR serialization
  return path
    .map((item) => (typeof item.toDiagnostic === "function" ? item.toDiagnostic() : String(item)))
    .join("|");
};

/**
 * Match atomic patterns without recursion into the VM.
 *
 * This function handles only the patterns that are safe to use in
 * MatchPredicate instructions.
 */
export const atomicPaths = (pattern: Pattern, cbor: Cbor): Path[] => {
  switch (pattern.kind) {
    case "Value":
    case "Structure":
      return getPatternPaths(pattern, cbor);
    case "Meta":
      if (pattern.pattern.type === "Any") {
        return [[cbor]];
      }
      throw new Error(`Non-atomic meta pattern used in MatchPredicate: ${pattern.pattern.type}`);
  }
};

/**
 * Compute repeat paths based on pattern, quantifier, and starting state.
 */
const repeatPaths = (
  pattern: Pattern,
  cbor: Cbor,
  path: Path,
  quantifier: Quantifier,
): { cbor: Cbor; path: Path }[] => {
  // Build states for all possible repetition counts
  const states: { cbor: Cbor; path: Path }[][] = [[{ cbor, path: [...path] }]];
  const bound = quantifier.max() ?? Number.MAX_SAFE_INTEGER;

  // Try matching the pattern repeatedly
  for (let rep = 0; rep < bound; rep++) {
    const next: { cbor: Cbor; path: Path }[] = [];
    const lastState = states[states.length - 1];

    for (const state of lastState) {
      const subPaths = getPatternPaths(pattern, state.cbor);

      for (const subPath of subPaths) {
        const last = subPath[subPath.length - 1];
        if (last === undefined) continue;

        // Avoid infinite loops
        if (cborEquals(last, state.cbor)) continue;

        const combined = [...state.path];
        // Skip first element if it's the same as current cbor
        const firstElement = subPath[0];
        const startIdx = firstElement !== undefined && cborEquals(firstElement, state.cbor) ? 1 : 0;
        for (let i = startIdx; i < subPath.length; i++) {
          combined.push(subPath[i]);
        }
        next.push({ cbor: last, path: combined });
      }
    }

    if (next.length === 0) break;
    states.push(next);
  }

  // Zero repetition case
  const hasZeroRep = quantifier.min() === 0;
  const zeroRepResult = hasZeroRep ? [{ cbor, path: [...path] }] : [];

  // Calculate maximum allowed repetitions
  const maxPossible = states.length - 1;
  const maxAllowed = Math.min(bound, maxPossible);

  // Check if we can satisfy the minimum repetition requirement
  if (maxAllowed < quantifier.min() && quantifier.min() > 0) {
    return [];
  }

  // Calculate the range of repetition counts
  const minCount = quantifier.min() === 0 ? 1 : quantifier.min();
  const maxCount = maxAllowed < minCount ? -1 : maxAllowed;

  if (maxCount < minCount) {
    return zeroRepResult;
  }

  // Generate list of counts based on reluctance
  let counts: number[];
  const reluctance = quantifier.reluctance();

  if (reluctance === Reluctance.Greedy) {
    counts = [];
    for (let i = maxCount; i >= minCount; i--) {
      counts.push(i);
    }
  } else if (reluctance === Reluctance.Lazy) {
    counts = [];
    for (let i = minCount; i <= maxCount; i++) {
      counts.push(i);
    }
  } else {
    // Possessive
    counts = maxCount >= minCount ? [maxCount] : [];
  }

  // Collect results
  const out: { cbor: Cbor; path: Path }[] = [];

  if (reluctance === Reluctance.Greedy) {
    for (const c of counts) {
      const list = states[c];
      if (list !== undefined) {
        out.push(...list);
      }
    }
    if (hasZeroRep && out.length === 0) {
      out.push({ cbor, path: [...path] });
    }
  } else {
    if (hasZeroRep) {
      out.push({ cbor, path: [...path] });
    }
    for (const c of counts) {
      const list = states[c];
      if (list !== undefined) {
        out.push(...list);
      }
    }
  }

  return out;
};

/**
 * Execute a single thread until it halts.
 */
const runThread = (
  prog: Program,
  start: Thread,
  out: { path: Path; captures: Path[][] }[],
): boolean => {
  let produced = false;
  const stack: Thread[] = [start];

  while (stack.length > 0) {
    const th = stack.pop();
    if (th === undefined) break;

    threadLoop: while (true) {
      const instr = prog.code[th.pc];

      switch (instr.type) {
        case "MatchPredicate": {
          const paths = atomicPaths(prog.literals[instr.literalIndex], th.cbor);
          if (paths.length === 0) {
            break threadLoop;
          }
          th.pc += 1;
          break;
        }

        case "MatchStructure": {
          const pattern = prog.literals[instr.literalIndex];
          if (pattern.kind !== "Structure") {
            throw new Error("MatchStructure used with non-structure pattern");
          }

          const result = getPatternPathsWithCapturesDirect(pattern, th.cbor);
          if (result.paths.length === 0) {
            break threadLoop;
          }

          // Merge structure captures into thread captures
          for (let i = 0; i < prog.captureNames.length; i++) {
            const name = prog.captureNames[i];
            const capturedPaths = result.captures.get(name);
            if (capturedPaths !== undefined) {
              while (th.captures.length <= i) {
                th.captures.push([]);
              }
              th.captures[i].push(...capturedPaths);
            }
          }

          // Handle structure paths
          if (result.paths.length === 1 && result.paths[0].length === 1) {
            th.pc += 1;
          } else {
            for (const structurePath of result.paths) {
              const target = structurePath[structurePath.length - 1];
              if (target !== undefined) {
                const newThread: Thread = {
                  pc: th.pc + 1,
                  cbor: target,
                  path: [...th.path, ...structurePath.slice(1)],
                  savedPaths: [...th.savedPaths],
                  captures: th.captures.map((c) => [...c]),
                  captureStack: th.captureStack.map((s) => [...s]),
                };
                stack.push(newThread);
              }
            }
            break threadLoop;
          }
          break;
        }

        case "Split": {
          const th2: Thread = {
            pc: instr.b,
            cbor: th.cbor,
            path: [...th.path],
            savedPaths: [...th.savedPaths],
            captures: th.captures.map((c) => [...c]),
            captureStack: th.captureStack.map((s) => [...s]),
          };
          stack.push(th2);
          th.pc = instr.a;
          break;
        }

        case "Jump": {
          th.pc = instr.address;
          break;
        }

        case "PushAxis": {
          const children = axisChildren(instr.axis, th.cbor);
          for (const child of children) {
            const newThread: Thread = {
              pc: th.pc + 1,
              cbor: child,
              path: [...th.path, child],
              savedPaths: [...th.savedPaths],
              captures: th.captures.map((c) => [...c]),
              captureStack: th.captureStack.map((s) => [...s]),
            };
            stack.push(newThread);
          }
          break threadLoop;
        }

        case "Pop": {
          if (th.path.length === 0) {
            break threadLoop;
          }
          th.path.pop();
          const parent = th.path[th.path.length - 1];
          if (parent !== undefined) {
            th.cbor = parent;
          }
          th.pc += 1;
          break;
        }

        case "Save": {
          out.push({ path: [...th.path], captures: th.captures.map((c) => [...c]) });
          produced = true;
          th.pc += 1;
          break;
        }

        case "Accept": {
          out.push({ path: [...th.path], captures: th.captures.map((c) => [...c]) });
          produced = true;
          break threadLoop;
        }

        case "Search": {
          // Create a SearchPattern wrapper for the inner pattern
          const innerPattern = prog.literals[instr.patternIndex];
          const searchPat = createSearchPattern(innerPattern);

          // Use recursive search with captures
          const result = searchPatternPathsWithCaptures(searchPat, th.cbor);

          for (const searchPath of result.paths) {
            const newThread: Thread = {
              pc: th.pc + 1,
              cbor: th.cbor,
              path: searchPath,
              savedPaths: [...th.savedPaths],
              captures: th.captures.map((c) => [...c]),
              captureStack: th.captureStack.map((s) => [...s]),
            };

            // Apply capture mappings
            for (const [name, captureIdx] of instr.captureMap) {
              if (captureIdx < newThread.captures.length) {
                const capturePaths = result.captures.get(name);
                if (capturePaths !== undefined) {
                  for (const capturePath of capturePaths) {
                    newThread.captures[captureIdx].push(capturePath);
                  }
                }
              }
            }

            stack.push(newThread);
          }
          break threadLoop;
        }

        case "ExtendSequence": {
          th.savedPaths.push([...th.path]);
          const last = th.path[th.path.length - 1];
          if (last !== undefined) {
            th.path = [last];
            th.cbor = last;
          }
          th.pc += 1;
          break;
        }

        case "CombineSequence": {
          const saved = th.savedPaths.pop();
          if (saved !== undefined) {
            const combined = [...saved];
            if (th.path.length > 1) {
              combined.push(...th.path.slice(1));
            }
            th.path = combined;
          }
          th.pc += 1;
          break;
        }

        case "NotMatch": {
          const paths = getPatternPaths(prog.literals[instr.patternIndex], th.cbor);
          if (paths.length > 0) {
            break threadLoop; // Pattern matched, so NOT fails
          }
          th.pc += 1;
          break;
        }

        case "Repeat": {
          const results = repeatPaths(
            prog.literals[instr.patternIndex],
            th.cbor,
            th.path,
            instr.quantifier,
          );

          for (const result of results) {
            const newThread: Thread = {
              pc: th.pc + 1,
              cbor: result.cbor,
              path: result.path,
              savedPaths: [...th.savedPaths],
              captures: th.captures.map((c) => [...c]),
              captureStack: th.captureStack.map((s) => [...s]),
            };
            stack.push(newThread);
          }
          break threadLoop;
        }

        case "CaptureStart": {
          const idx = instr.captureIndex;
          while (th.captures.length <= idx) {
            th.captures.push([]);
          }
          while (th.captureStack.length <= idx) {
            th.captureStack.push([]);
          }
          th.captureStack[idx].push(th.path.length);
          th.pc += 1;
          break;
        }

        case "CaptureEnd": {
          const idx = instr.captureIndex;
          const stack = th.captureStack[idx];
          if (stack !== undefined && stack.length > 0) {
            stack.pop();
            const capturedPath = [...th.path];
            const captureArray = th.captures[idx];
            if (captureArray !== undefined) {
              captureArray.push(capturedPath);
            }
          }
          th.pc += 1;
          break;
        }
      }
    }
  }

  return produced;
};

/**
 * Execute a program against a dCBOR value, returning all matching paths and captures.
 */
export const run = (
  prog: Program,
  root: Cbor,
): { paths: Path[]; captures: Map<string, Path[]> } => {
  // Initialize captures array with one empty array per capture name
  const initialCaptures: Path[][] = prog.captureNames.map(() => []);

  const start: Thread = {
    pc: 0,
    cbor: root,
    path: [root],
    savedPaths: [],
    captures: initialCaptures,
    captureStack: [],
  };

  const results: { path: Path; captures: Path[][] }[] = [];
  runThread(prog, start, results);

  // Deduplicate paths while preserving original order
  const seenPaths = new Set<string>();
  const paths: Path[] = [];

  for (const result of results) {
    const hash = pathHash(result.path);
    if (!seenPaths.has(hash)) {
      seenPaths.add(hash);
      paths.push(result.path);
    }
  }

  // Build capture map from capture names and results
  const captures = new Map<string, Path[]>();

  for (let i = 0; i < prog.captureNames.length; i++) {
    const name = prog.captureNames[i];
    const capturedPaths: Path[] = [];

    for (const result of results) {
      const captureGroup = result.captures[i];
      if (captureGroup !== undefined) {
        capturedPaths.push(...captureGroup);
      }
    }

    // Deduplicate captured paths
    if (capturedPaths.length > 0) {
      const seenCapturePaths = new Set<string>();
      const deduplicated: Path[] = [];

      for (const path of capturedPaths) {
        const hash = pathHash(path);
        if (!seenCapturePaths.has(hash)) {
          seenCapturePaths.add(hash);
          deduplicated.push(path);
        }
      }

      captures.set(name, deduplicated);
    }
  }

  return { paths, captures };
};

/**
 * VM for executing pattern programs against dCBOR values.
 */
export class Vm {
  /**
   * Execute a program against a dCBOR value.
   */
  static run(prog: Program, root: Cbor): { paths: Path[]; captures: Map<string, Path[]> } {
    return run(prog, root);
  }
}
