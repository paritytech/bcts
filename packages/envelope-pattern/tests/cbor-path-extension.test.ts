/**
 * @bcts/envelope-pattern — `cbor` pattern path extension
 *
 * Port of `bc-envelope-pattern-rust/tests/test_cbor_path_extension.rs`.
 *
 * Verifies that `cbor` patterns extend paths to include the internal
 * CBOR structure as individual envelope path components, with full
 * `formatPaths` byte-shape pins per Rust fixture.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { parseDcborItem } from "@bcts/dcbor-parse";
import { formatPaths, parse, patternPaths } from "../src";

function envFromDcbor(src: string): Envelope {
  const r = parseDcborItem(src);
  if (!r.ok) throw new Error(`parseDcborItem failed: ${r.error}`);
  return Envelope.new(r.value as unknown as number);
}

describe("cbor path extension (test_cbor_path_extension.rs)", () => {
  it("simple array paths", () => {
    const envelope = Envelope.new([1, 2, 3] as unknown as number);
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(3);

    expect(formatPaths(paths)).toBe(
      [
        "4abc3113 LEAF [1, 2, 3]",
        "    4bf5122f LEAF 1",
        "4abc3113 LEAF [1, 2, 3]",
        "    dbc1b4c9 LEAF 2",
        "4abc3113 LEAF [1, 2, 3]",
        "    084fed08 LEAF 3",
      ].join("\n"),
    );
  });

  it("nested structure paths — 4 numbers", () => {
    const envelope = envFromDcbor(
      '{"scores": [95, 87, 92], "value": 42}',
    );
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(4);

    expect(formatPaths(paths)).toBe(
      [
        `df80ebe9 LEAF {"value": 42, "scores": [95, 87, 92]}`,
        `    7f83f7bd LEAF 42`,
        `df80ebe9 LEAF {"value": 42, "scores": [95, 87, 92]}`,
        `    3a129d53 LEAF [95, 87, 92]`,
        `        61544f78 LEAF 95`,
        `df80ebe9 LEAF {"value": 42, "scores": [95, 87, 92]}`,
        `    3a129d53 LEAF [95, 87, 92]`,
        `        8fa86205 LEAF 87`,
        `df80ebe9 LEAF {"value": 42, "scores": [95, 87, 92]}`,
        `    3a129d53 LEAF [95, 87, 92]`,
        `        672fa214 LEAF 92`,
      ].join("\n"),
    );
  });

  it("single value paths", () => {
    const envelope = Envelope.new(42);
    const r = parse("cbor(/number/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(1);
    expect(formatPaths(paths)).toBe("7f83f7bd LEAF 42");
  });

  it("text-search paths in complex map+array — 6 strings", () => {
    const envelope = envFromDcbor(
      '{"name": "Alice", "items": ["apple", "banana"], "count": 2}',
    );
    const r = parse("cbor(/search(text)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(6);

    expect(formatPaths(paths)).toBe(
      [
        `6254f700 LEAF {"name": "Alice", "count": 2, "items": ["apple", "banana"]}`,
        `    800a0588 LEAF "name"`,
        `6254f700 LEAF {"name": "Alice", "count": 2, "items": ["apple", "banana"]}`,
        `    13941b48 LEAF "Alice"`,
        `6254f700 LEAF {"name": "Alice", "count": 2, "items": ["apple", "banana"]}`,
        `    8a72e186 LEAF "count"`,
        `6254f700 LEAF {"name": "Alice", "count": 2, "items": ["apple", "banana"]}`,
        `    9e381786 LEAF "items"`,
        `6254f700 LEAF {"name": "Alice", "count": 2, "items": ["apple", "banana"]}`,
        `    a3ad5766 LEAF ["apple", "banana"]`,
        `        cc1e16a1 LEAF "apple"`,
        `6254f700 LEAF {"name": "Alice", "count": 2, "items": ["apple", "banana"]}`,
        `    a3ad5766 LEAF ["apple", "banana"]`,
        `        b863e7f4 LEAF "banana"`,
      ].join("\n"),
    );
  });

  it("no-match paths — empty", () => {
    const envelope = Envelope.new("just text");
    const r = parse("cbor(/number/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(0);
    expect(formatPaths(paths)).toBe("");
  });

  it("preserves order — [10, 20, 30]", () => {
    const envelope = envFromDcbor("[10, 20, 30]");
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(3);

    expect(formatPaths(paths)).toBe(
      [
        `5e81a0f3 LEAF [10, 20, 30]`,
        `    01ba4719 LEAF 10`,
        `5e81a0f3 LEAF [10, 20, 30]`,
        `    83891d7f LEAF 20`,
        `5e81a0f3 LEAF [10, 20, 30]`,
        `    cf972730 LEAF 30`,
      ].join("\n"),
    );
  });

  it("complex nested paths — 3 numbers (30, 25, 2)", () => {
    const envelope = envFromDcbor(
      `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}], "total": 2}`,
    );
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(3);

    expect(formatPaths(paths)).toBe(
      [
        `e341ba42 LEAF {"total": 2, "users": [{"age": 30, "name": "Alice"}, {"age": 25, "name": "Bob"}]}`,
        `    dbc1b4c9 LEAF 2`,
        `e341ba42 LEAF {"total": 2, "users": [{"age": 30, "name": "Alice"}, {"age": 25, "name": "Bob"}]}`,
        `    c83073cd LEAF [{"age": 30, "name": "Alice"}, {"age": 25, "name": "Bob"}]`,
        `        a9c2e8b9 LEAF {"age": 30, "name": "Alice"}`,
        `            cf972730 LEAF 30`,
        `e341ba42 LEAF {"total": 2, "users": [{"age": 30, "name": "Alice"}, {"age": 25, "name": "Bob"}]}`,
        `    c83073cd LEAF [{"age": 30, "name": "Alice"}, {"age": 25, "name": "Bob"}]`,
        `        728f5697 LEAF {"age": 25, "name": "Bob"}`,
        `            eb55bbe1 LEAF 25`,
      ].join("\n"),
    );
  });

  it("map structure paths — finds two numbers", () => {
    const envelope = envFromDcbor('{"a": 1, "b": {"c": 2}}');
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(2);

    // Each path: starts at root, extends past root, ends at a number.
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (path === undefined) throw new Error("undefined path");
      expect(path[0]?.digest().equals(envelope.digest())).toBe(true);
      expect(path.length).toBeGreaterThan(1);
    }
  });

  it("preserves traversal order across nested arrays — [[1,2,3],[4,5,6]]", () => {
    const envelope = envFromDcbor("[[1, 2, 3], [4, 5, 6]]");
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(paths.length).toBe(6);

    expect(formatPaths(paths)).toBe(
      [
        `88c5c85e LEAF [[1, 2, 3], [4, 5, 6]]`,
        `    4abc3113 LEAF [1, 2, 3]`,
        `        4bf5122f LEAF 1`,
        `88c5c85e LEAF [[1, 2, 3], [4, 5, 6]]`,
        `    4abc3113 LEAF [1, 2, 3]`,
        `        dbc1b4c9 LEAF 2`,
        `88c5c85e LEAF [[1, 2, 3], [4, 5, 6]]`,
        `    4abc3113 LEAF [1, 2, 3]`,
        `        084fed08 LEAF 3`,
        `88c5c85e LEAF [[1, 2, 3], [4, 5, 6]]`,
        `    f215fbf4 LEAF [4, 5, 6]`,
        `        e52d9c50 LEAF 4`,
        `88c5c85e LEAF [[1, 2, 3], [4, 5, 6]]`,
        `    f215fbf4 LEAF [4, 5, 6]`,
        `        e77b9a9a LEAF 5`,
        `88c5c85e LEAF [[1, 2, 3], [4, 5, 6]]`,
        `    f215fbf4 LEAF [4, 5, 6]`,
        `        67586e98 LEAF 6`,
      ].join("\n"),
    );
  });
});
