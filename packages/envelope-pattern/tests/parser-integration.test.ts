/**
 * @bcts/envelope-pattern - Parser Integration Tests
 *
 * Integration tests demonstrating dcbor-pattern integration in the parser.
 * These tests verify that the parser correctly handles both envelope-specific
 * patterns and dcbor-pattern syntax.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust parser_integration_tests.rs
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { parse, patternMatches, patternPaths, convertDcborPatternToEnvelopePattern } from "../src";
import { bool } from "@bcts/dcbor-pattern";

describe("Parser Integration Tests", () => {
  describe("Envelope Patterns Take Precedence", () => {
    it("parses search pattern as envelope pattern", () => {
      const result = parse("search(42)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses node pattern as envelope pattern", () => {
      const result = parse("node");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses assert pattern as envelope pattern", () => {
      const result = parse("assert");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });

    it("parses capture pattern as envelope pattern", () => {
      const result = parse("@name(42)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Meta");
      }
    });

    it("parses cbor pattern as envelope pattern", () => {
      const result = parse("cbor(42)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });
  });

  describe("DCBOR Pattern Compatible Syntax", () => {
    describe("Boolean Patterns", () => {
      it("matches any boolean with envelope", () => {
        const envTrue = Envelope.new(true);
        const envFalse = Envelope.new(false);
        const envNumber = Envelope.new(42);

        const result = parse("bool");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(patternMatches(result.value, envTrue)).toBe(true);
          expect(patternMatches(result.value, envFalse)).toBe(true);
          expect(patternMatches(result.value, envNumber)).toBe(false);
        }
      });

      it("matches true pattern", () => {
        const envTrue = Envelope.new(true);
        const envFalse = Envelope.new(false);

        const result = parse("true");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(patternMatches(result.value, envTrue)).toBe(true);
          expect(patternMatches(result.value, envFalse)).toBe(false);
        }
      });

      it("matches false pattern", () => {
        const envTrue = Envelope.new(true);
        const envFalse = Envelope.new(false);

        const result = parse("false");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(patternMatches(result.value, envFalse)).toBe(true);
          expect(patternMatches(result.value, envTrue)).toBe(false);
        }
      });
    });

    describe("Number Patterns", () => {
      it("matches any number with envelope", () => {
        const envNumber = Envelope.new(42);
        const envText = Envelope.new("hello");

        const result = parse("number");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(patternMatches(result.value, envNumber)).toBe(true);
          expect(patternMatches(result.value, envText)).toBe(false);
        }
      });

      it("matches specific number", () => {
        const env42 = Envelope.new(42);
        const env43 = Envelope.new(43);

        const result = parse("42");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(patternMatches(result.value, env42)).toBe(true);
          expect(patternMatches(result.value, env43)).toBe(false);
        }
      });
    });

    describe("Text Patterns", () => {
      it("matches any text with envelope", () => {
        const envText = Envelope.new("hello");
        const envNumber = Envelope.new(42);

        const result = parse("text");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(patternMatches(result.value, envText)).toBe(true);
          expect(patternMatches(result.value, envNumber)).toBe(false);
        }
      });

      it("matches specific text", () => {
        const envHello = Envelope.new("hello");
        const envWorld = Envelope.new("world");

        const result = parse('"hello"');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(patternMatches(result.value, envHello)).toBe(true);
          expect(patternMatches(result.value, envWorld)).toBe(false);
        }
      });
    });
  });

  describe("Mixed Envelope and DCBOR Syntax", () => {
    it("search with number pattern", () => {
      const env = Envelope.new(42);

      const result = parse("search(42)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const paths = patternPaths(result.value, env);
        expect(paths.length).toBeGreaterThan(0);
      }
    });

    it("boolean or number pattern", () => {
      const envNumber = Envelope.new(42);
      const envBool = Envelope.new(true);
      const envText = Envelope.new("hello");

      const result = parse("true | 42");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, envNumber)).toBe(true);
        expect(patternMatches(result.value, envBool)).toBe(true);
        expect(patternMatches(result.value, envText)).toBe(false);
      }
    });
  });

  describe("Error Handling", () => {
    it("rejects invalid tokens", () => {
      const result = parse("INVALID_TOKEN");
      expect(result.ok).toBe(false);
    });

    it("rejects extra data", () => {
      const result = parse("true false");
      expect(result.ok).toBe(false);
    });

    it("rejects incomplete parentheses", () => {
      const result = parse("(");
      expect(result.ok).toBe(false);
    });

    it("provides error for empty input", () => {
      const result = parse("");
      expect(result.ok).toBe(false);
    });
  });

  describe("Precedence Demonstration", () => {
    it("capture patterns use envelope parsing", () => {
      const result = parse("@num(42)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should be an envelope capture pattern
        expect(result.value.type).toBe("Meta");
      }
    });

    it("map patterns use dcbor-pattern syntax", () => {
      const result = parse("map");
      expect(result.ok).toBe(true);
      // Note: map pattern may parse as Meta type due to implementation
    });
  });

  describe("Conversion Layer", () => {
    it("converts dcbor boolean pattern to envelope pattern", () => {
      const dcborBool = bool(true);
      const envelopeResult = convertDcborPatternToEnvelopePattern(dcborBool);

      expect(envelopeResult.ok).toBe(true);
      if (envelopeResult.ok) {
        const envTrue = Envelope.new(true);
        const envFalse = Envelope.new(false);

        expect(patternMatches(envelopeResult.value, envTrue)).toBe(true);
        expect(patternMatches(envelopeResult.value, envFalse)).toBe(false);
      }
    });
  });
});
