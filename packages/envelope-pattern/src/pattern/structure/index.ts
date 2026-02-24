/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Structure patterns module
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust pattern/structure/mod.rs
 *
 * @module envelope-pattern/pattern/structure
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Re-export all structure pattern types
export {
  LeafStructurePattern,
  registerLeafStructurePatternFactory,
} from "./leaf-structure-pattern";
export {
  SubjectPattern,
  type SubjectPatternType,
  registerSubjectPatternFactory,
} from "./subject-pattern";
export {
  PredicatePattern,
  type PredicatePatternType,
  registerPredicatePatternFactory,
} from "./predicate-pattern";
export {
  ObjectPattern,
  type ObjectPatternType,
  registerObjectPatternFactory,
} from "./object-pattern";
export {
  AssertionsPattern,
  type AssertionsPatternType,
  registerAssertionsPatternFactory,
} from "./assertions-pattern";
export {
  DigestPattern,
  type DigestPatternType,
  registerDigestPatternFactory,
} from "./digest-pattern";
export { NodePattern, type NodePatternType, registerNodePatternFactory } from "./node-pattern";
export {
  ObscuredPattern,
  type ObscuredPatternType,
  registerObscuredPatternFactory,
} from "./obscured-pattern";
export {
  WrappedPattern,
  type WrappedPatternType,
  registerWrappedPatternFactory,
  registerWrappedPatternDispatch,
} from "./wrapped-pattern";

// Import concrete types for use in StructurePattern
import { type LeafStructurePattern } from "./leaf-structure-pattern";
import { type SubjectPattern } from "./subject-pattern";
import { type PredicatePattern } from "./predicate-pattern";
import { type ObjectPattern } from "./object-pattern";
import { type AssertionsPattern } from "./assertions-pattern";
import { type DigestPattern } from "./digest-pattern";
import { type NodePattern } from "./node-pattern";
import { type ObscuredPattern } from "./obscured-pattern";
import { type WrappedPattern } from "./wrapped-pattern";

/**
 * Union type for all structure patterns.
 *
 * Corresponds to the Rust `StructurePattern` enum in pattern/structure/mod.rs
 */
export type StructurePattern =
  | { readonly type: "Leaf"; readonly pattern: LeafStructurePattern }
  | { readonly type: "Subject"; readonly pattern: SubjectPattern }
  | { readonly type: "Predicate"; readonly pattern: PredicatePattern }
  | { readonly type: "Object"; readonly pattern: ObjectPattern }
  | { readonly type: "Assertions"; readonly pattern: AssertionsPattern }
  | { readonly type: "Digest"; readonly pattern: DigestPattern }
  | { readonly type: "Node"; readonly pattern: NodePattern }
  | { readonly type: "Obscured"; readonly pattern: ObscuredPattern }
  | { readonly type: "Wrapped"; readonly pattern: WrappedPattern };

/**
 * Creates a Leaf structure pattern.
 */
export function structureLeaf(pattern: LeafStructurePattern): StructurePattern {
  return { type: "Leaf", pattern };
}

/**
 * Creates a Subject structure pattern.
 */
export function structureSubject(pattern: SubjectPattern): StructurePattern {
  return { type: "Subject", pattern };
}

/**
 * Creates a Predicate structure pattern.
 */
export function structurePredicate(pattern: PredicatePattern): StructurePattern {
  return { type: "Predicate", pattern };
}

/**
 * Creates an Object structure pattern.
 */
export function structureObject(pattern: ObjectPattern): StructurePattern {
  return { type: "Object", pattern };
}

/**
 * Creates an Assertions structure pattern.
 */
export function structureAssertions(pattern: AssertionsPattern): StructurePattern {
  return { type: "Assertions", pattern };
}

/**
 * Creates a Digest structure pattern.
 */
export function structureDigest(pattern: DigestPattern): StructurePattern {
  return { type: "Digest", pattern };
}

/**
 * Creates a Node structure pattern.
 */
export function structureNode(pattern: NodePattern): StructurePattern {
  return { type: "Node", pattern };
}

/**
 * Creates an Obscured structure pattern.
 */
export function structureObscured(pattern: ObscuredPattern): StructurePattern {
  return { type: "Obscured", pattern };
}

/**
 * Creates a Wrapped structure pattern.
 */
export function structureWrapped(pattern: WrappedPattern): StructurePattern {
  return { type: "Wrapped", pattern };
}

/**
 * Gets paths with captures for a structure pattern.
 */
export function structurePatternPathsWithCaptures(
  pattern: StructurePattern,
  haystack: Envelope,
): [Path[], Map<string, Path[]>] {
  switch (pattern.type) {
    case "Leaf":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Subject":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Predicate":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Object":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Assertions":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Digest":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Node":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Obscured":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Wrapped":
      return pattern.pattern.pathsWithCaptures(haystack);
  }
}

/**
 * Gets paths for a structure pattern.
 */
export function structurePatternPaths(pattern: StructurePattern, haystack: Envelope): Path[] {
  return structurePatternPathsWithCaptures(pattern, haystack)[0];
}

/**
 * Compiles a structure pattern to bytecode.
 */
export function structurePatternCompile(
  pattern: StructurePattern,
  code: Instr[],
  literals: Pattern[],
  captures: string[],
): void {
  switch (pattern.type) {
    case "Leaf":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Subject":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Predicate":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Object":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Assertions":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Digest":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Node":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Obscured":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Wrapped":
      pattern.pattern.compile(code, literals, captures);
      break;
  }
}

/**
 * Checks if a structure pattern is complex.
 */
export function structurePatternIsComplex(pattern: StructurePattern): boolean {
  switch (pattern.type) {
    case "Leaf":
      return pattern.pattern.isComplex();
    case "Subject":
      return pattern.pattern.isComplex();
    case "Predicate":
      return pattern.pattern.isComplex();
    case "Object":
      return pattern.pattern.isComplex();
    case "Assertions":
      return pattern.pattern.isComplex();
    case "Digest":
      return pattern.pattern.isComplex();
    case "Node":
      return pattern.pattern.isComplex();
    case "Obscured":
      return pattern.pattern.isComplex();
    case "Wrapped":
      return pattern.pattern.isComplex();
  }
}

/**
 * Converts a structure pattern to string.
 */
export function structurePatternToString(pattern: StructurePattern): string {
  switch (pattern.type) {
    case "Leaf":
      return pattern.pattern.toString();
    case "Subject":
      return pattern.pattern.toString();
    case "Predicate":
      return pattern.pattern.toString();
    case "Object":
      return pattern.pattern.toString();
    case "Assertions":
      return pattern.pattern.toString();
    case "Digest":
      return pattern.pattern.toString();
    case "Node":
      return pattern.pattern.toString();
    case "Obscured":
      return pattern.pattern.toString();
    case "Wrapped":
      return pattern.pattern.toString();
  }
}
