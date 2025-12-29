/**
 * Matcher interface for dCBOR pattern matching.
 *
 * @module pattern/matcher
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../format";
import type { Instr, Program } from "./vm";
import type { Pattern } from "./index";

/**
 * Result of pattern matching with captures.
 */
export interface MatchWithCaptures {
  readonly paths: Path[];
  readonly captures: Map<string, Path[]>;
}

/**
 * Interface for objects that can match against CBOR values.
 *
 * This interface defines the contract for all pattern types in the system.
 * Implementations handle matching, path collection, and VM bytecode compilation.
 */
export interface Matcher {
  /**
   * Return all matching paths along with any named captures.
   *
   * @param haystack - The CBOR value to match against
   * @returns A tuple of paths and captures map
   */
  pathsWithCaptures(haystack: Cbor): MatchWithCaptures;

  /**
   * Return only the matching paths, discarding any captures.
   *
   * @param haystack - The CBOR value to match against
   * @returns Array of paths to matching elements
   */
  paths(haystack: Cbor): Path[];

  /**
   * Check if the pattern matches the given CBOR value.
   *
   * @param haystack - The CBOR value to test
   * @returns true if the pattern matches
   */
  matches(haystack: Cbor): boolean;

  /**
   * Compile this pattern into VM bytecode.
   *
   * @param code - The instruction array to append to
   * @param literals - The literals array to append to
   * @param captures - The capture names array
   */
  compile(code: Instr[], literals: Pattern[], captures: string[]): void;

  /**
   * Recursively collect all capture names from this pattern.
   *
   * @param names - The array to collect names into
   */
  collectCaptureNames(names: string[]): void;

  /**
   * Check if the pattern display is "complex" (requires parentheses).
   *
   * @returns true if the pattern requires grouping
   */
  isComplex(): boolean;

  /**
   * Format the pattern as a string.
   */
  toString(): string;
}

/**
 * Default implementation helpers for Matcher.
 */
export const MatcherDefaults = {
  /**
   * Default paths implementation using pathsWithCaptures.
   */
  paths(matcher: Pick<Matcher, "pathsWithCaptures">, haystack: Cbor): Path[] {
    return matcher.pathsWithCaptures(haystack).paths;
  },

  /**
   * Default matches implementation using paths.
   */
  matches(matcher: Pick<Matcher, "paths">, haystack: Cbor): boolean {
    return matcher.paths(haystack).length > 0;
  },

  /**
   * Default pathsWithCaptures throws not implemented.
   */
  pathsWithCaptures(_haystack: Cbor): MatchWithCaptures {
    throw new Error("pathsWithCaptures not implemented");
  },

  /**
   * Default compile throws not implemented.
   */
  compile(_code: Instr[], _literals: Pattern[], _captures: string[]): void {
    throw new Error("compile not implemented");
  },

  /**
   * Default collectCaptureNames does nothing.
   */
  collectCaptureNames(_names: string[]): void {
    // Default implementation does nothing
  },

  /**
   * Default isComplex returns false.
   */
  isComplex(): boolean {
    return false;
  },
};

/**
 * Compiles a pattern into a VM program.
 *
 * @param pattern - The pattern to compile
 * @returns A compiled program ready for execution
 */
export const compilePattern = (pattern: Pattern): Program => {
  const code: Instr[] = [];
  const literals: Pattern[] = [];
  const captureNames: string[] = [];

  // Collect all capture names first
  collectPatternCaptureNames(pattern, captureNames);

  // Compile the pattern
  compilePatternToCode(pattern, code, literals, captureNames);

  // Add final Accept instruction
  code.push({ type: "Accept" });

  return {
    code,
    literals,
    captureNames,
  };
};

/**
 * Recursively collects capture names from a pattern.
 */
const collectPatternCaptureNames = (
  pattern: Pattern,
  names: string[],
): void => {
  switch (pattern.kind) {
    case "Value":
      // Value patterns don't have captures
      break;
    case "Structure":
      // Structure patterns may have element patterns with captures
      // This will be implemented based on the structure pattern type
      break;
    case "Meta":
      collectMetaPatternCaptureNames(pattern.pattern, names);
      break;
  }
};

/**
 * Collects capture names from meta patterns.
 */
const collectMetaPatternCaptureNames = (
  pattern: import("./meta").MetaPattern,
  names: string[],
): void => {
  switch (pattern.type) {
    case "Capture":
      if (!names.includes(pattern.pattern.name)) {
        names.push(pattern.pattern.name);
      }
      collectPatternCaptureNames(pattern.pattern.pattern, names);
      break;
    case "And":
      for (const p of pattern.pattern.patterns) {
        collectPatternCaptureNames(p, names);
      }
      break;
    case "Or":
      for (const p of pattern.pattern.patterns) {
        collectPatternCaptureNames(p, names);
      }
      break;
    case "Not":
      collectPatternCaptureNames(pattern.pattern.pattern, names);
      break;
    case "Repeat":
      collectPatternCaptureNames(pattern.pattern.pattern, names);
      break;
    case "Search":
      collectPatternCaptureNames(pattern.pattern.pattern, names);
      break;
    case "Sequence":
      for (const p of pattern.pattern.patterns) {
        collectPatternCaptureNames(p, names);
      }
      break;
    case "Any":
      // Any patterns don't have captures
      break;
  }
};

/**
 * Compiles a pattern to VM bytecode.
 */
const compilePatternToCode = (
  pattern: Pattern,
  code: Instr[],
  literals: Pattern[],
  captureNames: string[],
): void => {
  switch (pattern.kind) {
    case "Value":
      // Value patterns use MatchPredicate
      literals.push(pattern);
      code.push({ type: "MatchPredicate", literalIndex: literals.length - 1 });
      break;
    case "Structure":
      // Structure patterns use MatchStructure
      literals.push(pattern);
      code.push({ type: "MatchStructure", literalIndex: literals.length - 1 });
      break;
    case "Meta":
      compileMetaPattern(pattern.pattern, code, literals, captureNames);
      break;
  }
};

/**
 * Compiles meta patterns to VM bytecode.
 */
const compileMetaPattern = (
  pattern: import("./meta").MetaPattern,
  code: Instr[],
  literals: Pattern[],
  captureNames: string[],
): void => {
  switch (pattern.type) {
    case "Any":
      // Any matches everything - compile as predicate
      literals.push({ kind: "Meta", pattern });
      code.push({ type: "MatchPredicate", literalIndex: literals.length - 1 });
      break;

    case "And": {
      // All patterns must match
      for (const p of pattern.pattern.patterns) {
        compilePatternToCode(p, code, literals, captureNames);
      }
      break;
    }

    case "Or": {
      // Use splits to try each alternative
      const patterns = pattern.pattern.patterns;
      if (patterns.length === 0) break;
      if (patterns.length === 1) {
        compilePatternToCode(patterns[0], code, literals, captureNames);
        break;
      }

      // Create split chain for alternatives
      const jumpAddrs: number[] = [];
      for (let i = 0; i < patterns.length - 1; i++) {
        const splitAddr = code.length;
        code.push({ type: "Split", a: 0, b: 0 }); // Placeholder

        // First alternative starts right after split
        (code[splitAddr] as { type: "Split"; a: number; b: number }).a =
          code.length;
        compilePatternToCode(patterns[i], code, literals, captureNames);
        jumpAddrs.push(code.length);
        code.push({ type: "Jump", address: 0 }); // Jump to end, placeholder

        // Second alternative address
        (code[splitAddr] as { type: "Split"; a: number; b: number }).b =
          code.length;
      }
      // Last pattern
      compilePatternToCode(
        patterns[patterns.length - 1],
        code,
        literals,
        captureNames,
      );

      // Fix up jump addresses
      const endAddr = code.length;
      for (const addr of jumpAddrs) {
        (code[addr] as { type: "Jump"; address: number }).address = endAddr;
      }
      break;
    }

    case "Not": {
      // Store the inner pattern and use NotMatch instruction
      literals.push(pattern.pattern.pattern);
      code.push({ type: "NotMatch", patternIndex: literals.length - 1 });
      break;
    }

    case "Repeat": {
      literals.push(pattern.pattern.pattern);
      code.push({
        type: "Repeat",
        patternIndex: literals.length - 1,
        quantifier: pattern.pattern.quantifier,
      });
      break;
    }

    case "Capture": {
      const captureIndex = captureNames.indexOf(pattern.pattern.name);
      code.push({ type: "CaptureStart", captureIndex });
      compilePatternToCode(
        pattern.pattern.pattern,
        code,
        literals,
        captureNames,
      );
      code.push({ type: "CaptureEnd", captureIndex });
      break;
    }

    case "Search": {
      // Build capture map for the search pattern
      const captureMap: Array<[string, number]> = [];
      const innerNames: string[] = [];
      collectPatternCaptureNames(pattern.pattern.pattern, innerNames);
      for (const name of innerNames) {
        const idx = captureNames.indexOf(name);
        if (idx >= 0) {
          captureMap.push([name, idx]);
        }
      }

      literals.push(pattern.pattern.pattern);
      code.push({
        type: "Search",
        patternIndex: literals.length - 1,
        captureMap,
      });
      break;
    }

    case "Sequence": {
      const patterns = pattern.pattern.patterns;
      if (patterns.length === 0) break;

      compilePatternToCode(patterns[0], code, literals, captureNames);

      for (let i = 1; i < patterns.length; i++) {
        code.push({ type: "ExtendSequence" });
        compilePatternToCode(patterns[i], code, literals, captureNames);
        code.push({ type: "CombineSequence" });
      }
      break;
    }
  }
};
