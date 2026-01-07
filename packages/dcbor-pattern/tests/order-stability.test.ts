/**
 * Order stability tests ported from test_order_stability.rs
 *
 * These tests verify that pattern matching produces deterministic, stable
 * ordering of paths and captures across multiple runs.
 */

import { describe, it, expect } from "vitest";
import { cbor, parse, getPathsWithCaptures } from "./common";

describe("order stability tests", () => {
  it("test_deterministic_order_with_multiple_paths", () => {
    // Create a scenario that would generate multiple paths in a predictable
    // order
    const cborData = cbor([[1], [2], [3], [1]]);
    const pattern = parse("[@outer([@inner(number)])]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Record the exact order we get
    const firstRunPaths = [...paths];
    const firstRunCaptures = new Map(captures);

    // Run the same pattern many times and verify we always get the same
    // order
    for (let i = 0; i < 100; i++) {
      const [testPaths, testCaptures] = getPathsWithCaptures(pattern, cborData);

      expect(testPaths).toEqual(firstRunPaths);
      expect(testCaptures).toEqual(firstRunCaptures);
    }

    // Additionally verify the structure makes sense
    expect(paths.length).toBe(1);

    const outerCaptures = captures.get("outer");
    if (outerCaptures) {
      // Should have [1], [2], [3] captured (deduplicated, [1] appears
      // twice but creates same path)
      expect(outerCaptures.length).toBe(3);
    }

    const innerCaptures = captures.get("inner");
    if (innerCaptures) {
      // Should have 1, 2, 3 captured (deduplicated)
      expect(innerCaptures.length).toBe(3);
    }
  });

  it("test_order_preserved_across_hash_boundaries", () => {
    // Test with values that are likely to hash differently
    const cborData = cbor([1, 1000000, 2, 1000000, 3]);
    const pattern = parse("[@item(number)]");

    const [firstRunPaths, firstRunCaptures] = getPathsWithCaptures(pattern, cborData);

    // Verify deterministic behavior across many runs
    for (let i = 0; i < 50; i++) {
      const [testPaths, testCaptures] = getPathsWithCaptures(pattern, cborData);

      expect(testPaths).toEqual(firstRunPaths);
      expect(testCaptures).toEqual(firstRunCaptures);
    }

    // Verify we get the expected deduplication
    const itemCaptures = firstRunCaptures.get("item");
    if (itemCaptures) {
      // Should capture: 1, 1000000, 2, 3 (in order of first appearance,
      // duplicates removed)
      expect(itemCaptures.length).toBe(4);
    }
  });
});
