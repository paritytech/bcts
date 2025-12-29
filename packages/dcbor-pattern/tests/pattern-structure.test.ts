/**
 * Structure pattern tests ported from pattern_tests_structure.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  matches,
  display,
  getPaths,
  formatPathsStr,
  assertActualExpected,
} from "./common";

describe("structure pattern tests", () => {
  it("test_array_pattern_any", () => {
    const pattern = parse("array");

    // Should match empty array
    let paths = getPaths(pattern, cbor([]));
    assertActualExpected(formatPathsStr(paths), "[]");

    // Should match non-empty array
    paths = getPaths(pattern, cbor([1, 2, 3]));
    assertActualExpected(formatPathsStr(paths), "[1, 2, 3]");

    // Should not match non-array
    expect(matches(pattern, cbor("not an array"))).toBe(false);
  });

  it("test_array_pattern_single_any_element", () => {
    const pattern = parse("[*]");

    // Should match array with one element
    let paths = getPaths(pattern, cbor([42]));
    assertActualExpected(formatPathsStr(paths), "[42]");

    // Should match array with one element of different type
    paths = getPaths(pattern, cbor(["hello"]));
    assertActualExpected(formatPathsStr(paths), '["hello"]');

    // Should NOT match empty array
    expect(matches(pattern, cbor([]))).toBe(false);

    // Should NOT match array with multiple elements
    expect(matches(pattern, cbor([1, 2, 3]))).toBe(false);

    // Should not match non-array
    expect(matches(pattern, cbor("not an array"))).toBe(false);
  });

  it("test_array_pattern_with_length", () => {
    const pattern = parse("[{2}]");

    // Should match array with length 2
    const paths = getPaths(pattern, cbor([1, 2]));
    assertActualExpected(formatPathsStr(paths), "[1, 2]");

    // Should not match array with different length
    expect(matches(pattern, cbor([1, 2, 3]))).toBe(false);

    // Should not match non-array
    expect(matches(pattern, cbor("not an array"))).toBe(false);
  });

  it("test_array_pattern_with_elements", () => {
    const pattern = parse("[42]");

    // Should match array with exactly one element: 42
    const paths = getPaths(pattern, cbor([42]));
    assertActualExpected(formatPathsStr(paths), "[42]");

    // Should NOT match array containing 42 among other elements (unified syntax)
    expect(matches(pattern, cbor([1, 42, 3]))).toBe(false);

    // Should not match array without 42
    expect(matches(pattern, cbor([1, 2, 3]))).toBe(false);

    // Should not match empty array
    expect(matches(pattern, cbor([]))).toBe(false);
  });

  it("test_map_pattern_any", () => {
    const pattern = parse("map");

    // Should match empty map
    let paths = getPaths(pattern, cbor({}));
    assertActualExpected(formatPathsStr(paths), "{}");

    // Should match non-empty map
    paths = getPaths(pattern, cbor({ key: "value" }));
    assertActualExpected(formatPathsStr(paths), '{"key": "value"}');

    // Should not match non-map
    expect(matches(pattern, cbor("not a map"))).toBe(false);
  });

  it("test_tagged_pattern_any", () => {
    const pattern = parse("tagged");

    // Should match any tagged value (using the parse syntax for tagged values)
    // Note: We need a way to create tagged values - this test may need adjustment
    // depending on how tagged values are created in the TS implementation

    // Should not match non-tagged values
    expect(matches(pattern, cbor("not tagged"))).toBe(false);
    expect(matches(pattern, cbor(42))).toBe(false);
    expect(matches(pattern, cbor([1, 2, 3]))).toBe(false);
  });

  it("test_structure_pattern_display", () => {
    // Array patterns
    expect(display(parse("[*]"))).toBe("[*]");
    expect(display(parse("[{5}]"))).toBe("[{5}]");

    // Map patterns
    expect(display(parse("map"))).toBe("map");
    expect(display(parse("{{3}}"))).toBe("{{3}}");

    // Tagged patterns
    expect(display(parse("tagged"))).toBe("tagged");
  });

  it("test_array_sequence_pattern", () => {
    // Test sequence of specific values
    const pattern = parse("[1, 2, 3]");

    // Should match exact sequence
    const paths = getPaths(pattern, cbor([1, 2, 3]));
    assertActualExpected(formatPathsStr(paths), "[1, 2, 3]");

    // Should not match different order
    expect(matches(pattern, cbor([3, 2, 1]))).toBe(false);

    // Should not match subset
    expect(matches(pattern, cbor([1, 2]))).toBe(false);

    // Should not match superset
    expect(matches(pattern, cbor([1, 2, 3, 4]))).toBe(false);
  });

  it("test_map_constraint_pattern", () => {
    // Test map with specific key-value constraints
    const pattern = parse('{"name": "Alice"}');

    // Should match map with the constraint
    const paths = getPaths(pattern, cbor({ name: "Alice" }));
    assertActualExpected(formatPathsStr(paths), '{"name": "Alice"}');

    // Should not match map with different value
    expect(matches(pattern, cbor({ name: "Bob" }))).toBe(false);

    // Should not match map without the key
    expect(matches(pattern, cbor({ other: "Alice" }))).toBe(false);
  });

  it("test_map_with_type_constraints", () => {
    // Test map with type constraints
    const pattern = parse('{"id": number, "name": text}');

    // Should match map with correct types
    expect(matches(pattern, cbor({ id: 123, name: "Alice" }))).toBe(true);

    // Should not match with wrong types
    expect(matches(pattern, cbor({ id: "123", name: "Alice" }))).toBe(false);
    expect(matches(pattern, cbor({ id: 123, name: 456 }))).toBe(false);
  });

  it("test_nested_structure_patterns", () => {
    // Test nested arrays
    const nestedArrayPattern = parse("[[number]]");
    expect(matches(nestedArrayPattern, cbor([[42]]))).toBe(true);
    expect(matches(nestedArrayPattern, cbor([[1, 2, 3]]))).toBe(false); // inner array must have exactly one number
    expect(matches(nestedArrayPattern, cbor([42]))).toBe(false); // not nested

    // Test nested maps
    const nestedMapPattern = parse('{"data": {"value": number}}');
    expect(matches(nestedMapPattern, cbor({ data: { value: 42 } }))).toBe(true);
    expect(matches(nestedMapPattern, cbor({ data: { value: "text" } }))).toBe(false);
  });

  it("test_array_with_any_elements", () => {
    // Test array with wildcard element pattern
    const pattern = parse("[(*)*]"); // zero or more of anything

    // Should match empty array
    expect(matches(pattern, cbor([]))).toBe(true);

    // Should match arrays with any elements
    expect(matches(pattern, cbor([1]))).toBe(true);
    expect(matches(pattern, cbor([1, 2, 3]))).toBe(true);
    expect(matches(pattern, cbor(["a", "b"]))).toBe(true);
    expect(matches(pattern, cbor([1, "mixed", true]))).toBe(true);
  });

  it("test_map_with_wildcard_values", () => {
    // Test map with wildcard value pattern
    const pattern = parse('{"key": *}');

    // Should match map with any value for "key"
    expect(matches(pattern, cbor({ key: 42 }))).toBe(true);
    expect(matches(pattern, cbor({ key: "text" }))).toBe(true);
    expect(matches(pattern, cbor({ key: [1, 2, 3] }))).toBe(true);

    // Should not match without the key
    expect(matches(pattern, cbor({ other: 42 }))).toBe(false);
  });
});
