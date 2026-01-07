/**
 * Partial array capture tests ported from test_partial_array_capture.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  getPathsWithCaptures,
  formatPathsWithCapturesStr,
} from "./common";

describe("partial array capture tests", () => {
  it("test_debug_array_pattern_directly", () => {
    // Test the array pattern directly to isolate the issue
    const pattern = parse("[@a(*), @rest((*)*)]");
    const cborData = cbor([1, 2, 3]);

    console.log("Testing pattern:", pattern);

    // Test paths() method
    // In TypeScript, we access the pattern structure through the discriminated union
    if (pattern.kind === "Structure" && pattern.pattern.type === "Array") {
      // Note: In TypeScript, we use the higher-level API
      // The direct paths methods would be accessed through the pattern functions
      const [pathsWithCaps, captures] = getPathsWithCaptures(pattern, cborData);
      console.log(
        "Direct ArrayPattern::paths_with_captures result:",
        pathsWithCaps
      );
      console.log("Direct ArrayPattern captures:", captures);
    }

    // Test the full pattern
    const [pathsWithCaps, captures] = getPathsWithCaptures(pattern, cborData);
    console.log("Full pattern paths_with_captures:", pathsWithCaps);
    console.log("Full pattern captures:", captures);
  });

  it("test_desired_partial_array_capture_behavior", () => {
    // Test the desired behavior once implemented

    // Test case 1: [1, 2, 3] with [@a(*), @rest((*)*)]
    const pattern = parse("search([@a(*), @rest((*)*)])");
    const cborData = cbor([1, 2, 3]);
    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Expected output according to user:
    // @a
    //     [1, 2, 3]
    //         1
    // @rest
    //     [1, 2, 3]
    //         [2, 3]
    // [1, 2, 3]

    // For now, let's just ensure it doesn't crash and prints what it does
    const output = formatPathsWithCapturesStr(paths, captures);
    console.log("Test case 1 output:\n" + output);

    // Verify we have paths (the pattern should match)
    expect(paths.length).toBeGreaterThan(0);

    // Test case 2: [1] with [@a(*), @rest((*)*)]
    const cborData2 = cbor([1]);
    const [paths2, captures2] = getPathsWithCaptures(pattern, cborData2);

    // Expected output according to user:
    // @a
    //     [1]
    //         1
    // @rest
    //     []
    // [1]

    const output2 = formatPathsWithCapturesStr(paths2, captures2);
    console.log("Test case 2 output:\n" + output2);

    // Verify we have paths (the pattern should match)
    expect(paths2.length).toBeGreaterThan(0);
  });
});
