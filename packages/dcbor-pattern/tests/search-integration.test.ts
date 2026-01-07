/**
 * Search integration tests ported from test_search_integration.rs
 */

import { describe, it, expect } from "vitest";
import { cbor, parse, getPathsWithCaptures } from "./common";

describe("search integration tests", () => {
  it("test_search_with_partial_array_capture", () => {
    // Test the exact patterns from the user's examples
    const cbor1 = cbor([1, 2, 3]);
    const cbor2 = cbor([1]);

    // This is the pattern that was failing: search([@a(*), @rest((*)*)])
    const patternStr = "search([@a(*), @rest((*)*)])";
    const pattern = parse(patternStr);

    // Test case 1: [1, 2, 3]
    const [_paths1, captures1] = getPathsWithCaptures(pattern, cbor1);

    // Should have captures for @a and @rest
    expect(captures1.size).toBeGreaterThan(0);
    expect(captures1.has("a")).toBe(true);
    expect(captures1.has("rest")).toBe(true);

    // Test case 2: [1]
    const [_paths2, captures2] = getPathsWithCaptures(pattern, cbor2);

    // Should have captures for @a and @rest
    expect(captures2.size).toBeGreaterThan(0);
    expect(captures2.has("a")).toBe(true);
    // @rest should capture empty array, so it might or might not be in the
    // captures map depending on implementation
  });
});
