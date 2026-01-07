/**
 * Complex array parsing tests ported from test_complex_array_parsing.rs
 *
 * Tests for complex array pattern parsing and matching with repeating elements.
 */

import { describe, it, expect } from "vitest";
import { cbor, parse, matches } from "./common";
import type { CborInput } from "@bcts/dcbor";

describe("complex array parsing", () => {
  describe("test_complex_array_pattern_text_parsing", () => {
    it("should parse and match complex array pattern with 42 in various positions", () => {
      // Test if complex array pattern parsing works from text
      const patternText = "[(*)*, 42, (*)*]";
      const pattern = parse(patternText);

      // Test matching
      const testCases: [CborInput[], string, boolean][] = [
        [[42], "Just 42", true],
        [[1, 42], "42 at end", true],
        [[42, 1], "42 at start", true],
        [[1, 42, 3], "42 in middle", true],
        [[1, 2, 3], "No 42", false],
        [[], "Empty array", false],
      ];

      for (const [value, description, expectedMatch] of testCases) {
        const cborValue = cbor(value);
        const result = matches(pattern, cborValue);
        expect(
          result,
          `Pattern matching for ${JSON.stringify(value)} (${description}) should be ${expectedMatch}`,
        ).toBe(expectedMatch);
      }
    });
  });

  describe("test_various_repeat_quantifiers_in_arrays", () => {
    it("should handle various repeat quantifiers correctly", () => {
      const testPatterns: [string, string, CborInput[], boolean][] = [
        ["[(*)+]", "One or more *", [1], true],
        ["[(*)+]", "One or more * empty", [], false],
        ["[(*)?]", "Zero or one *", [], true],
        ["[(*)?]", "Zero or one * single", [1], true],
        ["[(*)?]", "Zero or one * multiple", [1, 2], false],
        ["[(number)*]", "Zero or more numbers", [], true],
        ["[(number)*]", "Zero or more numbers with nums", [1, 2, 3], true],
        ["[(number)*]", "Zero or more numbers with text", ["hello"], false],
      ];

      for (const [patternText, description, value, expectedMatch] of testPatterns) {
        const pattern = parse(patternText);
        const cborValue = cbor(value);
        const result = matches(pattern, cborValue);
        expect(
          result,
          `Pattern '${patternText}' for ${JSON.stringify(value)} (${description}) should be ${expectedMatch}`,
        ).toBe(expectedMatch);
      }
    });
  });

  describe("test_nested_array_patterns_with_repeats", () => {
    it("should handle nested patterns with complex repeats", () => {
      // Test nested patterns with complex repeats
      const patternText = "[[(number)*], (*)*]";
      const pattern = parse(patternText);

      const testCases: [CborInput[], string, boolean][] = [
        [[[1, 2, 3]], "Single number array", true],
        [[[1, 2, 3], 42], "Number array followed by number", true],
        [[[1, 2, 3], "hello"], "Number array followed by text", true],
        [[[], 42], "Empty array followed by number", true],
        [[["hello"], 42], "Text array followed by number", false], // First element has text
      ];

      for (const [value, description, expectedMatch] of testCases) {
        const cborValue = cbor(value);
        const result = matches(pattern, cborValue);
        expect(
          result,
          `Nested pattern for ${JSON.stringify(value)} (${description}) should be ${expectedMatch}`,
        ).toBe(expectedMatch);
      }
    });
  });

  describe("test_simple_array_patterns_still_work", () => {
    it("should ensure simple patterns still work after our changes", () => {
      const testPatterns: [string, CborInput[], boolean][] = [
        ["[*]", [], false], // [*] now means single element, not any array
        ["[*]", [1], true], // [*] matches single element arrays
        ["[*]", [1, 2, 3], false], // [*] doesn't match multi-element arrays
        ["array", [], true], // array keyword matches any array
        ["array", [1, 2, 3], true], // array keyword matches any array
        ["[{3}]", [1, 2, 3], true],
        ["[{3}]", [1, 2], false],
        ["[number]", [42], true],
        ["[number]", [42, 43], false], // Single element only
        ["[text]", ["hello"], true],
      ];

      for (const [patternText, value, expectedMatch] of testPatterns) {
        const pattern = parse(patternText);
        const cborValue = cbor(value);
        const result = matches(pattern, cborValue);
        expect(
          result,
          `Simple pattern '${patternText}' for ${JSON.stringify(value)} should be ${expectedMatch}`,
        ).toBe(expectedMatch);
      }
    });
  });
});
