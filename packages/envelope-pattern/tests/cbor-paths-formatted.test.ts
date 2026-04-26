/**
 * @bcts/envelope-pattern — `cbor` pattern path formatting
 *
 * Port of `bc-envelope-pattern-rust/tests/test_cbor_paths_formatted.rs`.
 *
 * Verifies that path extension produces the expected `formatPaths`
 * output for arrays, nested structures, single values, text searches,
 * empty matches, and that path order is preserved.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { parseDcborItem } from "@bcts/dcbor-parse";
import { formatPaths, parse, patternPaths } from "../src";

describe("cbor pattern formatted paths (test_cbor_paths_formatted.rs)", () => {
  it("simple array paths", () => {
    const envelope = Envelope.new([1, 2, 3] as unknown as number);
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

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

  it("nested structure paths — 4 numbers found", () => {
    const parsed = parseDcborItem('{"scores": [95, 87, 92], "value": 42}');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(4);

    // Each path starts with the root envelope and is extended.
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (path === undefined) throw new Error(`path ${i} undefined`);
      expect(path[0]?.digest().equals(envelope.digest())).toBe(true);
      expect(path.length).toBeGreaterThan(1);
    }
  });

  it("single value `cbor(/number/)` returns just the root envelope", () => {
    const envelope = Envelope.new(42);
    const r = parse("cbor(/number/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(formatPaths(paths)).toBe("7f83f7bd LEAF 42");
  });

  it("text-search paths — finds 6 text values incl. map keys", () => {
    const parsed = parseDcborItem('{"name": "Alice", "items": ["apple", "banana"], "count": 2}');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(text)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    // Rust expects 6 text values (3 map keys + 3 leaf strings).
    expect(paths.length).toBe(6);

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (path === undefined) throw new Error(`path ${i} undefined`);
      expect(path[0]?.digest().equals(envelope.digest())).toBe(true);
      expect(path.length).toBeGreaterThan(1);
    }
  });

  it("no-match patterns return empty paths", () => {
    const envelope = Envelope.new("just text");
    const r = parse("cbor(/number/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);
    expect(formatPaths(paths)).toBe("");
  });

  it("paths preserve order — [10, 20, 30]", () => {
    const parsed = parseDcborItem("[10, 20, 30]");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(3);

    // Extract the trailing element from each path and confirm order
    // matches dcbor-pattern's traversal: 10, 20, 30.
    const numbers: number[] = [];
    for (const path of paths) {
      const last = path[path.length - 1];
      const cbor = last ? (last as unknown as { asLeaf(): unknown }).asLeaf() : undefined;
      if (cbor !== undefined) {
        const c = cbor as { value: unknown; type: number };
        if (typeof c.value === "number" || typeof c.value === "bigint") {
          numbers.push(Number(c.value));
        }
      }
    }
    expect(numbers).toEqual([10, 20, 30]);
  });

  it("complex nested paths — 3 numbers found", () => {
    const parsed = parseDcborItem(
      `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}], "total": 2}`,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);

    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(3);

    // Every path is extended past the root envelope.
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (path === undefined) throw new Error(`path ${i} undefined`);
      expect(path.length).toBeGreaterThan(1);
    }
  });
});
