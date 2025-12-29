/**
 * Comprehensive variadic sequence tests ported from test_comprehensive_variadic_sequences.rs
 *
 * Tests for quantifiers (*, +, ?, {n}, {n,m}) and their variants (greedy, lazy, possessive)
 */

import { describe, it, expect } from "vitest";
import { cbor, parse, matches } from "./common";

describe("comprehensive variadic sequences", () => {
  describe("Phase 2.1: Basic Quantifiers (Greedy)", () => {
    it("test_zero_or_more_greedy", () => {
      // Pattern: [(*)*] should match arrays of any length
      const pattern = parse("[(*)*]");

      // Empty array should match (zero repetitions)
      expect(matches(pattern, cbor([]))).toBe(true);

      // Single element should match (one repetition)
      expect(matches(pattern, cbor([42]))).toBe(true);

      // Multiple elements should match (multiple repetitions)
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
    });

    it("test_one_or_more_greedy", () => {
      // Pattern: [(*)+] should match arrays with at least one element
      const pattern = parse("[(*)+]");

      // Empty array should NOT match (requires at least one)
      expect(matches(pattern, cbor([]))).toBe(false);

      // Single element should match (one repetition)
      expect(matches(pattern, cbor([42]))).toBe(true);

      // Multiple elements should match (multiple repetitions)
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
    });

    it("test_zero_or_one_greedy", () => {
      // Pattern: [(*)?] should match arrays with zero or one element
      const pattern = parse("[(*)?]");

      // Empty array should match (zero repetitions)
      expect(matches(pattern, cbor([]))).toBe(true);

      // Single element should match (one repetition)
      expect(matches(pattern, cbor([42]))).toBe(true);

      // Multiple elements should NOT match (exceeds one repetition)
      expect(matches(pattern, cbor([1, 2]))).toBe(false);
    });

    it("test_exactly_once_default", () => {
      // Pattern: [(*)] should match arrays with exactly one element
      const pattern = parse("[(*)]");

      // Empty array should NOT match (requires exactly one)
      expect(matches(pattern, cbor([]))).toBe(false);

      // Single element should match (exactly one repetition)
      expect(matches(pattern, cbor([42]))).toBe(true);

      // Multiple elements should NOT match (exceeds one repetition)
      expect(matches(pattern, cbor([1, 2]))).toBe(false);
    });
  });

  describe("Phase 2.2: Lazy Quantifiers", () => {
    it("test_zero_or_more_lazy", () => {
      // Pattern: [(*)*?] should match arrays but prefer fewer repetitions
      const pattern = parse("[(*)*?]");

      // All arrays should match
      expect(matches(pattern, cbor([]))).toBe(true);
      expect(matches(pattern, cbor([42]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
    });

    it("test_one_or_more_lazy", () => {
      // Pattern: [(*)+?] should match arrays with at least one element
      const pattern = parse("[(*)+?]");

      // Empty array should NOT match (requires at least one)
      expect(matches(pattern, cbor([]))).toBe(false);

      // Non-empty arrays should match
      expect(matches(pattern, cbor([42]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
    });

    it("test_zero_or_one_lazy", () => {
      // Pattern: [(*)??] should match zero or one element
      const pattern = parse("[(*)??]");

      // Should match empty and single, not multiple
      expect(matches(pattern, cbor([]))).toBe(true);
      expect(matches(pattern, cbor([42]))).toBe(true);
      expect(matches(pattern, cbor([1, 2]))).toBe(false);
    });
  });

  describe("Phase 2.3: Possessive Quantifiers", () => {
    it("test_zero_or_more_possessive", () => {
      // Pattern: [(*)*+] should match arrays, no backtracking allowed
      const pattern = parse("[(*)*+]");

      // Should match all arrays (same as greedy for simple cases)
      expect(matches(pattern, cbor([]))).toBe(true);
      expect(matches(pattern, cbor([42]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
    });

    it("test_one_or_more_possessive", () => {
      // Pattern: [(*)++] should match non-empty arrays
      const pattern = parse("[(*)++]");

      // Empty should not match, others should
      expect(matches(pattern, cbor([]))).toBe(false);
      expect(matches(pattern, cbor([42]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
    });

    it("test_zero_or_one_possessive", () => {
      // Pattern: [(*)?+] should match zero or one element
      const pattern = parse("[(*)?+]");

      // Should match zero or one, not multiple
      expect(matches(pattern, cbor([]))).toBe(true);
      expect(matches(pattern, cbor([42]))).toBe(true);
      expect(matches(pattern, cbor([1, 2]))).toBe(false);
    });
  });

  describe("Phase 2.4: Interval Quantifiers", () => {
    it("test_exact_count_interval", () => {
      // Pattern: [(*){3}] should match arrays with exactly 3 elements
      const pattern = parse("[(*){3}]");

      // Only exactly 3 elements should match
      expect(matches(pattern, cbor([]))).toBe(false);
      expect(matches(pattern, cbor([1, 2]))).toBe(false);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3, 4]))).toBe(false);
    });

    it("test_range_interval", () => {
      // Pattern: [(*){2,4}] should match arrays with 2-4 elements
      const pattern = parse("[(*){2,4}]");

      // Only 2-4 elements should match
      expect(matches(pattern, cbor([1]))).toBe(false);
      expect(matches(pattern, cbor([1, 2]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3, 4]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3, 4, 5]))).toBe(false);
    });

    it("test_minimum_interval", () => {
      // Pattern: [(*){2,}] should match arrays with at least 2 elements
      const pattern = parse("[(*){2,}]");

      // At least 2 elements should match
      expect(matches(pattern, cbor([1]))).toBe(false);
      expect(matches(pattern, cbor([1, 2]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3, 4, 5]))).toBe(true);
    });

    it("test_maximum_interval", () => {
      // Pattern: [(*){0,3}] should match arrays with at most 3 elements
      const pattern = parse("[(*){0,3}]");

      // At most 3 elements should match
      expect(matches(pattern, cbor([]))).toBe(true);
      expect(matches(pattern, cbor([1, 2]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3, 4]))).toBe(false);
    });
  });

  describe("Phase 2.5: Complex Scenarios", () => {
    it("test_quantifiers_with_captures", () => {
      // Test: [(number)*, @item(text)]
      // Should match arrays with zero or more numbers followed by text
      const pattern = parse("[(number)*, @item(text)]");

      // Numbers then text should match
      expect(matches(pattern, cbor([1, 2, "hello"]))).toBe(true);

      // Only text should match (zero numbers, one text)
      expect(matches(pattern, cbor(["hello"]))).toBe(true);

      // Only numbers should NOT match (missing required text)
      expect(matches(pattern, cbor([1, 2]))).toBe(false);

      // Test another pattern: [@first(number), (*)*]
      const firstCapturePattern = parse("[@first(number), (*)*]");

      // Multi-element array should match
      expect(matches(firstCapturePattern, cbor([42, "text", true]))).toBe(true);
    });

    it("test_multiple_quantifiers_in_pattern", () => {
      // Pattern: [(number)*, (text)+] should match arrays with zero+ numbers
      // followed by one+ texts
      const pattern = parse("[(number)*, (text)+]");

      // Numbers then texts should match
      expect(matches(pattern, cbor([1, 2, "a", "b"]))).toBe(true);

      // Only texts should match (zero numbers, one+ texts)
      expect(matches(pattern, cbor(["a", "b"]))).toBe(true);

      // Only numbers should NOT match (missing required texts)
      expect(matches(pattern, cbor([1, 2]))).toBe(false);

      // Empty should NOT match (missing required texts)
      expect(matches(pattern, cbor([]))).toBe(false);
    });
  });

  describe("Type-specific pattern matching", () => {
    it("test_number_repeat_matching", () => {
      // Pattern: [(number)*] should match arrays containing only numbers
      const pattern = parse("[(number)*]");

      expect(matches(pattern, cbor([]))).toBe(true);
      expect(matches(pattern, cbor([1]))).toBe(true);
      expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
      expect(matches(pattern, cbor(["hello"]))).toBe(false);
      expect(matches(pattern, cbor([1, "hello"]))).toBe(false);
    });

    it("test_text_repeat_matching", () => {
      // Pattern: [(text)+] should match arrays containing at least one text
      const pattern = parse("[(text)+]");

      expect(matches(pattern, cbor([]))).toBe(false);
      expect(matches(pattern, cbor(["hello"]))).toBe(true);
      expect(matches(pattern, cbor(["hello", "world"]))).toBe(true);
      expect(matches(pattern, cbor([1]))).toBe(false);
      expect(matches(pattern, cbor(["hello", 1]))).toBe(false);
    });

    it("test_mixed_sequence_patterns", () => {
      // Pattern: [number, text, bool] should match specific sequence
      const pattern = parse("[number, text, bool]");

      expect(matches(pattern, cbor([42, "hello", true]))).toBe(true);
      expect(matches(pattern, cbor([1, "world", false]))).toBe(true);
      expect(matches(pattern, cbor(["hello", 42, true]))).toBe(false);
      expect(matches(pattern, cbor([42, "hello"]))).toBe(false);
      expect(matches(pattern, cbor([42, "hello", true, "extra"]))).toBe(false);
    });
  });
});
