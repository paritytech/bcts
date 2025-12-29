/**
 * Capture detailed tests ported from capture_detailed_tests.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  assertActualExpected,
  getPathsWithCaptures,
  formatPathsStr,
  getPaths,
} from "./common";

describe("capture detailed tests", () => {
  it("test_simple_pattern_without_capture", () => {
    const pattern = parse("42");
    const cborData = cbor(42);

    const paths = getPaths(pattern, cborData);
    const expected = "42";
    assertActualExpected(formatPathsStr(paths), expected);
  });

  it("test_simple_pattern_with_capture", () => {
    const pattern = parse("@num(42)");
    const cborData = cbor(42);

    // Test normal paths
    const paths = getPaths(pattern, cborData);
    const expectedPaths = "42";
    assertActualExpected(formatPathsStr(paths), expectedPaths);

    // Test paths with captures
    const [vmPaths, captures] = getPathsWithCaptures(pattern, cborData);
    expect(vmPaths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(1);
    expect(captures.has("num")).toBe(true);
  });

  it("test_capture_with_array_pattern", () => {
    const pattern = parse("@arr([42])");
    const cborData = cbor([42]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(1);
    expect(captures.has("arr")).toBe(true);

    // The capture should contain the array
    const arrCaptures = captures.get("arr");
    expect(arrCaptures).toBeDefined();
    expect(arrCaptures?.length).toBe(1);
  });

  it("test_capture_with_nested_pattern", () => {
    const pattern = parse("@outer([@inner(42)])");
    const cborData = cbor([42]);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(2);
    expect(captures.has("outer")).toBe(true);
    expect(captures.has("inner")).toBe(true);

    // The outer capture should contain the array
    const outerCaptures = captures.get("outer");
    expect(outerCaptures).toBeDefined();
    expect(outerCaptures?.length).toBe(1);

    // The inner capture should contain the element
    const innerCaptures = captures.get("inner");
    expect(innerCaptures).toBeDefined();
    expect(innerCaptures?.length).toBe(1);
  });

  it("test_multiple_captures_same_value", () => {
    const pattern = parse("@a(@b(42))");
    const cborData = cbor(42);

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(2);
    expect(captures.has("a")).toBe(true);
    expect(captures.has("b")).toBe(true);
  });

  it("test_capture_with_or_pattern", () => {
    const pattern = parse("@val(42 | 100)");
    const cborData42 = cbor(42);
    const cborData100 = cbor(100);

    // Test with 42
    const [paths42, captures42] = getPathsWithCaptures(pattern, cborData42);
    expect(paths42.length).toBeGreaterThan(0);
    expect(captures42.has("val")).toBe(true);

    // Test with 100
    const [paths100, captures100] = getPathsWithCaptures(pattern, cborData100);
    expect(paths100.length).toBeGreaterThan(0);
    expect(captures100.has("val")).toBe(true);
  });

  it("test_capture_non_matching", () => {
    const pattern = parse("@num(42)");
    const cborData = cbor(100); // Different value

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Should not match
    expect(paths.length).toBe(0);
    expect(captures.size).toBe(0);
  });
});
