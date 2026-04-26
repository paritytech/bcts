/**
 * @bcts/envelope-pattern — `cbor` pattern extended paths
 *
 * Port of `bc-envelope-pattern-rust/tests/test_extended_paths.rs`.
 *
 * Verifies that `cbor` patterns return paths that include the
 * internal `cbor` structure as Envelope path elements (not just the
 * outermost envelope). Pins the exact `formatPaths` output against
 * the Rust fixture strings.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { parseDcborItem } from "@bcts/dcbor-parse";
import { formatPaths, parse, patternPaths } from "../src";

describe("cbor pattern extended paths (test_extended_paths.rs)", () => {
  it("returns extended paths for each array element (1, 2, 3)", () => {
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

  it("returns extended paths through a nested map+array structure", () => {
    const parsed = parseDcborItem('{"name": "Alice", "scores": [95, 87, 92]}');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const envelope = Envelope.new(parsed.value as unknown as number);
    const r = parse("cbor(/search(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(3);

    const expected = [
      `73d02807 LEAF {"name": "Alice", "scores": [95, 87, 92]}`,
      "    3a129d53 LEAF [95, 87, 92]",
      "        61544f78 LEAF 95",
      `73d02807 LEAF {"name": "Alice", "scores": [95, 87, 92]}`,
      "    3a129d53 LEAF [95, 87, 92]",
      "        8fa86205 LEAF 87",
      `73d02807 LEAF {"name": "Alice", "scores": [95, 87, 92]}`,
      "    3a129d53 LEAF [95, 87, 92]",
      "        672fa214 LEAF 92",
    ].join("\n");
    expect(formatPaths(paths)).toBe(expected);
  });

  it("returns just the root envelope for a single-value match", () => {
    const envelope = Envelope.new(42);
    const r = parse("cbor(/number/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = patternPaths(r.value, envelope);

    expect(paths.length).toBe(1);
    expect(formatPaths(paths)).toBe("7f83f7bd LEAF 42");
  });

  it("non-pattern `cbor` matchers behave unchanged", () => {
    const envelope = Envelope.new(42);

    // `cbor` (no inner pattern) — match any CBOR
    const anyR = parse("cbor");
    expect(anyR.ok).toBe(true);
    if (!anyR.ok) return;
    const anyPaths = patternPaths(anyR.value, envelope);
    expect(anyPaths.length).toBe(1);
    expect(formatPaths(anyPaths)).toBe("7f83f7bd LEAF 42");

    // `cbor(42)` — match exact value
    const exactR = parse("cbor(42)");
    expect(exactR.ok).toBe(true);
    if (!exactR.ok) return;
    const exactPaths = patternPaths(exactR.value, envelope);
    expect(exactPaths.length).toBe(1);
    expect(formatPaths(exactPaths)).toBe("7f83f7bd LEAF 42");
  });
});
