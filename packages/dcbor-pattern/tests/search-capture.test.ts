/**
 * Search capture tests ported from search_capture_tests.rs
 */

import { describe, it, expect } from "vitest";
import { cbor, parse, getPathsWithCaptures, getPaths } from "./common";

describe("search capture tests", () => {
  it("test_search_capture_basic", () => {
    const pattern = parse("search(@found(42))");
    const cborData = cbor([1, [2, 42], 3]);

    // Test regular paths first
    const paths = getPaths(pattern, cborData);
    expect(paths.length).toBeGreaterThan(0);

    // Test with captures
    const [capturePaths, captures] = getPathsWithCaptures(pattern, cborData);
    expect(capturePaths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(1);
    expect(captures.has("found")).toBe(true);

    // Verify capture has the right number of paths
    const capturedPaths = captures.get("found");
    expect(capturedPaths).toBeDefined();
    expect(capturedPaths?.length).toBe(1);
    // Each captured path should have 3 elements: root array, inner array, 42
    expect(capturedPaths?.[0].length).toBe(3);
  });

  it("test_search_capture_multiple_matches", () => {
    const pattern = parse("search(@target(42))");
    const cborData = cbor([42, [2, 42], { key: 42 }]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Should find multiple matches
    expect(paths.length).toBe(3);
    expect(captures.size).toBe(1);
    expect(captures.has("target")).toBe(true);

    const capturedPaths = captures.get("target");
    expect(capturedPaths).toBeDefined();
    expect(capturedPaths?.length).toBe(3);
  });

  it("test_search_capture_nested_structure", () => {
    const pattern = parse(`search(@deep("target"))`);
    const cborData = cbor({ level1: { level2: { level3: "target" } } });

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(1);
    expect(captures.has("deep")).toBe(true);

    // The capture should have a deep path
    const capturedPaths = captures.get("deep");
    expect(capturedPaths).toBeDefined();
    expect(capturedPaths?.length).toBe(1);
    expect(capturedPaths?.[0].length).toBe(4); // root, level1, level2, target
  });

  it("test_search_capture_with_array_elements", () => {
    const pattern = parse("search(@item(array))");
    const cborData = cbor([1, [2, 3], { arrays: [4, 5, 6] }]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Should find the root array, the [2,3] array, and the [4,5,6] array
    expect(paths.length).toBe(3);
    expect(captures.size).toBe(1);
    expect(captures.has("item")).toBe(true);
  });

  it("test_search_capture_no_match", () => {
    const pattern = parse("search(@notfound(999))");
    const cborData = cbor([1, [2, 42], 3]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Should have no paths or captures when no match is found
    expect(paths.length).toBe(0);
    expect(captures.size).toBe(0);
  });

  it("test_search_capture_complex_pattern", () => {
    const pattern = parse(`search(@found({"id": @id_value(number)}))`);
    const cborData = cbor({
      users: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    });

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Should find both user objects
    expect(paths.length).toBe(2);
    expect(captures.has("found")).toBe(true);
    expect(captures.has("id_value")).toBe(true);

    const foundCaptures = captures.get("found");
    expect(foundCaptures).toBeDefined();
    expect(foundCaptures?.length).toBe(2);

    const idCaptures = captures.get("id_value");
    expect(idCaptures).toBeDefined();
    expect(idCaptures?.length).toBe(2);
  });

  it("test_search_capture_api_consistency", () => {
    const pattern = parse("search(@item(42))");
    const cborData = cbor([1, 42, 3]);

    // Test that calling pathsWithCaptures gives consistent results
    const [apiPaths, apiCaptures] = getPathsWithCaptures(pattern, cborData);
    const [directPaths, directCaptures] = getPathsWithCaptures(pattern, cborData);

    expect(apiPaths.length).toBe(directPaths.length);
    expect(apiCaptures.size).toBe(directCaptures.size);
  });
});
