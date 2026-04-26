/**
 * @bcts/envelope-pattern — `cbor` pattern dcbor captures
 *
 * Port of `bc-envelope-pattern-rust/tests/test_cbor_captures.rs`.
 *
 * Pins capture behaviour for `cbor(/.../)` patterns end-to-end:
 *   - Simple captures.
 *   - Captures inside `search(...)`.
 *   - Multiple captures.
 *   - Nested captures.
 *   - Mixed envelope-level + dcbor-level captures.
 *   - Capture-name conflicts (merge from different levels).
 *   - Array traversal.
 *   - No-match.
 *   - "Performance" smoke test (capture count + format-paths shape).
 *   - Comprehensive integration.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import {
  capture,
  defaultFormatPathsOpts,
  formatPathsWithCapturesOpt,
  parse,
  patternPathsWithCaptures,
} from "../src";

describe("cbor captures (test_cbor_captures.rs)", () => {
  it("simple dcbor capture: cbor(/@num(42)/) on Envelope.new(42)", () => {
    const envelope = Envelope.new(42);
    const r = parse("cbor(/@num(42)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, envelope);

    expect(paths.length).toBe(1);
    expect(captures.size).toBe(1);
    expect(captures.has("num")).toBe(true);
    expect(captures.get("num")?.length).toBe(1);

    const expected = [
      "@num",
      "    7f83f7bd LEAF 42",
      "7f83f7bd LEAF 42",
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it("capture with search: cbor(/@values(search(number))/) on [1,2,3]", () => {
    const envelope = Envelope.new([1, 2, 3] as unknown as number);
    const r = parse("cbor(/@values(search(number))/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, envelope);

    expect(paths.length).toBe(3);
    expect(captures.size).toBe(1);
    expect(captures.get("values")?.length).toBe(3);

    const expected = [
      "@values",
      "    4abc3113 LEAF [1, 2, 3]",
      "        4bf5122f LEAF 1",
      "    4abc3113 LEAF [1, 2, 3]",
      "        dbc1b4c9 LEAF 2",
      "    4abc3113 LEAF [1, 2, 3]",
      "        084fed08 LEAF 3",
      "4abc3113 LEAF [1, 2, 3]",
      "    4bf5122f LEAF 1",
      "4abc3113 LEAF [1, 2, 3]",
      "    dbc1b4c9 LEAF 2",
      "4abc3113 LEAF [1, 2, 3]",
      "    084fed08 LEAF 3",
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it("multiple search captures over a flat string array", () => {
    const envelope = Envelope.new(["name", "Alice", "age", "30"] as unknown as number);
    const r = parse("cbor(/@names(search(text))/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, envelope);

    expect(paths.length).toBe(4);
    expect(captures.size).toBe(1);
    expect(captures.get("names")?.length).toBe(4);

    const expected = [
      "@names",
      `    ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `        800a0588 LEAF "name"`,
      `    ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `        13941b48 LEAF "Alice"`,
      `    ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `        5943be12 LEAF "age"`,
      `    ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `        08e52634 LEAF "30"`,
      `ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `    800a0588 LEAF "name"`,
      `ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `    13941b48 LEAF "Alice"`,
      `ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `    5943be12 LEAF "age"`,
      `ce1042d4 LEAF ["name", "Alice", "age", "30"]`,
      `    08e52634 LEAF "30"`,
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it("nested captures: @users(search([@name(text), @score(text)]))", () => {
    const envelope = Envelope.new([
      ["Alice", "95"],
      ["Bob", "85"],
    ] as unknown as number);
    const r = parse(
      "cbor(/@users(search([@name(text), @score(text)]))/)",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, envelope);

    expect(paths.length).toBe(2);
    expect(captures.size).toBe(3);
    expect(captures.get("users")?.length).toBe(2);
    expect(captures.get("name")?.length).toBe(2);
    expect(captures.get("score")?.length).toBe(2);

    const expected = [
      "@name",
      `    7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `        6daf5539 LEAF ["Alice", "95"]`,
      `    7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `        43a6ef66 LEAF ["Bob", "85"]`,
      "@score",
      `    7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `        6daf5539 LEAF ["Alice", "95"]`,
      `    7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `        43a6ef66 LEAF ["Bob", "85"]`,
      "@users",
      `    7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `        6daf5539 LEAF ["Alice", "95"]`,
      `    7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `        43a6ef66 LEAF ["Bob", "85"]`,
      `7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `    6daf5539 LEAF ["Alice", "95"]`,
      `7dfc2858 LEAF [["Alice", "95"], ["Bob", "85"]]`,
      `    43a6ef66 LEAF ["Bob", "85"]`,
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it("mixed envelope-level + dcbor-level captures", () => {
    const envelope = Envelope.new(42);
    const cborR = parse("cbor(/@dcbor_level(42)/)");
    expect(cborR.ok).toBe(true);
    if (!cborR.ok) return;
    const pattern = capture("envelope_level", cborR.value);

    const [paths, captures] = patternPathsWithCaptures(pattern, envelope);
    expect(paths.length).toBe(1);
    expect(captures.size).toBe(2);
    expect(captures.has("envelope_level")).toBe(true);
    expect(captures.has("dcbor_level")).toBe(true);
    expect(captures.get("envelope_level")?.length).toBe(1);
    expect(captures.get("dcbor_level")?.length).toBe(1);

    const expected = [
      "@dcbor_level",
      "    7f83f7bd LEAF 42",
      "@envelope_level",
      "    7f83f7bd LEAF 42",
      "7f83f7bd LEAF 42",
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it("capture-name conflicts merge across levels", () => {
    const envelope = Envelope.new(42);
    const cborR = parse("cbor(/@same_name(42)/)");
    expect(cborR.ok).toBe(true);
    if (!cborR.ok) return;
    const pattern = capture("same_name", cborR.value);

    const [paths, captures] = patternPathsWithCaptures(pattern, envelope);
    expect(paths.length).toBe(1);
    expect(captures.size).toBe(1);
    expect(captures.get("same_name")?.length).toBe(2);

    const expected = [
      "@same_name",
      "    7f83f7bd LEAF 42",
      "    7f83f7bd LEAF 42",
      "7f83f7bd LEAF 42",
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it('array traversal captures via search(text) on ["hello","42","world","123"]', () => {
    const envelope = Envelope.new(["hello", "42", "world", "123"] as unknown as number);
    const r = parse("cbor(/@text(search(text))/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, envelope);

    expect(paths.length).toBe(4);
    expect(captures.size).toBe(1);
    expect(captures.get("text")?.length).toBe(4);

    const expected = [
      "@text",
      `    162867a4 LEAF ["hello", "42", "world", "123"]`,
      `        cb835593 LEAF "hello"`,
      `    162867a4 LEAF ["hello", "42", "world", "123"]`,
      `        9fa6eb00 LEAF "42"`,
      `    162867a4 LEAF ["hello", "42", "world", "123"]`,
      `        29651e19 LEAF "world"`,
      `    162867a4 LEAF ["hello", "42", "world", "123"]`,
      `        9bf5bb3e LEAF "123"`,
      `162867a4 LEAF ["hello", "42", "world", "123"]`,
      `    cb835593 LEAF "hello"`,
      `162867a4 LEAF ["hello", "42", "world", "123"]`,
      `    9fa6eb00 LEAF "42"`,
      `162867a4 LEAF ["hello", "42", "world", "123"]`,
      `    29651e19 LEAF "world"`,
      `162867a4 LEAF ["hello", "42", "world", "123"]`,
      `    9bf5bb3e LEAF "123"`,
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it("no-match: cbor(/@num(number)/) on text envelope returns empty", () => {
    const envelope = Envelope.new("hello");
    const r = parse("cbor(/@num(number)/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, envelope);

    expect(paths.length).toBe(0);
    expect(captures.size).toBe(0);
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe("");
  });

  it("performance smoke: cbor(/@nums(search(number))/) on [1,2,3]", () => {
    const envelope = Envelope.new([1, 2, 3] as unknown as number);
    const r = parse("cbor(/@nums(search(number))/)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [paths, captures] = patternPathsWithCaptures(r.value, envelope);

    expect(paths.length).toBe(3);
    expect(captures.get("nums")?.length).toBe(3);

    const expected = [
      "@nums",
      "    4abc3113 LEAF [1, 2, 3]",
      "        4bf5122f LEAF 1",
      "    4abc3113 LEAF [1, 2, 3]",
      "        dbc1b4c9 LEAF 2",
      "    4abc3113 LEAF [1, 2, 3]",
      "        084fed08 LEAF 3",
      "4abc3113 LEAF [1, 2, 3]",
      "    4bf5122f LEAF 1",
      "4abc3113 LEAF [1, 2, 3]",
      "    dbc1b4c9 LEAF 2",
      "4abc3113 LEAF [1, 2, 3]",
      "    084fed08 LEAF 3",
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });

  it("comprehensive: @data(cbor(/@people(search(text))/)) on [Alice, Bob, Charlie]", () => {
    const envelope = Envelope.new(["Alice", "Bob", "Charlie"] as unknown as number);
    const cborR = parse("cbor(/@people(search(text))/)");
    expect(cborR.ok).toBe(true);
    if (!cborR.ok) return;
    const pattern = capture("data", cborR.value);

    const [paths, captures] = patternPathsWithCaptures(pattern, envelope);
    expect(paths.length).toBe(3);
    expect(captures.size).toBe(2);
    expect(captures.get("data")?.length).toBe(3);
    expect(captures.get("people")?.length).toBe(3);

    const expected = [
      "@data",
      `    aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `        13941b48 LEAF "Alice"`,
      `    aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `        13b74194 LEAF "Bob"`,
      `    aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `        ee8e3b02 LEAF "Charlie"`,
      "@people",
      `    aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `        13941b48 LEAF "Alice"`,
      `    aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `        13b74194 LEAF "Bob"`,
      `    aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `        ee8e3b02 LEAF "Charlie"`,
      `aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `    13941b48 LEAF "Alice"`,
      `aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `    13b74194 LEAF "Bob"`,
      `aea55aad LEAF ["Alice", "Bob", "Charlie"]`,
      `    ee8e3b02 LEAF "Charlie"`,
    ].join("\n");
    expect(formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts())).toBe(
      expected,
    );
  });
});
