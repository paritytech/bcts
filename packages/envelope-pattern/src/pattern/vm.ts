/**
 * @bcts/envelope-pattern - VM instructions and executor
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust vm.rs
 * Tiny Thompson-style VM for walking Gordian Envelope trees.
 *
 * @module envelope-pattern/pattern/vm
 */

import type { Envelope } from "@bcts/envelope";
import type { Quantifier } from "@bcts/dcbor-pattern";
import { Reluctance } from "@bcts/dcbor-pattern";
import type { Path } from "../format";

// Forward declaration - will be set by pattern/index.ts to avoid circular deps
let _patternPathsWithCaptures: (pattern: Pattern, env: Envelope) => [Path[], Map<string, Path[]>];
let _patternMatches: (pattern: Pattern, env: Envelope) => boolean;
let _patternPaths: (pattern: Pattern, env: Envelope) => Path[];

/**
 * Register the pattern matching functions to resolve circular dependencies.
 */
export function registerVMPatternFunctions(
  pathsWithCaptures: (pattern: Pattern, env: Envelope) => [Path[], Map<string, Path[]>],
  matches: (pattern: Pattern, env: Envelope) => boolean,
  paths: (pattern: Pattern, env: Envelope) => Path[],
): void {
  _patternPathsWithCaptures = pathsWithCaptures;
  _patternMatches = matches;
  _patternPaths = paths;
}

// Import Pattern type - this creates a circular dependency that we resolve via registration
import type { Pattern } from "./index";
import { leafPatternPathsWithCaptures } from "./leaf";
import { structurePatternPathsWithCaptures, structurePatternPaths } from "./structure";

/**
 * Axis for envelope traversal.
 *
 * Corresponds to the Rust `Axis` enum in vm.rs
 */
export type Axis = "Subject" | "Assertion" | "Predicate" | "Object" | "Wrapped";

/**
 * Edge type for envelope traversal.
 */
export type EdgeType = "Subject" | "Assertion" | "Predicate" | "Object" | "Content";

/**
 * Returns (child, EdgeType) pairs reachable from env via this axis.
 */
export function axisChildren(axis: Axis, env: Envelope): [Envelope, EdgeType][] {
  const envCase = env.case();

  switch (axis) {
    case "Subject": {
      if (envCase.type === "node") {
        return [[envCase.subject, "Subject"]];
      }
      return [];
    }
    case "Assertion": {
      if (envCase.type === "node") {
        return envCase.assertions.map((a) => [a, "Assertion"] as [Envelope, EdgeType]);
      }
      return [];
    }
    case "Predicate": {
      if (envCase.type === "assertion") {
        return [[envCase.assertion.predicate(), "Predicate"]];
      }
      return [];
    }
    case "Object": {
      if (envCase.type === "assertion") {
        return [[envCase.assertion.object(), "Object"]];
      }
      return [];
    }
    case "Wrapped": {
      if (envCase.type === "node") {
        const subject = envCase.subject;
        if (subject.isWrapped()) {
          const unwrapped = subject.unwrap();
          if (unwrapped !== undefined) {
            return [[unwrapped, "Content"]];
          }
        }
      } else if (envCase.type === "wrapped") {
        return [[envCase.envelope, "Content"]];
      }
      return [];
    }
  }
}

/**
 * VM instructions for pattern matching.
 *
 * Corresponds to the Rust `Instr` enum in vm.rs
 */
export type Instr =
  | { readonly type: "MatchPredicate"; readonly literalIndex: number }
  | { readonly type: "MatchStructure"; readonly literalIndex: number }
  | { readonly type: "Split"; readonly a: number; readonly b: number }
  | { readonly type: "Jump"; readonly address: number }
  | { readonly type: "PushAxis"; readonly axis: Axis }
  | { readonly type: "Pop" }
  | { readonly type: "Save" }
  | { readonly type: "Accept" }
  | {
      readonly type: "Search";
      readonly patternIndex: number;
      readonly captureMap: [string, number][];
    }
  | { readonly type: "ExtendTraversal" }
  | { readonly type: "CombineTraversal" }
  | { readonly type: "NavigateSubject" }
  | { readonly type: "NotMatch"; readonly patternIndex: number }
  | { readonly type: "Repeat"; readonly patternIndex: number; readonly quantifier: Quantifier }
  | { readonly type: "CaptureStart"; readonly captureIndex: number }
  | { readonly type: "CaptureEnd"; readonly captureIndex: number };

/**
 * Compiled program for the VM.
 */
export interface Program {
  readonly code: Instr[];
  readonly literals: Pattern[];
  readonly captureNames: string[];
}

/**
 * Internal back-tracking state.
 */
interface Thread {
  pc: number;
  env: Envelope;
  path: Path;
  savedPaths: Path[];
  captures: Path[][];
  captureStack: number[][];
  seen: Set<string>;
}

/**
 * Clone a thread for forking.
 */
function cloneThread(th: Thread): Thread {
  return {
    pc: th.pc,
    env: th.env,
    path: [...th.path],
    savedPaths: th.savedPaths.map((p) => [...p]),
    captures: th.captures.map((c) => c.map((p) => [...p])),
    captureStack: th.captureStack.map((s) => [...s]),
    seen: new Set(th.seen),
  };
}

/**
 * Get a unique key for a path based on envelope digests.
 */
function pathKey(path: Path): string {
  return path.map((e) => e.digest().hex()).join(",");
}

/**
 * Match atomic patterns without recursion into the VM.
 *
 * This function handles only the patterns that are safe to use in
 * MatchPredicate instructions - Leaf, Structure, Any patterns.
 */
function atomicPathsWithCaptures(p: Pattern, env: Envelope): [Path[], Map<string, Path[]>] {
  switch (p.type) {
    case "Leaf":
      return leafPatternPathsWithCaptures(p.pattern, env);
    case "Structure":
      return structurePatternPathsWithCaptures(p.pattern, env);
    case "Meta":
      if (p.pattern.type === "Any") {
        return p.pattern.pattern.pathsWithCaptures(env);
      }
      if (p.pattern.type === "Search") {
        throw new Error(
          "SearchPattern should be compiled to Search instruction, not MatchPredicate",
        );
      }
      throw new Error(`non-atomic meta pattern used in MatchPredicate: ${p.pattern.type}`);
  }
}

/**
 * Execute repeat pattern matching.
 */
function repeatPaths(
  pat: Pattern,
  env: Envelope,
  path: Path,
  quantifier: Quantifier,
): [Envelope, Path][] {
  // Build states for all possible repetition counts
  const states: [Envelope, Path][][] = [[[env, [...path]]]];
  const bound = quantifier.max() ?? Number.MAX_SAFE_INTEGER;

  // Try matching the pattern repeatedly
  for (let i = 0; i < bound; i++) {
    const next: [Envelope, Path][] = [];
    const lastState = states[states.length - 1];

    for (const [e, pth] of lastState) {
      const subPaths = _patternPaths(pat, e);
      for (const subPath of subPaths) {
        const last = subPath[subPath.length - 1];
        if (last?.digest().hex() === e.digest().hex()) {
          continue; // Avoid infinite loops
        }
        if (last !== undefined) {
          const combined = [...pth];
          if (subPath[0]?.digest().hex() === e.digest().hex()) {
            combined.push(...subPath.slice(1));
          } else {
            combined.push(...subPath);
          }
          next.push([last, combined]);
        }
      }
    }

    if (next.length === 0) {
      break; // No more matches possible
    }
    states.push(next);
  }

  // Zero repetition case
  const hasZeroRep = quantifier.min() === 0;
  const zeroRepResult: [Envelope, Path][] = hasZeroRep ? [[env, [...path]]] : [];

  // Calculate maximum allowed repetitions
  const maxPossible = states.length - 1;
  const maxAllowed = Math.min(bound, maxPossible);

  // Check if we can satisfy the minimum repetition requirement
  if (maxAllowed < quantifier.min() && quantifier.min() > 0) {
    return [];
  }

  // Calculate the range of repetition counts based on min and max
  const minCount = quantifier.min() === 0 ? 1 : quantifier.min();
  if (maxAllowed < minCount) {
    return zeroRepResult;
  }
  const maxCount = maxAllowed;

  // Generate list of counts to try based on reluctance
  let counts: number[];
  switch (quantifier.reluctance()) {
    case Reluctance.Greedy: {
      counts = [];
      for (let c = maxCount; c >= minCount; c--) {
        counts.push(c);
      }
      break;
    }
    case Reluctance.Lazy: {
      counts = [];
      for (let c = minCount; c <= maxCount; c++) {
        counts.push(c);
      }
      break;
    }
    case Reluctance.Possessive: {
      counts = maxCount >= minCount ? [maxCount] : [];
      break;
    }
  }

  // Collect results based on the counts determined above
  const out: [Envelope, Path][] = [];

  if (quantifier.reluctance() === Reluctance.Greedy) {
    // Include results from counts determined by reluctance
    for (const c of counts) {
      const list = states[c];
      if (list !== undefined) {
        out.push(...list);
      }
    }

    // For greedy matching, add zero repetition case at the end if applicable
    if (hasZeroRep && out.length === 0) {
      out.push([env, [...path]]);
    }
  } else {
    // For lazy/possessive, include zero repetition first if applicable
    if (hasZeroRep) {
      out.push([env, [...path]]);
    }

    // Then include results from counts determined by reluctance
    for (const c of counts) {
      const list = states[c];
      if (list !== undefined) {
        out.push(...list);
      }
    }
  }

  return out;
}

/**
 * Execute a single thread until it halts.
 * Returns true if any paths were produced.
 */
function runThread(prog: Program, start: Thread, out: [Path, Path[][]][]): boolean {
  let produced = false;
  const stack: Thread[] = [start];

  while (stack.length > 0) {
    const th = stack.pop();
    if (th === undefined) break;

    while (true) {
      const instr = prog.code[th.pc];

      switch (instr.type) {
        case "MatchPredicate": {
          const [paths, patternCaptures] = atomicPathsWithCaptures(
            prog.literals[instr.literalIndex],
            th.env,
          );

          if (paths.length === 0) {
            break; // Kill thread
          }

          th.pc += 1;

          // Distribute captures fairly across paths
          const distributedCaptures: Map<string, Path[]>[] = paths.map(
            () => new Map<string, Path[]>(),
          );

          for (const [name, capturePaths] of patternCaptures) {
            if (capturePaths.length === paths.length) {
              // Distribute 1:1
              for (let pathIdx = 0; pathIdx < capturePaths.length; pathIdx++) {
                if (pathIdx < distributedCaptures.length) {
                  const existing = distributedCaptures[pathIdx].get(name) ?? [];
                  existing.push(capturePaths[pathIdx]);
                  distributedCaptures[pathIdx].set(name, existing);
                }
              }
            } else {
              // Fallback: give all captures to the first path
              if (distributedCaptures.length > 0) {
                const existing = distributedCaptures[0].get(name) ?? [];
                existing.push(...capturePaths);
                distributedCaptures[0].set(name, existing);
              }
            }
          }

          // Use first path for current thread
          const firstPath = paths[0];
          if (firstPath.length === 1 && firstPath[0].digest().hex() === th.env.digest().hex()) {
            // Simple atomic match - keep existing path and environment
          } else {
            // Extended path - use the full extended path
            th.path = [...firstPath];
            const lastEnv = firstPath[firstPath.length - 1];
            if (lastEnv !== undefined) {
              th.env = lastEnv;
            }
          }

          // Add distributed captures for this path
          const pathCaptures = distributedCaptures[0];
          if (pathCaptures !== undefined) {
            for (const [name, capPaths] of pathCaptures) {
              const captureIdx = prog.captureNames.indexOf(name);
              if (captureIdx >= 0 && captureIdx < th.captures.length) {
                th.captures[captureIdx].push(...capPaths);
              }
            }
          }

          // Spawn threads for remaining paths in reverse order
          for (let i = paths.length - 1; i >= 1; i--) {
            const fork = cloneThread(th);
            // Reset captures for the fork
            for (const captureVec of fork.captures) {
              captureVec.length = 0;
            }
            const pathI = paths[i];
            if (pathI === undefined) continue;
            fork.path = [...pathI];
            const lastEnv = pathI[pathI.length - 1];
            if (lastEnv !== undefined) {
              fork.env = lastEnv;
            }

            // Add distributed captures for this path
            const forkCaptures = distributedCaptures[i];
            if (forkCaptures !== undefined) {
              for (const [name, capPaths] of forkCaptures) {
                const captureIdx = prog.captureNames.indexOf(name);
                if (captureIdx >= 0 && captureIdx < fork.captures.length) {
                  fork.captures[captureIdx].push(...capPaths);
                }
              }
            }

            stack.push(fork);
          }
          continue;
        }

        case "MatchStructure": {
          const literal = prog.literals[instr.literalIndex];
          if (literal.type !== "Structure") {
            throw new Error("MatchStructure used with non-structure pattern");
          }

          const structurePaths = structurePatternPaths(literal.pattern, th.env);

          if (structurePaths.length === 0) {
            break; // Kill thread
          }

          th.pc += 1;

          // Use first path for current thread
          const firstStructPath = structurePaths[0];
          if (firstStructPath !== undefined) {
            th.path = [...firstStructPath];
            const firstLast = firstStructPath[firstStructPath.length - 1];
            if (firstLast !== undefined) {
              th.env = firstLast;
            }
          }

          // Spawn threads for remaining paths
          for (let i = structurePaths.length - 1; i >= 1; i--) {
            const structPathI = structurePaths[i];
            if (structPathI === undefined) continue;
            const fork = cloneThread(th);
            fork.path = [...structPathI];
            const lastEnv = structPathI[structPathI.length - 1];
            if (lastEnv !== undefined) {
              fork.env = lastEnv;
            }
            stack.push(fork);
          }
          continue;
        }

        case "Split": {
          const fork = cloneThread(th);
          fork.pc = instr.a;
          stack.push(fork);
          th.pc = instr.b;
          continue;
        }

        case "Jump": {
          th.pc = instr.address;
          continue;
        }

        case "PushAxis": {
          th.pc += 1;
          const children = axisChildren(instr.axis, th.env);
          for (const [child, _edge] of children) {
            const fork = cloneThread(th);
            fork.env = child;
            fork.path.push(child);
            stack.push(fork);
          }
          break; // Parent path stops here
        }

        case "Pop": {
          th.path.pop();
          th.pc += 1;
          continue;
        }

        case "Save": {
          out.push([[...th.path], th.captures.map((c) => c.map((p) => [...p]))]);
          produced = true;
          th.pc += 1;
          continue;
        }

        case "Accept": {
          out.push([[...th.path], th.captures.map((c) => c.map((p) => [...p]))]);
          produced = true;
          break; // Halt thread
        }

        case "Search": {
          const inner = prog.literals[instr.patternIndex];
          if (inner === undefined) break;
          const [foundPaths, caps] = _patternPathsWithCaptures(inner, th.env);

          if (foundPaths.length > 0) {
            produced = true;
            for (const foundPath of foundPaths) {
              const resultPath = [...th.path];
              if (foundPath[0]?.digest().hex() === th.env.digest().hex()) {
                resultPath.push(...foundPath.slice(1));
              } else {
                resultPath.push(...foundPath);
              }

              const resultCaps = th.captures.map((c) => c.map((p) => [...p]));
              for (const [name, idx] of instr.captureMap) {
                const pths = caps.get(name);
                if (pths !== undefined) {
                  resultCaps[idx].push(...pths);
                }
              }

              const key = pathKey(resultPath);
              if (!th.seen.has(key)) {
                th.seen.add(key);
                out.push([resultPath, resultCaps]);
              }
            }
          }

          // Always walk children (same traversal as Envelope::walk)
          const allChildren: Envelope[] = [];
          const envCase = th.env.case();

          switch (envCase.type) {
            case "node": {
              allChildren.push(envCase.subject);
              for (const assertion of envCase.assertions) {
                allChildren.push(assertion);
              }
              break;
            }
            case "wrapped": {
              allChildren.push(envCase.envelope);
              break;
            }
            case "assertion": {
              allChildren.push(envCase.assertion.predicate());
              allChildren.push(envCase.assertion.object());
              break;
            }
            case "elided":
            case "encrypted":
            case "compressed":
            case "leaf":
            case "knownValue":
              // These envelope types have no children to traverse
              break;
          }

          // Push child threads in reverse order
          for (let i = allChildren.length - 1; i >= 0; i--) {
            const child = allChildren[i];
            if (child === undefined) continue;
            const fork = cloneThread(th);
            fork.env = child;
            fork.path.push(child);
            stack.push(fork);
          }

          break; // This thread is done
        }

        case "ExtendTraversal": {
          const lastEnv = th.path[th.path.length - 1];
          if (lastEnv !== undefined) {
            th.savedPaths.push([...th.path]);
            th.env = lastEnv;
            th.path = [lastEnv]; // Start fresh path from the last envelope
          }
          th.pc += 1;
          continue;
        }

        case "CombineTraversal": {
          const savedPath = th.savedPaths.pop();
          if (savedPath !== undefined) {
            const combined = [...savedPath];
            const savedLast = savedPath[savedPath.length - 1];

            if (
              savedLast?.digest().hex() === th.path[0]?.digest().hex() &&
              savedLast !== undefined
            ) {
              // Skip first element to avoid duplication
              combined.push(...th.path.slice(1));
            } else {
              combined.push(...th.path);
            }

            th.path = combined;
          }
          th.pc += 1;
          continue;
        }

        case "NavigateSubject": {
          if (th.env.isNode()) {
            const subject = th.env.subject();
            th.env = subject;
            th.path.push(subject);
          }
          th.pc += 1;
          continue;
        }

        case "NotMatch": {
          const pattern = prog.literals[instr.patternIndex];
          const patternMatches = _patternMatches(pattern, th.env);

          if (patternMatches) {
            // Inner pattern matches, so NOT pattern fails - kill thread
            break;
          } else {
            // Inner pattern doesn't match, so NOT pattern succeeds
            th.pc += 1;
            continue;
          }
        }

        case "Repeat": {
          const pat = prog.literals[instr.patternIndex];
          const results = repeatPaths(pat, th.env, th.path, instr.quantifier);

          if (results.length === 0) {
            break; // Kill thread
          }

          const nextPc = th.pc + 1;
          let success = false;

          for (const [envAfter, pathAfter] of results) {
            const fork = cloneThread(th);
            fork.pc = nextPc;
            fork.env = envAfter;
            fork.path = pathAfter;

            if (runThread(prog, fork, out)) {
              produced = true;
              success = true;
              break;
            }
          }

          if (!success) {
            // None of the repetition counts allowed the rest to match
          }
          break;
        }

        case "CaptureStart": {
          const id = instr.captureIndex;
          if (id < th.captureStack.length) {
            th.captureStack[id].push(th.path.length - 1);
          }
          th.pc += 1;
          continue;
        }

        case "CaptureEnd": {
          const id = instr.captureIndex;
          if (id < th.captureStack.length) {
            const startIdx = th.captureStack[id].pop();
            if (startIdx !== undefined && id < th.captures.length) {
              let end = th.path.length;
              // Check if next instruction is ExtendTraversal
              const nextInstr = prog.code[th.pc + 1];
              if (nextInstr?.type === "ExtendTraversal") {
                end = Math.max(0, end - 1);
              }
              const cap = th.path.slice(startIdx, end);
              th.captures[id].push(cap);
            }
          }
          th.pc += 1;
          continue;
        }
      }

      // If we get here without continue, break out of the inner loop
      break;
    }
  }

  return produced;
}

/**
 * Execute prog starting at root.
 * Every time SAVE or ACCEPT executes, the current path is pushed into the result.
 */
export function run(prog: Program, root: Envelope): [Path, Map<string, Path[]>][] {
  const out: [Path, Path[][]][] = [];

  const start: Thread = {
    pc: 0,
    env: root,
    path: [root],
    savedPaths: [],
    captures: prog.captureNames.map(() => []),
    captureStack: prog.captureNames.map(() => []),
    seen: new Set(),
  };

  runThread(prog, start, out);

  return out.map(([path, caps]) => {
    const map = new Map<string, Path[]>();
    for (let i = 0; i < caps.length; i++) {
      const paths = caps[i];
      if (paths.length > 0) {
        map.set(prog.captureNames[i], paths);
      }
    }
    return [path, map];
  });
}

/**
 * Compile a pattern to bytecode program.
 */
export function compile(pattern: Pattern): Program {
  const code: Instr[] = [];
  const literals: Pattern[] = [];
  const captureNames: string[] = [];

  // Collect capture names first
  collectCaptureNames(pattern, captureNames);

  // Compile the pattern
  compilePattern(pattern, code, literals, captureNames);

  // Add final Accept instruction
  code.push({ type: "Accept" });

  return { code, literals, captureNames };
}

/**
 * Collect capture names from a pattern recursively.
 */
function collectCaptureNames(pattern: Pattern, out: string[]): void {
  switch (pattern.type) {
    case "Leaf":
      // Leaf patterns don't have captures
      break;
    case "Structure":
      // Structure patterns may have nested patterns with captures
      collectStructureCaptureNames(pattern.pattern, out);
      break;
    case "Meta":
      collectMetaCaptureNames(pattern.pattern, out);
      break;
  }
}

import type { StructurePattern } from "./structure";
import type { MetaPattern } from "./meta";

function collectStructureCaptureNames(pattern: StructurePattern, out: string[]): void {
  switch (pattern.type) {
    case "Subject": {
      const inner = pattern.pattern.innerPattern();
      if (inner !== undefined) {
        collectCaptureNames(inner, out);
      }
      break;
    }
    case "Predicate": {
      const inner = pattern.pattern.innerPattern();
      if (inner !== undefined) {
        collectCaptureNames(inner, out);
      }
      break;
    }
    case "Object": {
      const inner = pattern.pattern.innerPattern();
      if (inner !== undefined) {
        collectCaptureNames(inner, out);
      }
      break;
    }
    case "Assertions": {
      const predPat = pattern.pattern.predicatePattern();
      if (predPat !== undefined) {
        collectCaptureNames(predPat, out);
      }
      const objPat = pattern.pattern.objectPattern();
      if (objPat !== undefined) {
        collectCaptureNames(objPat, out);
      }
      break;
    }
    case "Node": {
      const subjPat = pattern.pattern.subjectPattern();
      if (subjPat !== undefined) {
        collectCaptureNames(subjPat, out);
      }
      for (const assertionPat of pattern.pattern.assertionPatterns()) {
        collectCaptureNames(assertionPat, out);
      }
      break;
    }
    case "Wrapped": {
      const inner = pattern.pattern.innerPattern();
      if (inner !== undefined) {
        collectCaptureNames(inner, out);
      }
      break;
    }
    case "Digest":
    case "Obscured":
    case "Leaf":
      // These don't have nested patterns
      break;
  }
}

function collectMetaCaptureNames(pattern: MetaPattern, out: string[]): void {
  switch (pattern.type) {
    case "Any":
      // No captures
      break;
    case "And":
      for (const p of pattern.pattern.patterns()) {
        collectCaptureNames(p, out);
      }
      break;
    case "Or":
      for (const p of pattern.pattern.patterns()) {
        collectCaptureNames(p, out);
      }
      break;
    case "Not":
      collectCaptureNames(pattern.pattern.pattern(), out);
      break;
    case "Capture": {
      const name = pattern.pattern.name();
      if (!out.includes(name)) {
        out.push(name);
      }
      collectCaptureNames(pattern.pattern.pattern(), out);
      break;
    }
    case "Search":
      collectCaptureNames(pattern.pattern.pattern(), out);
      break;
    case "Traverse":
      for (const p of pattern.pattern.patterns()) {
        collectCaptureNames(p, out);
      }
      break;
    case "Group":
      collectCaptureNames(pattern.pattern.pattern(), out);
      break;
  }
}

/**
 * Compile a pattern to bytecode.
 */
function compilePattern(
  pattern: Pattern,
  code: Instr[],
  literals: Pattern[],
  captureNames: string[],
): void {
  switch (pattern.type) {
    case "Leaf":
    case "Structure":
      // Atomic patterns use MatchPredicate
      literals.push(pattern);
      code.push({ type: "MatchPredicate", literalIndex: literals.length - 1 });
      break;
    case "Meta":
      compileMetaPattern(pattern.pattern, code, literals, captureNames);
      break;
  }
}

function compileMetaPattern(
  pattern: MetaPattern,
  code: Instr[],
  literals: Pattern[],
  captureNames: string[],
): void {
  switch (pattern.type) {
    case "Any": {
      // Any matches everything - add as atomic
      const anyPattern: Pattern = { type: "Meta", pattern };
      literals.push(anyPattern);
      code.push({ type: "MatchPredicate", literalIndex: literals.length - 1 });
      break;
    }
    case "And": {
      // All patterns must match at the same position
      const patterns = pattern.pattern.patterns();
      for (const p of patterns) {
        compilePattern(p, code, literals, captureNames);
      }
      break;
    }
    case "Or": {
      // Try each pattern with Split/Jump
      const patterns = pattern.pattern.patterns();
      if (patterns.length === 0) return;
      if (patterns.length === 1) {
        compilePattern(patterns[0], code, literals, captureNames);
        return;
      }

      // Create split chain
      const jumpAddresses: number[] = [];
      for (let i = 0; i < patterns.length - 1; i++) {
        const splitAddr = code.length;
        code.push({ type: "Split", a: 0, b: 0 }); // Placeholder

        // First branch
        const aStart = code.length;
        compilePattern(patterns[i], code, literals, captureNames);
        jumpAddresses.push(code.length);
        code.push({ type: "Jump", address: 0 }); // Placeholder

        // Update split to point to first branch and next split
        const bStart = code.length;
        (code[splitAddr] as { type: "Split"; a: number; b: number }).a = aStart;
        (code[splitAddr] as { type: "Split"; a: number; b: number }).b = bStart;
      }

      // Last pattern (no split needed)
      compilePattern(patterns[patterns.length - 1], code, literals, captureNames);

      // Update all jumps to point after the Or
      const endAddr = code.length;
      for (const jumpAddr of jumpAddresses) {
        (code[jumpAddr] as { type: "Jump"; address: number }).address = endAddr;
      }
      break;
    }
    case "Not": {
      // Use NotMatch instruction
      const innerPattern = pattern.pattern.pattern();
      literals.push(innerPattern);
      code.push({ type: "NotMatch", patternIndex: literals.length - 1 });
      break;
    }
    case "Capture": {
      const name = pattern.pattern.name();
      const captureIndex = captureNames.indexOf(name);

      code.push({ type: "CaptureStart", captureIndex });
      compilePattern(pattern.pattern.pattern(), code, literals, captureNames);
      code.push({ type: "CaptureEnd", captureIndex });
      break;
    }
    case "Search": {
      // Build capture map
      const innerCaptureNames: string[] = [];
      collectCaptureNames(pattern.pattern.pattern(), innerCaptureNames);

      const captureMap: [string, number][] = innerCaptureNames.map((name) => {
        const idx = captureNames.indexOf(name);
        return [name, idx >= 0 ? idx : 0];
      });

      literals.push(pattern.pattern.pattern());
      code.push({
        type: "Search",
        patternIndex: literals.length - 1,
        captureMap,
      });
      break;
    }
    case "Traverse": {
      // Matches Rust's recursive compilation: each ExtendTraversal gets a
      // matching CombineTraversal so saved paths are properly restored.
      const patterns = pattern.pattern.patterns();
      if (patterns.length > 0) {
        compilePattern(patterns[0], code, literals, captureNames);
        for (let i = 1; i < patterns.length; i++) {
          code.push({ type: "ExtendTraversal" });
          compilePattern(patterns[i], code, literals, captureNames);
        }
        for (let i = 1; i < patterns.length; i++) {
          code.push({ type: "CombineTraversal" });
        }
      }
      break;
    }
    case "Group": {
      const quantifier = pattern.pattern.quantifier();
      if (quantifier !== undefined && !(quantifier.min() === 1 && quantifier.max() === 1)) {
        // Repeat pattern (skip for exactly-1 which is simple pass-through)
        literals.push(pattern.pattern.pattern());
        code.push({
          type: "Repeat",
          patternIndex: literals.length - 1,
          quantifier,
        });
      } else {
        // Simple grouping (including exactly-1 quantifier)
        compilePattern(pattern.pattern.pattern(), code, literals, captureNames);
      }
      break;
    }
  }
}
