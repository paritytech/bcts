/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * **DP1 — byte-identical parity with Rust** for ArrayPattern::Elements with
 * non-Sequence captures. Cross-checked output against Rust's
 * `format_paths_with_captures` for the exact same input via
 * `bc-dcbor-pattern-rust/examples/dp1_test.rs`.
 *
 * Each `expected` block below is the literal stdout of the Rust example.
 */

import { describe, it } from "vitest";
import { cbor, parse, getPathsWithCaptures, formatPathsWithCapturesStr } from "./common";
import { assertActualExpected } from "./common";

describe("DP1 — ArrayPattern Elements non-sequence captures (Rust parity)", () => {
  it("[@item(number)] against [1, 2, 3]", () => {
    const pattern = parse("[@item(number)]");
    const cborData = cbor([1, 2, 3]);
    const [paths, captures] = getPathsWithCaptures(pattern, cborData);
    const output = formatPathsWithCapturesStr(paths, captures);
    const expected = `@item
    [1, 2, 3]
        3
    [1, 2, 3]
        2
    [1, 2, 3]
        1
[1, 2, 3]`;
    assertActualExpected(output, expected);
  });

  it('[@item(number)] against [1, "x", 3] (mixed)', () => {
    const pattern = parse("[@item(number)]");
    const cborData = cbor([1, "x", 3]);
    const [paths, captures] = getPathsWithCaptures(pattern, cborData);
    const output = formatPathsWithCapturesStr(paths, captures);
    const expected = `@item
    [1, "x", 3]
        3
    [1, "x", 3]
        1
[1, "x", 3]`;
    assertActualExpected(output, expected);
  });

  it("[@a(number) | @b(text)] (Or with two captures)", () => {
    const pattern = parse("[@a(number) | @b(text)]");
    const cborData = cbor([1, "x", 3, "y"]);
    const [paths, captures] = getPathsWithCaptures(pattern, cborData);
    const output = formatPathsWithCapturesStr(paths, captures);
    const expected = `@a
    [1, "x", 3, "y"]
        3
    [1, "x", 3, "y"]
        1
@b
    [1, "x", 3, "y"]
        "y"
    [1, "x", 3, "y"]
        "x"
[1, "x", 3, "y"]`;
    assertActualExpected(output, expected);
  });

  it("[@a((number)*)] (capture wrapping a Repeat)", () => {
    const pattern = parse("[@a((number)*)]");
    const cborData = cbor([1, 2, 3]);
    const [paths, captures] = getPathsWithCaptures(pattern, cborData);
    const output = formatPathsWithCapturesStr(paths, captures);
    const expected = `@a
    [1, 2, 3]
        3
    [1, 2, 3]
        2
    [1, 2, 3]
        1
[1, 2, 3]`;
    assertActualExpected(output, expected);
  });
});
