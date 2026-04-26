/**
 * Performance tests ported from test_performance.rs
 *
 * Performance bounds in this file are deliberately ~5x the Rust ceilings to
 * keep the suite stable across CI hardware. We still want hard upper bounds
 * (rather than no checks) to catch genuine regressions.
 */

import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { cbor, parse, matches, getPaths, formatPathsStr, assertActualExpected } from "./common";

describe("performance tests", () => {
  it("test_deeply_nested_performance", () => {
    // Test performance with very deeply nested structures
    const patternStart = performance.now();

    // Create a deeply nested pattern: 5 levels deep
    const pattern = parse(`tagged(100, {"a": {"b": {"c": {"d": [42]}}}})`);
    const patternCreationTime = performance.now() - patternStart;

    // Create matching deeply nested data
    const data = cbor({
      tag: 100,
      value: cbor({ a: { b: { c: { d: [42] } } } }),
    });

    // Test matching performance
    const matchStart = performance.now();
    const result = matches(pattern, data);
    const matchTime = performance.now() - matchStart;

    expect(result).toBe(true); // Should match deeply nested structure

    // Test paths generation and validate result
    const pathsStart = performance.now();
    const paths = getPaths(pattern, data);
    const pathsTime = performance.now() - pathsStart;

    const expected = `100({"a": {"b": {"c": {"d": [42]}}}})`;
    assertActualExpected(formatPathsStr(paths), expected);

    // Performance should be reasonable (5x Rust's 10ms bound)
    expect(patternCreationTime).toBeLessThan(50);
    expect(matchTime).toBeLessThan(50);
    expect(pathsTime).toBeLessThan(50);
  });

  it("test_complex_repeat_pattern_performance", () => {
    const patternStart = performance.now();

    // Complex pattern with multiple repeat patterns
    const pattern = parse(`[({"id": number})*, (*)*, ({"name": text})*]`);
    const patternCreationTime = performance.now() - patternStart;

    // Create test data with many elements to test backtracking performance
    const data = cbor([{ id: 1 }, { id: 2 }, 42, "test", true, { name: "Alice" }, { name: "Bob" }]);

    const matchStart = performance.now();
    const result = matches(pattern, data);
    const matchTime = performance.now() - matchStart;

    expect(result).toBe(true); // Should match complex pattern with multiple repeats

    // Test paths generation and validate result
    const pathsStart = performance.now();
    const paths = getPaths(pattern, data);
    const pathsTime = performance.now() - pathsStart;

    const expected = `[{"id": 1}, {"id": 2}, 42, "test", true, {"name": "Alice"}, {"name": "Bob"}]`;
    assertActualExpected(formatPathsStr(paths), expected);

    // Performance should be reasonable even with backtracking (5x Rust's 10ms bound)
    expect(patternCreationTime).toBeLessThan(50);
    expect(matchTime).toBeLessThan(50);
    expect(pathsTime).toBeLessThan(50);
  });

  it("test_large_array_with_search_performance", () => {
    const patternStart = performance.now();

    // Search pattern that needs to traverse a large structure
    const pattern = parse(`search("needle")`);
    const patternCreationTime = performance.now() - patternStart;

    // Create a large array with the needle somewhere in the middle
    const largeData = cbor([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      { a: 1 },
      { b: 2 },
      { c: 3 },
      { d: 4 },
      { e: 5 },
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
      "needle",
      { final: true },
    ]);

    const matchStart = performance.now();
    const result = matches(pattern, largeData);
    const matchTime = performance.now() - matchStart;

    expect(result).toBe(true); // Should find needle in large structure

    // Test paths generation and validate result
    const pathsStart = performance.now();
    const paths = getPaths(pattern, largeData);
    const pathsTime = performance.now() - pathsStart;

    const expected = `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, {"a": 1}, {"b": 2}, {"c": 3}, {"d": 4}, {"e": 5}, [1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], "needle", {"final": true}]
    "needle"`;
    assertActualExpected(formatPathsStr(paths), expected);

    // Search performance should scale reasonably (5x Rust's 10ms / 20ms bounds)
    expect(patternCreationTime).toBeLessThan(50);
    expect(matchTime).toBeLessThan(100);
    expect(pathsTime).toBeLessThan(50);
  });

  it("test_complex_or_pattern_performance", () => {
    const patternStart = performance.now();

    // Complex OR pattern with many alternatives
    const pattern = parse(
      `tagged(1, number) | tagged(2, text) | tagged(3, [number]) | tagged(4, {text: *}) | tagged(5, bool) | {"type": "user"} | {"type": "admin"} | ["start"] | [number, text, bool]`,
    );
    const patternCreationTime = performance.now() - patternStart;

    // Test with a structure that matches one of the later alternatives
    const data = cbor([42, "test", true]);

    const matchStart = performance.now();
    const result = matches(pattern, data);
    const matchTime = performance.now() - matchStart;

    expect(result).toBe(true); // Should match complex OR pattern

    // Test paths generation and validate result
    const pathsStart = performance.now();
    const paths = getPaths(pattern, data);
    const pathsTime = performance.now() - pathsStart;

    const expected = `[42, "test", true]`;
    assertActualExpected(formatPathsStr(paths), expected);

    // OR pattern performance should be reasonable (5x Rust's 10ms bound)
    expect(patternCreationTime).toBeLessThan(50);
    expect(matchTime).toBeLessThan(50);
    expect(pathsTime).toBeLessThan(50);
  });

  it("test_vm_instruction_optimization", () => {
    // Test that complex patterns compile to efficient VM instructions
    const pattern = parse(`tagged(100, [({"key": number})*, "separator", ({"value": text})*])`);

    // Test multiple matches to ensure VM optimization is effective
    const testCases: ReturnType<typeof cbor>[] = [
      cbor({ tag: 100, value: cbor(["separator"]) }),
      cbor({ tag: 100, value: cbor([{ key: 1 }, "separator"]) }),
      cbor({ tag: 100, value: cbor(["separator", { value: "test" }]) }),
      cbor({
        tag: 100,
        value: cbor([{ key: 1 }, { key: 2 }, "separator", { value: "a" }, { value: "b" }]),
      }),
    ];

    const totalStart = performance.now();
    for (const testCase of testCases) {
      const result = matches(pattern, testCase);
      expect(result).toBe(true);

      // Also validate paths for correctness
      const paths = getPaths(pattern, testCase);
      expect(paths.length).toBeGreaterThan(0);
    }
    const totalTime = performance.now() - totalStart;

    // Multiple complex matches should complete quickly (5x Rust's 20ms bound)
    expect(totalTime).toBeLessThan(100);
  });

  it("test_edge_case_performance", () => {
    // Test performance with edge cases that could cause exponential behavior

    // Simpler pattern with repeats that should match the test data
    const pattern = parse(`[(*)*]`);

    // Large array that the pattern should definitely match
    const largeArray = cbor([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      true,
      false,
      null,
      "more",
      "strings",
      "here",
    ]);

    const start = performance.now();
    const result = matches(pattern, largeArray);
    const elapsed = performance.now() - start;

    expect(result).toBe(true); // Should match large array with * repeat pattern

    // Test paths generation and validate result
    const pathsStart = performance.now();
    const paths = getPaths(pattern, largeArray);
    const pathsTime = performance.now() - pathsStart;

    const expected = `["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, true, false, null, "more", "strings", "here"]`;
    assertActualExpected(formatPathsStr(paths), expected);

    // Should not exhibit exponential behavior (5x Rust's 50ms bound)
    expect(elapsed).toBeLessThan(250);
    expect(pathsTime).toBeLessThan(250);
  });
});
