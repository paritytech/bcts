/**
 * Parser tests for dCBOR patterns.
 */

import { describe, it, expect } from "vitest";
import { parse, patternDisplay } from "../src";

describe("parse", () => {
  describe("basic patterns", () => {
    it("should parse bool pattern", () => {
      const result = parse("bool");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("bool");
      }
    });

    it("should parse true literal", () => {
      const result = parse("true");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("true");
      }
    });

    it("should parse false literal", () => {
      const result = parse("false");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("false");
      }
    });

    it("should parse null pattern", () => {
      const result = parse("null");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("null");
      }
    });

    it("should parse number pattern", () => {
      const result = parse("number");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("number");
      }
    });

    it("should parse text pattern", () => {
      const result = parse("text");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("text");
      }
    });

    it("should parse array pattern", () => {
      const result = parse("array");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("array");
      }
    });

    it("should parse map pattern", () => {
      const result = parse("map");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("map");
      }
    });
  });

  describe("number literals", () => {
    it("should parse integer", () => {
      const result = parse("42");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("42");
      }
    });

    it("should parse negative integer", () => {
      const result = parse("-42");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("-42");
      }
    });

    it("should parse float", () => {
      const result = parse("3.14");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("3.14");
      }
    });

    it("should parse number range", () => {
      // Rust uses a three-dot ellipsis for number ranges
      // (`bc-dcbor-pattern-rust/src/pattern/value/number_pattern.rs`).
      // The lexer only matches `...` (`Token::Ellipsis`); earlier this
      // port accepted `..` (two dots), which silently built ranges
      // Rust's parser rejects.
      const result = parse("1...10");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("1...10");
      }
    });
  });

  describe("string literals", () => {
    it("should parse string literal", () => {
      const result = parse('"hello"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe('"hello"');
      }
    });

    it("should parse regex pattern", () => {
      // The `text` keyword no longer consumes a following SingleQuoted
      // token (matches Rust `parse_text` which is now a no-op).
      // Single-quoted regex literals are parsed as standalone primaries.
      const result = parse("/^hello/");
      expect(result.ok).toBe(true);
      // Regex display format may vary
    });
  });

  describe("meta patterns", () => {
    it("should parse OR pattern", () => {
      const result = parse("number | text");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const display = patternDisplay(result.value);
        expect(display).toContain("|");
      }
    });

    it("should parse AND pattern", () => {
      const result = parse("number & text");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const display = patternDisplay(result.value);
        expect(display).toContain("&");
      }
    });

    it("should parse NOT pattern", () => {
      const result = parse("!number");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const display = patternDisplay(result.value);
        expect(display).toContain("!");
      }
    });

    it("should parse grouped pattern", () => {
      const result = parse("(number | text)");
      expect(result.ok).toBe(true);
    });

    it("should parse any pattern (*)", () => {
      const result = parse("*");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("*");
      }
    });
  });

  describe("structure patterns", () => {
    it("should parse bracket array pattern", () => {
      const result = parse("[number]");
      expect(result.ok).toBe(true);
    });

    it("should parse brace map pattern", () => {
      const result = parse("{text: number}");
      expect(result.ok).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should fail on empty input", () => {
      // Rust `parse_partial` delegates straight to `parse_or`, which
      // surfaces `UnexpectedEndOfInput` (not `EmptyInput`) for
      // empty / whitespace-only input. Earlier this port short-
      // circuited with `EmptyInput`, which produced a different error
      // variant than Rust for the same input.
      const result = parse("");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("UnexpectedEndOfInput");
      }
    });

    it("should fail on whitespace-only input", () => {
      const result = parse("   ");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("UnexpectedEndOfInput");
      }
    });
  });
});
