/**
 * Tests for the match command
 *
 * Ported from ref/bc-dcbor-cli/tests/test_match.rs
 */

import { describe, it, expect } from "vitest";
import { runCliExpect, runCli, matchCmd } from "./common.js";

describe("match command", () => {
  describe("simple patterns", () => {
    it("matches number pattern", () => {
      runCliExpect(matchCmd("number", "42", { out: "diag" }), "42");
    });

    it("matches text pattern", () => {
      runCliExpect(matchCmd("text", '"hello"', { out: "diag" }), '"hello"');
    });

    it("matches bool pattern", () => {
      runCliExpect(matchCmd("bool", "true", { out: "diag" }), "true");
    });
  });

  describe("structure patterns", () => {
    it("matches array with typed elements", () => {
      runCliExpect(matchCmd("[number, text]", '[42, "hello"]', { out: "diag" }), '[42, "hello"]');
    });

    it("matches map with typed values", () => {
      runCliExpect(
        matchCmd("{1: number}", '{1: 42, 2: "text"}', { out: "diag" }),
        '{1: 42, 2: "text"}',
      );
    });
  });

  describe("search patterns", () => {
    it("finds all numbers in nested structure", () => {
      const input = '{1: 42, 2: "text", 3: [1, 2, 3]}';
      const expected = `{1: 42, 2: "text", 3: [1, 2, 3]}
    1
{1: 42, 2: "text", 3: [1, 2, 3]}
    42
{1: 42, 2: "text", 3: [1, 2, 3]}
    2
{1: 42, 2: "text", 3: [1, 2, 3]}
    3
{1: 42, 2: "text", 3: [1, 2, 3]}
    [1, 2, 3]
        1
{1: 42, 2: "text", 3: [1, 2, 3]}
    [1, 2, 3]
        2
{1: 42, 2: "text", 3: [1, 2, 3]}
    [1, 2, 3]
        3`;
      runCliExpect(matchCmd("search(number)", input, { out: "paths" }), expected);
    });
  });

  describe("captures", () => {
    it("captures single value", () => {
      const expected = `@num
    42
42`;
      runCliExpect(matchCmd("@num(number)", "42", { out: "paths", captures: true }), expected);
    });

    it("captures with or pattern - first match", () => {
      const expected = `@first
    42
42`;
      runCliExpect(
        matchCmd("@first(number) | @second(text)", "42", {
          out: "paths",
          captures: true,
        }),
        expected,
      );
    });

    it("captures with or pattern - second match", () => {
      const expected = `@second
    "hello"
"hello"`;
      runCliExpect(
        matchCmd("@first(number) | @second(text)", '"hello"', {
          out: "paths",
          captures: true,
        }),
        expected,
      );
    });
  });

  describe("error handling", () => {
    it("fails on invalid pattern syntax", () => {
      expect(() => runCli(matchCmd("invalid(", "42"))).toThrow();
    });

    it("fails when pattern does not match", () => {
      expect(() => runCli(matchCmd("text", "42"))).toThrow(/No match/);
    });
  });

  describe("input formats", () => {
    it("accepts hex input", () => {
      runCliExpect(matchCmd("number", "182a", { in: "hex", out: "diag" }), "42");
    });

    it("accepts diag input (default)", () => {
      runCliExpect(matchCmd("number", "42", { out: "diag" }), "42");
    });
  });

  describe("output formats", () => {
    it("outputs hex format", () => {
      runCliExpect(matchCmd("number", "42", { out: "hex" }), "182a");
    });

    it("outputs with lastOnly option", () => {
      const expected = `1
2
3`;
      runCliExpect(
        matchCmd("search(number)", "[1, 2, 3]", { out: "paths", lastOnly: true }),
        expected,
      );
    });
  });

  describe("array patterns", () => {
    it("matches array with specific value", () => {
      runCliExpect(matchCmd("[42, text]", '[42, "hello"]', { out: "diag" }), '[42, "hello"]');
    });

    it("captures from array elements", () => {
      const expected = `@first
    [42, "hello"]
        42
@second
    [42, "hello"]
        "hello"
[42, "hello"]`;
      runCliExpect(
        matchCmd("[@first(number), @second(text)]", '[42, "hello"]', {
          out: "paths",
          captures: true,
        }),
        expected,
      );
    });
  });

  describe("map patterns", () => {
    it("matches map with specific key", () => {
      runCliExpect(
        matchCmd('{"name": text}', '{"name": "Alice", "age": 30}', {
          out: "diag",
        }),
        '{"age": 30, "name": "Alice"}',
      );
    });

    it("captures from map key-value pairs", () => {
      const expected = `@key
    {"name": "Alice"}
        "name"
@value
    {"name": "Alice"}
        "Alice"
{"name": "Alice"}`;
      // Use the correct pattern syntax: @key("name") is a capture wrapping the text pattern
      runCliExpect(
        matchCmd('{@key("name"): @value(text)}', '{"name": "Alice"}', {
          out: "paths",
          captures: true,
        }),
        expected,
      );
    });
  });

  describe("complex patterns", () => {
    it("finds nested structures with search", () => {
      const input = '{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}';
      const expected = `{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}
    [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        {"id": 1, "name": "Alice"}
{"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}
    [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        {"id": 2, "name": "Bob"}`;
      runCliExpect(matchCmd('search({"id": number})', input, { out: "paths" }), expected);
    });
  });

  describe("formatting options", () => {
    it("outputs without indentation", () => {
      const expected = `[1, 2]
1
[1, 2]
2`;
      runCliExpect(
        matchCmd("search(number)", "[1, 2]", { out: "paths", noIndent: true }),
        expected,
      );
    });

    it("combines lastOnly with captures", () => {
      const expected = `@num
    1
    2
1
2`;
      runCliExpect(
        matchCmd("search(@num(number))", "[1, 2]", {
          out: "paths",
          lastOnly: true,
          captures: true,
        }),
        expected,
      );
    });
  });

  describe("tagged values", () => {
    it("matches tagged value pattern", () => {
      // Tag 1 is timestamp, so it gets formatted as a date in paths output
      // (The Rust test uses default output format which is 'paths')
      runCliExpect(
        matchCmd("tagged(1, number)", "1(42)", { out: "paths" }),
        "1970-01-01T00:00:42Z",
      );
    });

    it("captures from tagged value content", () => {
      const expected = `@content
    1970-01-01T00:00:42Z
        42
1970-01-01T00:00:42Z`;
      runCliExpect(
        matchCmd("tagged(1, @content(number))", "1(42)", {
          out: "paths",
          captures: true,
        }),
        expected,
      );
    });
  });

  describe("binary input/output", () => {
    it("round-trips through hex", () => {
      // First convert to hex
      const hexResult = runCli(matchCmd("number", "42", { out: "hex" }));
      expect(hexResult).toBe("182a");

      // Then use hex as input
      runCliExpect(matchCmd("number", "182a", { in: "hex", out: "diag" }), "42");
    });
  });

  describe("edge cases", () => {
    it("matches empty array", () => {
      runCliExpect(matchCmd("array", "[]", { out: "diag" }), "[]");
    });

    it("matches empty map", () => {
      runCliExpect(matchCmd("map", "{}", { out: "diag" }), "{}");
    });

    it("matches null value", () => {
      runCliExpect(matchCmd("null", "null", { out: "diag" }), "null");
    });
  });
});
