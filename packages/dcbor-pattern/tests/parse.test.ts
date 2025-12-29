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
      const result = parse("1..10");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternDisplay(result.value)).toBe("1..10");
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
      const result = parse("text'/^hello/'");
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
      const result = parse("");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("EmptyInput");
      }
    });

    it("should fail on whitespace-only input", () => {
      const result = parse("   ");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("EmptyInput");
      }
    });
  });
});
