/**
 * Map capture tests ported from map_capture_tests.rs
 */

import { describe, it, expect } from "vitest";
import { compilePattern } from "../src";
import {
  cbor,
  parse,
  assertActualExpected,
  matches,
  getPathsWithCaptures,
  formatPathsStr,
  getPaths,
} from "./common";

describe("map capture tests", () => {
  it("test_map_capture_key_value", () => {
    const pattern = parse(`{"name": "Alice"}`);
    const cborData = cbor({ name: "Alice" });

    // Test regular paths first
    const paths = getPaths(pattern, cborData);
    const expectedPaths = `{"name": "Alice"}`;
    assertActualExpected(formatPathsStr(paths), expectedPaths);
  });

  it("test_map_capture_value_only", () => {
    const pattern = parse(`{"status": @status(text)}`);
    const cborData = cbor({ status: "active" });

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Validate we have paths and captures
    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(1);
    expect(captures.has("status")).toBe(true);
  });

  it("test_map_capture_with_any_pattern", () => {
    const pattern = parse(`{@any_key(text): @any_value(*)}`);
    const cborData = cbor({ hello: [1, 2, 3] });

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Validate that we have paths and captures
    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(2);
    expect(captures.has("any_key")).toBe(true);
    expect(captures.has("any_value")).toBe(true);
  });

  it("test_map_capture_nested", () => {
    const pattern = parse(`{"data": @inner(array)}`);
    const cborData = cbor({ data: [42, 100] });

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // Validate that we have paths and captures
    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(1);
    expect(captures.has("inner")).toBe(true);
  });

  it("test_map_capture_multiple_entries", () => {
    const pattern = parse(
      `{@name_key("name"): @name_val(text), @age_key("age"): @age_val(number)}`,
    );
    const cborData = cbor({ name: "Bob", age: 30 });

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    // We should have paths and four named captures
    expect(paths.length).toBeGreaterThan(0);
    expect(captures.size).toBe(4);
    expect(captures.has("name_key")).toBe(true);
    expect(captures.has("name_val")).toBe(true);
    expect(captures.has("age_key")).toBe(true);
    expect(captures.has("age_val")).toBe(true);
  });

  it("test_map_capture_collect_names", () => {
    const pattern = parse(
      `{@key1(text): @val1(number), @key2(text): @val2(text)}`,
    );

    // Compile and read out the captureNames the compiler discovered.
    // Mirrors Rust `pattern.collect_capture_names`.
    const program = compilePattern(pattern);
    const captureNames = program.captureNames;

    expect(captureNames.length).toBe(4);
    expect(captureNames).toContain("key1");
    expect(captureNames).toContain("val1");
    expect(captureNames).toContain("key2");
    expect(captureNames).toContain("val2");
  });

  it("test_map_capture_non_matching", () => {
    const pattern = parse(`{"name": "Alice"}`);
    const cborData = cbor({ name: "Bob" }); // Different value

    // Should not match
    expect(matches(pattern, cborData)).toBe(false);

    const paths = getPaths(pattern, cborData);
    expect(paths.length).toBe(0);
  });
});
