/**
 * Array detailed tests ported from array_detailed_tests.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  assertActualExpected,
  getPathsWithCaptures,
  formatPathsWithCapturesStr,
  formatPathsStr,
  getPaths,
} from "./common";

describe("array detailed tests", () => {
  it("test_array_pattern_paths_with_captures", () => {
    // Parse the inner capture pattern directly
    const innerPattern = parse("[@item(42)]");
    const cborData = cbor([42]);

    // Test the inner pattern directly on the array
    const [innerPaths, innerCaptures] = getPathsWithCaptures(innerPattern, cborData);

    const expectedInner = `@item
    [42]
        42
[42]`;
    assertActualExpected(formatPathsWithCapturesStr(innerPaths, innerCaptures), expectedInner);

    // Test the inner pattern on the array element directly
    const element = cbor(42);
    const elementPattern = parse("@item(42)");
    const [elementPaths, elementCaptures] = getPathsWithCaptures(elementPattern, element);

    const expectedElement = `@item
    42
42`;
    assertActualExpected(formatPathsWithCapturesStr(elementPaths, elementCaptures), expectedElement);

    // Test what happens when we call paths() on the inner pattern with the array
    const patternPaths = getPaths(innerPattern, cborData);
    const expectedPathsOnly = "[42]";
    assertActualExpected(formatPathsStr(patternPaths), expectedPathsOnly);
  });

  it("test_array_element_traversal", () => {
    const cborData = cbor([42]);

    const arr = cborData.asArray();
    expect(arr).toBeDefined();
    if (!arr) return;
    expect(arr.length).toBe(1);

    for (const element of arr) {
      const pattern = parse("@item(42)");
      const [paths, captures] = getPathsWithCaptures(pattern, element);

      const expected = `@item
    42
42`;
      assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
    }
  });

  it("test_array_pattern_with_multiple_elements", () => {
    const cborData = cbor([42, 100, 200]);
    const pattern = parse("[@item(number)]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // TypeScript implementation iterates array elements in forward order
    const expected = `@item
    [42, 100, 200]
        42
    [42, 100, 200]
        100
    [42, 100, 200]
        200
[42, 100, 200]`;
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
  });

  it("test_array_pattern_nested_structure", () => {
    const cborData = cbor([[42], [100]]);
    const pattern = parse("[@outer_item([@inner_item(number)])]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // TypeScript implementation formats nested captures differently
    // The outer_item capture includes paths to the nested arrays
    const expected = `@outer_item
    [[42], [100]]
        [42]
    [[42], [100]]
        [100]
[[42], [100]]`;
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
  });

  it("test_array_pattern_specific_value_matching", () => {
    const cborData = cbor([42, 100, 42]);
    const pattern = parse("[@specific(42)]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    const expected = `@specific
    [42, 100, 42]
        42
[42, 100, 42]`;
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
  });

  it("test_array_pattern_no_match", () => {
    const cborData = cbor([100, 200]);
    const pattern = parse("[@item(42)]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    const expected = "";
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
  });

  it("test_array_pattern_mixed_types", () => {
    const cborData = cbor([42, "hello", true, [1, 2]]);
    const pattern = parse("[@any_item(*)]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // TypeScript implementation iterates array elements in forward order
    // and formats paths differently for wildcard matches
    const expected = `@any_item
    [42, "hello", true, [1, 2]]
        42
    [42, "hello", true, [1, 2]]
        "hello"
    [42, "hello", true, [1, 2]]
        true
    [42, "hello", true, [1, 2]]
        [1, 2]
[42, "hello", true, [1, 2]]`;
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expected);
  });
});
