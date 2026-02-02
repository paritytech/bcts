/**
 * @bcts/envelope-pattern - Pattern module
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust pattern/mod.rs
 *
 * @module envelope-pattern/pattern
 */

import type { Envelope, Digest } from "@bcts/envelope";
import type { CborInput, CborDate, Tag } from "@bcts/dcbor";
import type { KnownValue } from "@bcts/known-values";
import { UNIT as KNOWN_VALUE_UNIT } from "@bcts/known-values";
import {
  type Pattern as DCBORPattern,
  Quantifier,
  Interval,
  Reluctance,
} from "@bcts/dcbor-pattern";

import type { Path } from "../format";
import type { Instr } from "./vm";

// Re-export sub-modules
export * from "./leaf";
export * from "./structure";
export * from "./meta";
export * from "./matcher";
export * from "./vm";
export * from "./dcbor-integration";

// Import leaf patterns
import {
  type LeafPattern,
  leafCbor,
  leafNumber,
  leafText,
  leafByteString,
  leafTag,
  leafArray,
  leafMap,
  leafBool,
  leafNull,
  leafDate,
  leafKnownValue,
  leafPatternPathsWithCaptures,
  leafPatternCompile,
  leafPatternIsComplex,
  leafPatternToString,
  CBORPattern,
  BoolPattern,
  NullPattern,
  NumberPattern,
  TextPattern,
  ByteStringPattern,
  DatePattern,
  ArrayPattern,
  MapPattern,
  KnownValuePattern,
  TaggedPattern,
  registerBoolPatternFactory,
  registerNullPatternFactory,
  registerNumberPatternFactory,
  registerTextPatternFactory,
  registerByteStringPatternFactory,
  registerDatePatternFactory,
  registerArrayPatternFactory,
  registerMapPatternFactory,
  registerKnownValuePatternFactory,
  registerTaggedPatternFactory,
  registerCBORPatternFactory,
} from "./leaf";

// Import structure patterns
import {
  type StructurePattern,
  structureLeaf,
  structureSubject,
  structurePredicate,
  structureObject,
  structureAssertions,
  structureDigest,
  structureNode,
  structureObscured,
  structureWrapped,
  structurePatternPathsWithCaptures,
  structurePatternCompile,
  structurePatternIsComplex,
  structurePatternToString,
  LeafStructurePattern,
  SubjectPattern,
  PredicatePattern,
  ObjectPattern,
  AssertionsPattern,
  DigestPattern,
  NodePattern,
  ObscuredPattern,
  WrappedPattern,
  registerLeafStructurePatternFactory,
  registerSubjectPatternFactory,
  registerPredicatePatternFactory,
  registerObjectPatternFactory,
  registerAssertionsPatternFactory,
  registerDigestPatternFactory,
  registerNodePatternFactory,
  registerObscuredPatternFactory,
  registerWrappedPatternFactory,
} from "./structure";

// Import meta patterns
import {
  type MetaPattern,
  metaAny,
  metaAnd,
  metaOr,
  metaNot,
  metaCapture,
  metaSearch,
  metaTraverse,
  metaGroup,
  metaPatternPathsWithCaptures,
  metaPatternCompile,
  metaPatternIsComplex,
  metaPatternToString,
  metaPatternCollectCaptureNames,
  AnyPattern,
  AndPattern,
  OrPattern,
  NotPattern,
  CapturePattern,
  SearchPattern,
  TraversePattern,
  GroupPattern,
  registerAnyPatternFactory,
  registerAndPatternFactory,
  registerOrPatternFactory,
  registerNotPatternFactory,
  registerCapturePatternFactory,
  registerSearchPatternFactory,
  registerTraversePatternFactory,
  registerGroupPatternFactory,
} from "./meta";

/**
 * The main pattern type used for matching envelopes.
 *
 * Corresponds to the Rust `Pattern` enum in pattern/mod.rs
 */
export type Pattern =
  | { readonly type: "Leaf"; readonly pattern: LeafPattern }
  | { readonly type: "Structure"; readonly pattern: StructurePattern }
  | { readonly type: "Meta"; readonly pattern: MetaPattern };

// Pattern factory functions
/**
 * Creates a Leaf pattern.
 */
export function patternLeaf(leaf: LeafPattern): Pattern {
  return { type: "Leaf", pattern: leaf };
}

/**
 * Creates a Structure pattern.
 */
export function patternStructure(structure: StructurePattern): Pattern {
  return { type: "Structure", pattern: structure };
}

/**
 * Creates a Meta pattern.
 */
export function patternMeta(meta: MetaPattern): Pattern {
  return { type: "Meta", pattern: meta };
}

// ============================================================================
// Pattern Matcher Implementation
// ============================================================================

/**
 * Gets paths with captures for a pattern.
 */
export function patternPathsWithCaptures(
  pattern: Pattern,
  haystack: Envelope,
): [Path[], Map<string, Path[]>] {
  switch (pattern.type) {
    case "Leaf":
      return leafPatternPathsWithCaptures(pattern.pattern, haystack);
    case "Structure":
      return structurePatternPathsWithCaptures(pattern.pattern, haystack);
    case "Meta":
      return metaPatternPathsWithCaptures(pattern.pattern, haystack);
  }
}

/**
 * Gets paths for a pattern.
 */
export function patternPaths(pattern: Pattern, haystack: Envelope): Path[] {
  return patternPathsWithCaptures(pattern, haystack)[0];
}

/**
 * Checks if a pattern matches.
 */
export function patternMatches(pattern: Pattern, haystack: Envelope): boolean {
  return patternPaths(pattern, haystack).length > 0;
}

/**
 * Checks if a pattern is complex.
 */
export function patternIsComplex(pattern: Pattern): boolean {
  switch (pattern.type) {
    case "Leaf":
      return leafPatternIsComplex(pattern.pattern);
    case "Structure":
      return structurePatternIsComplex(pattern.pattern);
    case "Meta":
      return metaPatternIsComplex(pattern.pattern);
  }
}

/**
 * Compiles a pattern to bytecode.
 */
export function patternCompile(
  pattern: Pattern,
  code: Instr[],
  literals: Pattern[],
  captures: string[],
): void {
  switch (pattern.type) {
    case "Leaf":
      leafPatternCompile(pattern.pattern, code, literals, captures);
      break;
    case "Structure":
      structurePatternCompile(pattern.pattern, code, literals, captures);
      break;
    case "Meta":
      metaPatternCompile(pattern.pattern, code, literals, captures);
      break;
  }
}

/**
 * Converts a pattern to string.
 */
export function patternToString(pattern: Pattern): string {
  switch (pattern.type) {
    case "Leaf":
      return leafPatternToString(pattern.pattern);
    case "Structure":
      return structurePatternToString(pattern.pattern);
    case "Meta":
      return metaPatternToString(pattern.pattern);
  }
}

/**
 * Collects capture names from a pattern.
 */
export function patternCollectCaptureNames(pattern: Pattern, out: string[]): void {
  if (pattern.type === "Meta") {
    metaPatternCollectCaptureNames(pattern.pattern, out);
  }
}

// ============================================================================
// Convenience Constructors - Leaf Patterns
// ============================================================================

/**
 * Creates a new Pattern that matches any CBOR value.
 */
export function anyCbor(): Pattern {
  return patternLeaf(leafCbor(CBORPattern.any()));
}

/**
 * Creates a new Pattern that matches a specific CBOR value.
 */
export function cborValue(value: CborInput): Pattern {
  return patternLeaf(leafCbor(CBORPattern.value(value)));
}

/**
 * Creates a new Pattern that matches CBOR values using dcbor-pattern expressions.
 */
export function cborPattern(pattern: DCBORPattern): Pattern {
  return patternLeaf(leafCbor(CBORPattern.pattern(pattern)));
}

/**
 * Creates a new Pattern that matches any boolean value.
 */
export function anyBool(): Pattern {
  return patternLeaf(leafBool(BoolPattern.any()));
}

/**
 * Creates a new Pattern that matches a specific boolean value.
 */
export function bool(b: boolean): Pattern {
  return patternLeaf(leafBool(BoolPattern.value(b)));
}

/**
 * Creates a new Pattern that matches any text value.
 */
export function anyText(): Pattern {
  return patternLeaf(leafText(TextPattern.any()));
}

/**
 * Creates a new Pattern that matches a specific text value.
 */
export function text(value: string): Pattern {
  return patternLeaf(leafText(TextPattern.value(value)));
}

/**
 * Creates a new Pattern that matches text values that match the given regex.
 */
export function textRegex(regex: RegExp): Pattern {
  return patternLeaf(leafText(TextPattern.regex(regex)));
}

/**
 * Creates a new Pattern that matches any Date value.
 */
export function anyDate(): Pattern {
  return patternLeaf(leafDate(DatePattern.any()));
}

/**
 * Creates a new Pattern that matches a specific Date value.
 */
export function date(d: CborDate): Pattern {
  return patternLeaf(leafDate(DatePattern.value(d)));
}

/**
 * Creates a new Pattern that matches Date values within a specified range.
 */
export function dateRange(earliest: CborDate, latest: CborDate): Pattern {
  return patternLeaf(leafDate(DatePattern.range(earliest, latest)));
}

/**
 * Creates a new Pattern that matches any number value.
 */
export function anyNumber(): Pattern {
  return patternLeaf(leafNumber(NumberPattern.any()));
}

/**
 * Creates a new Pattern that matches a specific number value.
 */
export function number(value: number): Pattern {
  return patternLeaf(leafNumber(NumberPattern.exact(value)));
}

/**
 * Creates a new Pattern that matches number values within a range.
 */
export function numberRange(min: number, max: number): Pattern {
  return patternLeaf(leafNumber(NumberPattern.range(min, max)));
}

/**
 * Creates a new Pattern that matches number values greater than the specified value.
 */
export function numberGreaterThan(value: number): Pattern {
  return patternLeaf(leafNumber(NumberPattern.greaterThan(value)));
}

/**
 * Creates a new Pattern that matches number values less than the specified value.
 */
export function numberLessThan(value: number): Pattern {
  return patternLeaf(leafNumber(NumberPattern.lessThan(value)));
}

/**
 * Creates a new Pattern that matches any byte string value.
 */
export function anyByteString(): Pattern {
  return patternLeaf(leafByteString(ByteStringPattern.any()));
}

/**
 * Creates a new Pattern that matches a specific byte string value.
 */
export function byteString(value: Uint8Array): Pattern {
  return patternLeaf(leafByteString(ByteStringPattern.value(value)));
}

/**
 * Creates a new Pattern that matches any known value.
 */
export function anyKnownValue(): Pattern {
  return patternLeaf(leafKnownValue(KnownValuePattern.any()));
}

/**
 * Creates a new Pattern that matches a specific known value.
 */
export function knownValue(value: KnownValue): Pattern {
  return patternLeaf(leafKnownValue(KnownValuePattern.value(value)));
}

/**
 * Creates a new Pattern that matches the unit known value.
 */
export function unit(): Pattern {
  return knownValue(KNOWN_VALUE_UNIT);
}

/**
 * Creates a new Pattern that matches any array.
 */
export function anyArray(): Pattern {
  return patternLeaf(leafArray(ArrayPattern.any()));
}

/**
 * Creates a new Pattern that matches any map.
 */
export function anyMap(): Pattern {
  return patternLeaf(leafMap(MapPattern.any()));
}

/**
 * Creates a new Pattern that matches null.
 */
export function nullPattern(): Pattern {
  return patternLeaf(leafNull(NullPattern.new()));
}

/**
 * Creates a new Pattern that matches any tagged value.
 */
export function anyTag(): Pattern {
  return patternLeaf(leafTag(TaggedPattern.any()));
}

/**
 * Creates a new Pattern that matches a specific tagged value.
 */
export function tagged(tag: Tag, pattern: DCBORPattern): Pattern {
  return patternLeaf(leafTag(TaggedPattern.withTag(tag, pattern)));
}

// ============================================================================
// Convenience Constructors - Structure Patterns
// ============================================================================

/**
 * Creates a new Pattern that matches leaf envelopes.
 */
export function leaf(): Pattern {
  return patternStructure(structureLeaf(LeafStructurePattern.new()));
}

/**
 * Creates a new Pattern that matches any assertion.
 */
export function anyAssertion(): Pattern {
  return patternStructure(structureAssertions(AssertionsPattern.any()));
}

/**
 * Creates a new Pattern that matches assertions with predicates matching pattern.
 */
export function assertionWithPredicate(pattern: Pattern): Pattern {
  return patternStructure(structureAssertions(AssertionsPattern.withPredicate(pattern)));
}

/**
 * Creates a new Pattern that matches assertions with objects matching pattern.
 */
export function assertionWithObject(pattern: Pattern): Pattern {
  return patternStructure(structureAssertions(AssertionsPattern.withObject(pattern)));
}

/**
 * Creates a new Pattern that matches any subject.
 */
export function anySubject(): Pattern {
  return patternStructure(structureSubject(SubjectPattern.any()));
}

/**
 * Creates a new Pattern that matches subjects matching pattern.
 */
export function subject(pattern: Pattern): Pattern {
  return patternStructure(structureSubject(SubjectPattern.pattern(pattern)));
}

/**
 * Creates a new Pattern that matches any predicate.
 */
export function anyPredicate(): Pattern {
  return patternStructure(structurePredicate(PredicatePattern.any()));
}

/**
 * Creates a new Pattern that matches predicates matching pattern.
 */
export function predicate(pattern: Pattern): Pattern {
  return patternStructure(structurePredicate(PredicatePattern.pattern(pattern)));
}

/**
 * Creates a new Pattern that matches any object.
 */
export function anyObject(): Pattern {
  return patternStructure(structureObject(ObjectPattern.any()));
}

/**
 * Creates a new Pattern that matches objects matching pattern.
 */
export function object(pattern: Pattern): Pattern {
  return patternStructure(structureObject(ObjectPattern.pattern(pattern)));
}

/**
 * Creates a new Pattern that matches a specific digest.
 */
export function digest(d: Digest): Pattern {
  return patternStructure(structureDigest(DigestPattern.digest(d)));
}

/**
 * Creates a new Pattern that matches digests with a prefix.
 */
export function digestPrefix(prefix: Uint8Array): Pattern {
  return patternStructure(structureDigest(DigestPattern.prefix(prefix)));
}

/**
 * Creates a new Pattern that matches any node.
 */
export function anyNode(): Pattern {
  return patternStructure(structureNode(NodePattern.any()));
}

/**
 * Creates a new Pattern that matches any obscured element.
 */
export function obscured(): Pattern {
  return patternStructure(structureObscured(ObscuredPattern.any()));
}

/**
 * Creates a new Pattern that matches elided elements.
 */
export function elided(): Pattern {
  return patternStructure(structureObscured(ObscuredPattern.elided()));
}

/**
 * Creates a new Pattern that matches encrypted elements.
 */
export function encrypted(): Pattern {
  return patternStructure(structureObscured(ObscuredPattern.encrypted()));
}

/**
 * Creates a new Pattern that matches compressed elements.
 */
export function compressed(): Pattern {
  return patternStructure(structureObscured(ObscuredPattern.compressed()));
}

/**
 * Creates a new Pattern that matches wrapped envelopes.
 */
export function wrapped(): Pattern {
  return patternStructure(structureWrapped(WrappedPattern.new()));
}

/**
 * Creates a new Pattern that matches wrapped envelopes and descends.
 * Named `unwrapEnvelope` to avoid conflict with Result.unwrap.
 */
export function unwrapEnvelope(): Pattern {
  return patternStructure(structureWrapped(WrappedPattern.unwrapMatching(any())));
}

/**
 * Creates a new Pattern that matches wrapped envelopes matching pattern.
 */
export function unwrapMatching(pattern: Pattern): Pattern {
  return patternStructure(structureWrapped(WrappedPattern.unwrapMatching(pattern)));
}

// ============================================================================
// Convenience Constructors - Meta Patterns
// ============================================================================

/**
 * Creates a new Pattern that matches any element.
 */
export function any(): Pattern {
  return patternMeta(metaAny(AnyPattern.new()));
}

/**
 * Creates a new Pattern that matches if all patterns match.
 */
export function and(patterns: Pattern[]): Pattern {
  return patternMeta(metaAnd(AndPattern.new(patterns)));
}

/**
 * Creates a new Pattern that matches if any pattern matches.
 */
export function or(patterns: Pattern[]): Pattern {
  return patternMeta(metaOr(OrPattern.new(patterns)));
}

/**
 * Creates a new Pattern that matches if the pattern does not match.
 */
export function notMatching(pattern: Pattern): Pattern {
  return patternMeta(metaNot(NotPattern.new(pattern)));
}

/**
 * Creates a new Pattern that captures a match with a name.
 */
export function capture(name: string, pattern: Pattern): Pattern {
  return patternMeta(metaCapture(CapturePattern.new(name, pattern)));
}

/**
 * Creates a new Pattern that searches for matches in the envelope tree.
 */
export function search(pattern: Pattern): Pattern {
  return patternMeta(metaSearch(SearchPattern.new(pattern)));
}

/**
 * Creates a new Pattern that matches a traversal order of patterns.
 */
export function traverse(patterns: Pattern[]): Pattern {
  return patternMeta(metaTraverse(TraversePattern.new(patterns)));
}

/**
 * Creates a new Pattern that matches with repetition.
 */
export function repeat(
  pattern: Pattern,
  min: number,
  max?: number,
  reluctance: Reluctance = Reluctance.Greedy,
): Pattern {
  const interval = max !== undefined ? Interval.from(min, max) : Interval.atLeast(min);
  const quantifier = new Quantifier(interval, reluctance);
  return patternMeta(metaGroup(GroupPattern.repeat(pattern, quantifier)));
}

/**
 * Creates a new Pattern for grouping.
 */
export function group(pattern: Pattern): Pattern {
  return patternMeta(metaGroup(GroupPattern.new(pattern)));
}

// ============================================================================
// Factory Registration
// ============================================================================

// Register all pattern factories to resolve circular dependencies
function registerAllFactories(): void {
  // Leaf pattern factories
  registerBoolPatternFactory((p) => patternLeaf(leafBool(p)));
  registerNullPatternFactory((p) => patternLeaf(leafNull(p)));
  registerNumberPatternFactory((p) => patternLeaf(leafNumber(p)));
  registerTextPatternFactory((p) => patternLeaf(leafText(p)));
  registerByteStringPatternFactory((p) => patternLeaf(leafByteString(p)));
  registerDatePatternFactory((p) => patternLeaf(leafDate(p)));
  registerArrayPatternFactory((p) => patternLeaf(leafArray(p)));
  registerMapPatternFactory((p) => patternLeaf(leafMap(p)));
  registerKnownValuePatternFactory((p) => patternLeaf(leafKnownValue(p)));
  registerTaggedPatternFactory((p) => patternLeaf(leafTag(p)));
  registerCBORPatternFactory((p) => patternLeaf(leafCbor(p)));

  // Structure pattern factories
  registerLeafStructurePatternFactory((p) => patternStructure(structureLeaf(p)));
  registerSubjectPatternFactory((p) => patternStructure(structureSubject(p)));
  registerPredicatePatternFactory((p) => patternStructure(structurePredicate(p)));
  registerObjectPatternFactory((p) => patternStructure(structureObject(p)));
  registerAssertionsPatternFactory((p) => patternStructure(structureAssertions(p)));
  registerDigestPatternFactory((p) => patternStructure(structureDigest(p)));
  registerNodePatternFactory((p) => patternStructure(structureNode(p)));
  registerObscuredPatternFactory((p) => patternStructure(structureObscured(p)));
  registerWrappedPatternFactory((p) => patternStructure(structureWrapped(p)));

  // Meta pattern factories
  registerAnyPatternFactory((p) => patternMeta(metaAny(p)));
  registerAndPatternFactory((p) => patternMeta(metaAnd(p)));
  registerOrPatternFactory((p) => patternMeta(metaOr(p)));
  registerNotPatternFactory((p) => patternMeta(metaNot(p)));
  registerCapturePatternFactory((p) => patternMeta(metaCapture(p)));
  registerSearchPatternFactory((p) => patternMeta(metaSearch(p)));
  registerTraversePatternFactory((p) => patternMeta(metaTraverse(p)));
  registerGroupPatternFactory((p) => patternMeta(metaGroup(p)));
}

// Register factories immediately on module load
registerAllFactories();

// Register VM pattern functions to resolve circular dependencies
import { registerVMPatternFunctions } from "./vm";
registerVMPatternFunctions(patternPathsWithCaptures, patternMatches, patternPaths);

// Register pattern match function for meta patterns
import { registerPatternMatchFn } from "./matcher";
registerPatternMatchFn(patternMatches);

// Register traverse dispatch functions to resolve circular dependencies
import { registerTraverseDispatchFunctions } from "./meta/traverse-pattern";
registerTraverseDispatchFunctions(patternPathsWithCaptures, patternCompile, patternIsComplex);
