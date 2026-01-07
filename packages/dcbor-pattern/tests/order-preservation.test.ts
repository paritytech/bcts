/**
 * Order preservation tests ported from test_order_preservation.rs
 */

import { describe, it, expect } from "vitest";
import { cbor, parse, getPathsWithCaptures } from "./common";

describe("order preservation tests", () => {
  it("test_path_order_deterministic", () => {
    const cborData = cbor([42, 100, 200]);
    const pattern = parse("[@item(number)]");

    // Run the same pattern multiple times to check for deterministic ordering
    const allResults: [
      ReturnType<typeof getPathsWithCaptures>[0],
      ReturnType<typeof getPathsWithCaptures>[1],
    ][] = [];

    for (let i = 0; i < 10; i++) {
      const [paths, captures] = getPathsWithCaptures(pattern, cborData);
      allResults.push([paths, captures]);
    }

    // All results should be identical
    const [firstPaths, firstCaptures] = allResults[0];
    for (let i = 1; i < allResults.length; i++) {
      const [paths, captures] = allResults[i];
      expect(paths).toEqual(firstPaths);
      expect(captures).toEqual(firstCaptures);
    }

    // Verify we have exactly one path (not duplicates)
    expect(firstPaths.length).toBe(1);

    // Verify we have the expected number of captures
    const itemCaptures = firstCaptures.get("item");
    expect(itemCaptures).toBeDefined();
    expect(itemCaptures?.length).toBe(3);
  });

  it("test_capture_order_deterministic", () => {
    const cborData = cbor([1, 2, 3, 1, 2, 3]); // Intentional duplicates
    const pattern = parse("[@num(number)]");

    // Run multiple times to check deterministic ordering
    const allResults: [
      ReturnType<typeof getPathsWithCaptures>[0],
      ReturnType<typeof getPathsWithCaptures>[1],
    ][] = [];

    for (let i = 0; i < 10; i++) {
      const [paths, captures] = getPathsWithCaptures(pattern, cborData);
      allResults.push([paths, captures]);
    }

    // All results should be identical
    const [firstPaths, firstCaptures] = allResults[0];
    for (let i = 1; i < allResults.length; i++) {
      const [paths, captures] = allResults[i];
      expect(paths).toEqual(firstPaths);
      expect(captures).toEqual(firstCaptures);
    }

    // Check that captures are deduplicated properly
    const numCaptures = firstCaptures.get("num");
    expect(numCaptures).toBeDefined();
    // We should have captured paths for values 1, 2, 3 appearing twice each
    // Since we have duplicate values 1, 2, 3 appearing twice, but they create identical
    // paths, we should only see 3 unique captured paths, not 6
    expect(numCaptures?.length).toBe(3);
  });
});
