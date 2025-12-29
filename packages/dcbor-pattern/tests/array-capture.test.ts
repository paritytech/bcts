/**
 * Array capture tests ported from array_capture_tests.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  assertActualExpected,
  matches,
  getPathsWithCaptures,
  formatPathsWithCapturesStr,
  formatPathsStr,
  getPaths,
} from "./common";

describe("array capture tests", () => {
  it("test_array_capture_basic", () => {
    const pattern = parse("[@item(42)]");
    const cborData = cbor([42]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Validate formatted output with captures
    const expectedOutput = `@item
    [42]
        42
[42]`;
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expectedOutput);

    // Also test normal paths for comparison
    const normalPaths = getPaths(pattern, cborData);
    const expectedPaths = "[42]";
    assertActualExpected(formatPathsStr(normalPaths), expectedPaths);
  });

  it("test_array_capture_multiple_items", () => {
    const pattern = parse("[@first(number), @second(number)]");
    const cborData = cbor([42, 100]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Validate formatted output with captures
    const expectedOutput = `@first
    [42, 100]
        42
@second
    [42, 100]
        100
[42, 100]`;
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expectedOutput);
  });

  it("test_array_capture_with_any_pattern", () => {
    const pattern = parse("[@any_item(*)]");
    const cborData = cbor(["hello"]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Validate that we have paths and captures
    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(1);
    expect(captures.has("any_item")).toBe(true);

    // The capture should have a path showing the array and element
    const capturePaths = captures.get("any_item");
    expect(capturePaths).toBeDefined();
    expect(capturePaths?.length).toBe(1);
    expect(capturePaths?.[0].length).toBe(2); // [array, element]
  });

  it("test_array_nested_capture", () => {
    const pattern = parse("@arr([@item(number)])");
    const cborData = cbor([99]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Validate formatted output with nested captures
    const expectedOutput = `@arr
    [99]
@item
    [99]
        99
[99]`;
    assertActualExpected(formatPathsWithCapturesStr(paths, captures), expectedOutput);
  });

  it("test_array_capture_non_matching", () => {
    const pattern = parse("[@item(42)]");
    const cborData = cbor([100]); // Different number

    // Should not match
    expect(matches(pattern, cborData)).toBe(false);

    const paths = getPaths(pattern, cborData);
    expect(paths.length).toBe(0);
  });
});
