/**
 * @bcts/envelope-pattern — `cbor` pattern paths through CBOR structures
 *
 * Port of `bc-envelope-pattern-rust/tests/test_dcbor_paths.rs`.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { parseDcborItem } from "@bcts/dcbor-parse";
import { formatPaths, parse, patternPaths } from "../src";

describe("cbor pattern dcbor paths (test_dcbor_paths.rs)", () => {
  it("returns extended paths for all numbers in nested map+array", () => {
    const parsed = parseDcborItem('{"numbers": [1, 2, 3], "nested": {"value": 42}}');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(4);

    const expected = [
      `4bd40828 LEAF {"nested": {"value": 42}, "numbers": [1, 2, 3]}`,
      `    563fb650 LEAF {"value": 42}`,
      `        7f83f7bd LEAF 42`,
      `4bd40828 LEAF {"nested": {"value": 42}, "numbers": [1, 2, 3]}`,
      `    4abc3113 LEAF [1, 2, 3]`,
      `        4bf5122f LEAF 1`,
      `4bd40828 LEAF {"nested": {"value": 42}, "numbers": [1, 2, 3]}`,
      `    4abc3113 LEAF [1, 2, 3]`,
      `        dbc1b4c9 LEAF 2`,
      `4bd40828 LEAF {"nested": {"value": 42}, "numbers": [1, 2, 3]}`,
      `    4abc3113 LEAF [1, 2, 3]`,
      `        084fed08 LEAF 3`,
    ].join("\n");
    expect(formatPaths(paths)).toBe(expected);
  });

  it("simple `cbor(/number/)` matches a single 42", () => {
    const envelope = Envelope.new(42);
    const r = parse("cbor(/number/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(1);
    expect(formatPaths(paths)).toBe("7f83f7bd LEAF 42");
  });

  it('`cbor(/search(text)/)` finds "hello" in [1, "hello", true]', () => {
    const parsed = parseDcborItem('[1, "hello", true]');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(text)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(1);
    const expected = [`4cd61f73 LEAF [1, "hello", true]`, `    cb835593 LEAF "hello"`].join("\n");
    expect(formatPaths(paths)).toBe(expected);
  });

  it("`cbor(/search(number)/)` returns 3 paths for [1, 2, 3]", () => {
    const parsed = parseDcborItem("[1, 2, 3]");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(3);
    const expected = [
      "4abc3113 LEAF [1, 2, 3]",
      "    4bf5122f LEAF 1",
      "4abc3113 LEAF [1, 2, 3]",
      "    dbc1b4c9 LEAF 2",
      "4abc3113 LEAF [1, 2, 3]",
      "    084fed08 LEAF 3",
    ].join("\n");
    expect(formatPaths(paths)).toBe(expected);
  });

  it("multiple paths for `{numbers: [1,2,3], value: 42}`", () => {
    const parsed = parseDcborItem('{"numbers": [1, 2, 3], "value": 42}');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(4);
    const expected = [
      `832e44f1 LEAF {"value": 42, "numbers": [1, 2, 3]}`,
      `    7f83f7bd LEAF 42`,
      `832e44f1 LEAF {"value": 42, "numbers": [1, 2, 3]}`,
      `    4abc3113 LEAF [1, 2, 3]`,
      `        4bf5122f LEAF 1`,
      `832e44f1 LEAF {"value": 42, "numbers": [1, 2, 3]}`,
      `    4abc3113 LEAF [1, 2, 3]`,
      `        dbc1b4c9 LEAF 2`,
      `832e44f1 LEAF {"value": 42, "numbers": [1, 2, 3]}`,
      `    4abc3113 LEAF [1, 2, 3]`,
      `        084fed08 LEAF 3`,
    ].join("\n");
    expect(formatPaths(paths)).toBe(expected);
  });

  it("array element access via search(number)", () => {
    const envelope = Envelope.new([1, 2, 3] as unknown as number);
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(3);
    const expected = [
      "4abc3113 LEAF [1, 2, 3]",
      "    4bf5122f LEAF 1",
      "4abc3113 LEAF [1, 2, 3]",
      "    dbc1b4c9 LEAF 2",
      "4abc3113 LEAF [1, 2, 3]",
      "    084fed08 LEAF 3",
    ].join("\n");
    expect(formatPaths(paths)).toBe(expected);
  });
});
