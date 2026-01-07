/**
 * Capture behavior tests ported from test_capture_behavior.rs
 *
 * Tests for capture behavior with various pattern types including
 * variadic patterns, array patterns, and search patterns.
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  assertActualExpected,
  getPathsWithCaptures,
  formatPathsWithCapturesStr,
} from "./common";

describe("capture behavior tests", () => {
  it("test_exact_array_pattern_matching", () => {
    // Test that [@item(42)] captures all instances of 42 in an array
    const cborDataSingle = cbor([42]);
    const cborDataMultiple = cbor([42, 100, 42]);
    const cborDataNoMatch = cbor([100, 200]);
    const pattern = parse("[@item(42)]");

    // This should match: array with exactly one element that is 42
    const [pathsSingle, capturesSingle] = getPathsWithCaptures(pattern, cborDataSingle);

    // Based on existing test array_capture_tests.rs, this should match
    const expectedSingle = `@item
    [42]
        42
[42]`;

    assertActualExpected(formatPathsWithCapturesStr(pathsSingle, capturesSingle), expectedSingle);

    // Verify the capture exists and contains the single element
    const itemCapturesSingle = capturesSingle.get("item");
    expect(itemCapturesSingle).toBeDefined();
    expect(itemCapturesSingle?.length).toBe(1);

    // Test the multiple element array - this SHOULD match and capture at least one 42
    const [pathsMultiple, capturesMultiple] = getPathsWithCaptures(pattern, cborDataMultiple);

    // The pattern should match multi-element arrays and capture instances of 42
    expect(pathsMultiple.length).toBeGreaterThan(0);

    const itemCapturesMultiple = capturesMultiple.get("item");
    expect(itemCapturesMultiple).toBeDefined();
    expect(itemCapturesMultiple?.length).toBeGreaterThan(0);
    // Note: The VM may deduplicate identical values, so we don't assert an exact count

    // Test array with no matches - should not match
    const [pathsNoMatch, capturesNoMatch] = getPathsWithCaptures(pattern, cborDataNoMatch);

    expect(pathsNoMatch.length).toBe(0);
    expect(capturesNoMatch.size).toBe(0);
  });

  it("test_array_with_any_position_pattern", () => {
    // Test different approaches to match "an array of any length having the
    // number 42 in any position"
    const cborData = cbor([42, 100, 42]);

    // Use search pattern to find 42 within any array
    const pattern = parse("search(@item(42))");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // The search pattern should find matches
    expect(paths.length).toBeGreaterThan(0);

    // Should have captures for the @item
    expect(captures.has("item")).toBe(true);

    const itemCaptures = captures.get("item");
    expect(itemCaptures).toBeDefined();
    expect(itemCaptures?.length).toBeGreaterThan(0);

    // This test documents current behavior and explores syntax options
    // The `search` pattern works correctly for finding elements within arrays
    // Note: The exact number of captures may vary between implementations
    // due to deduplication behavior
  });

  it("test_variadic_array_pattern_syntax", () => {
    // Test if the proposed [(*)*, @item(42), (*)*] syntax works correctly

    // Test data: arrays that should match (contain 42)
    const arrayWith42Start = cbor([42, 100, 200]);
    const arrayWith42Middle = cbor([100, 42, 200]);
    const arrayWith42End = cbor([100, 200, 42]);

    // Test data: arrays that should NOT match (don't contain 42)
    const arrayWithout42 = cbor([100, 200, 300]);
    const arrayWithOnly100 = cbor([100]);

    // Try to parse the variadic pattern syntax WITHOUT CAPTURE
    const pattern = parse("[(*)*, 42, (*)*]");

    // Test arrays that should match
    const testCasesShouldMatch: [ReturnType<typeof cbor>, string][] = [
      [arrayWith42Start, "[42, 100, 200] (42 at start)"],
      [arrayWith42Middle, "[100, 42, 200] (42 in middle)"],
      [arrayWith42End, "[100, 200, 42] (42 at end)"],
    ];

    for (const [cborDataCase, _description] of testCasesShouldMatch) {
      const [paths] = getPathsWithCaptures(pattern, cborDataCase);
      expect(paths.length).toBeGreaterThan(0);
    }

    // Test arrays that should NOT match
    const testCasesShouldNotMatch: [ReturnType<typeof cbor>, string][] = [
      [arrayWithout42, "[100, 200, 300] (no 42)"],
      [arrayWithOnly100, "[100] (only 100)"],
    ];

    for (const [cborDataCase, _description] of testCasesShouldNotMatch) {
      const [paths] = getPathsWithCaptures(pattern, cborDataCase);
      expect(paths.length).toBe(0);
    }
  });

  it("test_debug_variadic_pattern", () => {
    // Debug test to understand what's happening with variadic patterns
    const cborData = cbor([42, 100, 200]);

    // Test different pattern variations
    const patternsToTest = [
      "[(*)*, @item(42), (*)*]",
      "[(*)*, 42, (*)*]",
      "[*, @item(42), *]",
      "[*, 42, *]",
      "[@item(42), (*)*]",
      "[(*)*, @item(42)]",
    ];

    for (const patternStr of patternsToTest) {
      const pattern = parse(patternStr);
      const [paths, captures] = getPathsWithCaptures(pattern, cborData);

      // At minimum, check that all patterns parse and run without error
      expect(Array.isArray(paths)).toBe(true);
      expect(captures instanceof Map).toBe(true);
    }
  });

  it("test_variadic_pattern_value_discrimination", () => {
    // Test if [(*)*, 42, (*)*] properly discriminates between values

    const arrayWith42 = cbor([100, 42, 200]);
    const arrayWith100Middle = cbor([42, 100, 200]);
    const arrayWithout42 = cbor([100, 200, 300]);

    // Pattern that should match arrays containing 42
    const pattern42 = parse("[(*)*, 42, (*)*]");

    // Pattern that should match arrays containing 100
    const pattern100 = parse("[(*)*, 100, (*)*]");

    // Test array with 42 in middle - should match
    let [paths] = getPathsWithCaptures(pattern42, arrayWith42);
    expect(paths.length).toBeGreaterThan(0);

    // Test array with 100 in middle - should NOT match 42 (but 42 is at start, so should match)
    [paths] = getPathsWithCaptures(pattern42, arrayWith100Middle);
    expect(paths.length).toBeGreaterThan(0);

    // Test array without 42 - should NOT match
    [paths] = getPathsWithCaptures(pattern42, arrayWithout42);
    expect(paths.length).toBe(0);

    // Test array with 100 in middle - should match 100
    [paths] = getPathsWithCaptures(pattern100, arrayWith100Middle);
    expect(paths.length).toBeGreaterThan(0);

    // Test array with 42 in middle - 100 is at start, so should match
    [paths] = getPathsWithCaptures(pattern100, arrayWith42);
    expect(paths.length).toBeGreaterThan(0);

    // More specific test: array where the target number is ONLY in middle
    const array42OnlyMiddle = cbor([1, 42, 3]);
    const array100OnlyMiddle = cbor([1, 100, 3]);

    [paths] = getPathsWithCaptures(pattern42, array42OnlyMiddle);
    expect(paths.length).toBeGreaterThan(0);

    [paths] = getPathsWithCaptures(pattern42, array100OnlyMiddle);
    expect(paths.length).toBe(0);
  });

  it("test_variadic_capture_should_work", () => {
    // This test demonstrates the bug: variadic patterns with captures
    // should work but don't

    const cborData = cbor([1, 42, 3]);
    const pattern = parse("[(*)*, @item(42), (*)*]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // The pattern SHOULD match and capture the 42
    expect(paths.length).toBeGreaterThan(0);

    // The capture SHOULD exist and contain the 42
    expect(captures.has("item")).toBe(true);

    const itemCaptures = captures.get("item");
    expect(itemCaptures).toBeDefined();
    expect(itemCaptures?.length).toBe(1);

    // Test the formatted output
    const expected = `@item
    [1, 42, 3]
        42
[1, 42, 3]`;

    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
  });

  it("test_variadic_capture_multiple_matches", () => {
    // Test variadic capture with multiple matches

    const cborData = cbor([42, 100, 42]);
    const pattern = parse("[(*)*, @item(42), (*)*]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Should match the array
    expect(paths.length).toBeGreaterThan(0);

    // Should capture the 42(s)
    expect(captures.has("item")).toBe(true);

    const itemCaptures = captures.get("item");
    expect(itemCaptures).toBeDefined();
    expect(itemCaptures?.length).toBeGreaterThan(0);
    // Should capture at least one 42 (exact behavior may vary based on implementation)
  });

  it("test_variadic_capture_bug_specific_case", () => {
    // This should now work after the fix

    const cborData = cbor([42, 100, 200]);
    const pattern = parse("[(*)*, @item(42), (*)*]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // This SHOULD work and now does work
    expect(paths.length).toBeGreaterThan(0);

    expect(captures.has("item")).toBe(true);

    // Test the formatted output
    const expected = `@item
    [42, 100, 200]
        42
[42, 100, 200]`;

    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
  });

  it("test_variadic_capture_position_bug", () => {
    // Test different positions to isolate the bug

    const testCases: [string, string][] = [
      ["[42]", "single element"],
      ["[42, 100]", "42 at start"],
      ["[100, 42]", "42 at end"],
      ["[42, 100, 200]", "42 at start with more elements"],
      ["[100, 42, 200]", "42 in middle"],
      ["[100, 200, 42]", "42 at end with more elements"],
    ];

    for (const [cborStr, _description] of testCases) {
      // Parse CBOR from the array literal
      const values = JSON.parse(cborStr);
      const cborData = cbor(values);
      const pattern = parse("[(*)*, @item(42), (*)*]");

      const [paths, captures] = getPathsWithCaptures(pattern, cborData);

      // All of these should work
      expect(paths.length).toBeGreaterThan(0);
      expect(captures.has("item")).toBe(true);
    }
  });
});
