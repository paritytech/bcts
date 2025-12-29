/**
 * Meta pattern matching tests for dCBOR patterns.
 */

import { describe, it, expect } from "vitest";
import { cbor } from "@bcts/dcbor";
import { parse, patternMatches } from "../src";

describe("meta patterns", () => {
  describe("any pattern (*)", () => {
    it("should match anything", () => {
      const result = parse("*");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(true);
        expect(patternMatches(result.value, cbor("hello"))).toBe(true);
        expect(patternMatches(result.value, cbor(true))).toBe(true);
        expect(patternMatches(result.value, cbor(null))).toBe(true);
        expect(patternMatches(result.value, cbor([1, 2, 3]))).toBe(true);
        expect(patternMatches(result.value, cbor({ a: 1 }))).toBe(true);
      }
    });
  });

  describe("or patterns", () => {
    it("should match if any pattern matches", () => {
      const result = parse("number | text");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(true);
        expect(patternMatches(result.value, cbor("hello"))).toBe(true);
        expect(patternMatches(result.value, cbor(true))).toBe(false);
      }
    });

    it("should handle multiple alternatives", () => {
      const result = parse("number | text | bool");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(true);
        expect(patternMatches(result.value, cbor("hello"))).toBe(true);
        expect(patternMatches(result.value, cbor(true))).toBe(true);
        expect(patternMatches(result.value, cbor(null))).toBe(false);
      }
    });

    it("true | false should match any bool", () => {
      const result = parse("true | false");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(true))).toBe(true);
        expect(patternMatches(result.value, cbor(false))).toBe(true);
        expect(patternMatches(result.value, cbor(42))).toBe(false);
      }
    });
  });

  describe("and patterns", () => {
    it("should match if all patterns match", () => {
      const result = parse("number & 42");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(true);
        expect(patternMatches(result.value, cbor(43))).toBe(false);
      }
    });
  });

  describe("not patterns", () => {
    it("should negate match", () => {
      const result = parse("!number");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(false);
        expect(patternMatches(result.value, cbor("hello"))).toBe(true);
        expect(patternMatches(result.value, cbor(true))).toBe(true);
      }
    });

    it("should work with complex patterns", () => {
      const result = parse("!(number | text)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(false);
        expect(patternMatches(result.value, cbor("hello"))).toBe(false);
        expect(patternMatches(result.value, cbor(true))).toBe(true);
        expect(patternMatches(result.value, cbor(null))).toBe(true);
      }
    });
  });

  describe("operator precedence", () => {
    it("NOT binds tighter than AND", () => {
      // !number & text should be (!number) & text
      const result = parse("!number & text");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Must be text AND not number
        // "hello" is text and not number - should match
        expect(patternMatches(result.value, cbor("hello"))).toBe(true);
        // 42 is number - should not match
        expect(patternMatches(result.value, cbor(42))).toBe(false);
      }
    });

    it("AND binds tighter than OR", () => {
      // number & 42 | text should be (number & 42) | text
      const result = parse("number & 42 | text");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(true);
        expect(patternMatches(result.value, cbor("hello"))).toBe(true);
        expect(patternMatches(result.value, cbor(43))).toBe(false);
      }
    });

    it("parentheses override precedence", () => {
      // number & (42 | 43) should match 42 or 43
      const result = parse("number & (42 | 43)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(true);
        expect(patternMatches(result.value, cbor(43))).toBe(true);
        expect(patternMatches(result.value, cbor(44))).toBe(false);
      }
    });
  });

  describe("grouped patterns", () => {
    it("should handle nested groups", () => {
      const result = parse("((number | text))");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor(42))).toBe(true);
        expect(patternMatches(result.value, cbor("hello"))).toBe(true);
      }
    });
  });
});
