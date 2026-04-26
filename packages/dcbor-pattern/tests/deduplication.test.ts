/**
 * Deduplication tests ported from deduplication_tests.rs
 */

import { describe, it } from "vitest";
import {
  cbor,
  parse,
  assertActualExpected,
  getPathsWithCaptures,
  formatPathsWithCapturesStr,
} from "./common";

describe("deduplication tests", () => {
  it("test_no_duplicate_paths_simple_array", () => {
    // Test case that previously showed duplicate paths
    const cborData = cbor([42, 100, 200]);
    const pattern = parse("[@item(number)]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    const actual = formatPathsWithCapturesStr(paths, captures);
    // **DP1 — Rust parity**: VM PushAxis processes children via
    // stack-pop (reverse-source) order. Mirrors Rust
    // `deduplication_tests.rs::test_no_duplicate_paths_simple_array`.
    const expected = `@item
    [42, 100, 200]
        200
    [42, 100, 200]
        100
    [42, 100, 200]
        42
[42, 100, 200]`;
    assertActualExpected(actual, expected);
  });

  it("test_no_duplicate_paths_nested_array", () => {
    const nestedCbor = cbor([[42], [100]]);
    const nestedPattern = parse("[@outer_item([@inner_item(number)])]");

    const [nestedPaths, nestedCaptures] = getPathsWithCaptures(nestedPattern, nestedCbor);

    const actual = formatPathsWithCapturesStr(nestedPaths, nestedCaptures);
    // **DP1 — Rust parity** (reverse-source order from VM PushAxis).
    // Mirrors Rust
    // `deduplication_tests.rs::test_no_duplicate_paths_nested_array`.
    const expected = `@inner_item
    [[42], [100]]
        [100]
            100
    [[42], [100]]
        [42]
            42
@outer_item
    [[42], [100]]
        [100]
    [[42], [100]]
        [42]
[[42], [100]]`;
    assertActualExpected(actual, expected);
  });

  it("test_no_duplicate_paths_with_repeated_values", () => {
    // Test with actual duplicate values that should create identical paths
    const cborData = cbor([42, 100, 42]);
    const pattern = parse("[@specific(42)]");

    const [paths, captures] = getPathsWithCaptures(pattern, cborData);

    const actual = formatPathsWithCapturesStr(paths, captures);
    const expected = `@specific
    [42, 100, 42]
        42
[42, 100, 42]`;
    assertActualExpected(actual, expected);
  });
});
