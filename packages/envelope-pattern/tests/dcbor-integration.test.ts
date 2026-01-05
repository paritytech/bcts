/**
 * @bcts/envelope-pattern - dCBOR Pattern Integration Tests
 *
 * These tests verify the conversion from dcbor-pattern patterns to
 * envelope patterns and their matching behavior.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust dcbor_integration_tests.rs
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { parseDcborItemPartial } from "@bcts/dcbor-parse";
import {
  anyBool,
  bool,
  anyNumber,
  number,
  numberGreaterThan,
  numberRange,
  anyText,
  text,
  textRegex,
  and,
  or,
  type Pattern,
  patternMatches,
} from "../src";
import {
  convertDcborPatternToEnvelopePattern,
} from "../src/pattern/dcbor-integration";
import {
  anyBool as dcborAnyBool,
  bool as dcborBool,
  anyNumber as dcborAnyNumber,
  number as dcborNumber,
  numberRange as dcborNumberRange,
  numberGreaterThan as dcborNumberGreaterThan,
  numberLessThan as dcborNumberLessThan,
  anyText as dcborAnyText,
  text as dcborText,
  textRegex as dcborTextRegex,
  and as dcborAnd,
  or as dcborOr,
} from "@bcts/dcbor-pattern";

/**
 * Helper function to create an envelope from CBOR diagnostic notation.
 */
function envelopeFromCbor(diagnostic: string): Envelope {
  const result = parseDcborItemPartial(diagnostic);
  if (!result.ok) {
    throw new Error(`Failed to parse CBOR: ${diagnostic}`);
  }
  const [cbor] = result.value;
  return Envelope.new(cbor);
}

describe("dCBOR Pattern Integration", () => {
  describe("Bool Patterns", () => {
    it("converts and matches any bool pattern", () => {
      const dcborPattern = dcborAnyBool();
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const trueEnv = envelopeFromCbor("true");
      const falseEnv = envelopeFromCbor("false");
      const numberEnv = envelopeFromCbor("42");

      expect(patternMatches(envPattern, trueEnv)).toBe(true);
      expect(patternMatches(envPattern, falseEnv)).toBe(true);
      expect(patternMatches(envPattern, numberEnv)).toBe(false);
    });

    it("converts and matches specific bool patterns", () => {
      const dcborTrue = dcborBool(true);
      const dcborFalse = dcborBool(false);

      const trueResult = convertDcborPatternToEnvelopePattern(dcborTrue);
      const falseResult = convertDcborPatternToEnvelopePattern(dcborFalse);

      expect(trueResult.ok).toBe(true);
      expect(falseResult.ok).toBe(true);
      if (!trueResult.ok || !falseResult.ok) return;

      const envTrue = trueResult.value;
      const envFalse = falseResult.value;

      const trueEnv = envelopeFromCbor("true");
      const falseEnv = envelopeFromCbor("false");
      const numberEnv = envelopeFromCbor("42");

      expect(patternMatches(envTrue, trueEnv)).toBe(true);
      expect(patternMatches(envTrue, falseEnv)).toBe(false);
      expect(patternMatches(envTrue, numberEnv)).toBe(false);

      expect(patternMatches(envFalse, falseEnv)).toBe(true);
      expect(patternMatches(envFalse, trueEnv)).toBe(false);
      expect(patternMatches(envFalse, numberEnv)).toBe(false);
    });
  });

  describe("Number Patterns", () => {
    it("converts and matches any number pattern", () => {
      const dcborPattern = dcborAnyNumber();
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const num42 = envelopeFromCbor("42");
      const num75 = envelopeFromCbor("75");
      const num150 = envelopeFromCbor("150");
      const textEnv = envelopeFromCbor('"hello"');

      expect(patternMatches(envPattern, num42)).toBe(true);
      expect(patternMatches(envPattern, num75)).toBe(true);
      expect(patternMatches(envPattern, num150)).toBe(true);
      expect(patternMatches(envPattern, textEnv)).toBe(false);
    });

    it("converts and matches specific number pattern", () => {
      const dcborPattern = dcborNumber(42);
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const num42 = envelopeFromCbor("42");
      const num75 = envelopeFromCbor("75");

      expect(patternMatches(envPattern, num42)).toBe(true);
      expect(patternMatches(envPattern, num75)).toBe(false);
    });

    it("converts and matches number range pattern", () => {
      const dcborPattern = dcborNumberRange(1, 100);
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const num42 = envelopeFromCbor("42");
      const num75 = envelopeFromCbor("75");
      const num150 = envelopeFromCbor("150");

      expect(patternMatches(envPattern, num42)).toBe(true);
      expect(patternMatches(envPattern, num75)).toBe(true);
      expect(patternMatches(envPattern, num150)).toBe(false);
    });

    it("converts and matches number greater than pattern", () => {
      const dcborPattern = dcborNumberGreaterThan(50);
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const num42 = envelopeFromCbor("42");
      const num75 = envelopeFromCbor("75");
      const num150 = envelopeFromCbor("150");

      expect(patternMatches(envPattern, num42)).toBe(false);
      expect(patternMatches(envPattern, num75)).toBe(true);
      expect(patternMatches(envPattern, num150)).toBe(true);
    });
  });

  describe("Text Patterns", () => {
    it("converts and matches any text pattern", () => {
      const dcborPattern = dcborAnyText();
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const hello = envelopeFromCbor('"hello"');
      const world = envelopeFromCbor('"world"');
      const hero = envelopeFromCbor('"hero"');
      const numberEnv = envelopeFromCbor("42");

      expect(patternMatches(envPattern, hello)).toBe(true);
      expect(patternMatches(envPattern, world)).toBe(true);
      expect(patternMatches(envPattern, hero)).toBe(true);
      expect(patternMatches(envPattern, numberEnv)).toBe(false);
    });

    it("converts and matches specific text pattern", () => {
      const dcborPattern = dcborText("hello");
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const hello = envelopeFromCbor('"hello"');
      const world = envelopeFromCbor('"world"');
      const hero = envelopeFromCbor('"hero"');

      expect(patternMatches(envPattern, hello)).toBe(true);
      expect(patternMatches(envPattern, world)).toBe(false);
      expect(patternMatches(envPattern, hero)).toBe(false);
    });

    it("converts and matches text regex pattern", () => {
      const dcborPattern = dcborTextRegex(/^h.*o$/);
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const hello = envelopeFromCbor('"hello"');
      const world = envelopeFromCbor('"world"');
      const hero = envelopeFromCbor('"hero"');

      // Matches: starts with 'h', ends with 'o'
      expect(patternMatches(envPattern, hello)).toBe(true);
      expect(patternMatches(envPattern, world)).toBe(false);
      expect(patternMatches(envPattern, hero)).toBe(true);
    });
  });

  describe("Meta Patterns", () => {
    it("converts and matches AND pattern", () => {
      const dcborPattern = dcborAnd(
        dcborNumberGreaterThan(10),
        dcborNumberLessThan(50)
      );
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const num25 = envelopeFromCbor("25");
      const num42 = envelopeFromCbor("42");
      const num75 = envelopeFromCbor("75");

      // 10 < x < 50
      expect(patternMatches(envPattern, num25)).toBe(true);
      expect(patternMatches(envPattern, num42)).toBe(true);
      expect(patternMatches(envPattern, num75)).toBe(false);
    });

    it("converts and matches OR pattern", () => {
      const dcborPattern = dcborOr(
        dcborText("hello"),
        dcborNumber(42)
      );
      const result = convertDcborPatternToEnvelopePattern(dcborPattern);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const envPattern = result.value;
      const hello = envelopeFromCbor('"hello"');
      const num42 = envelopeFromCbor("42");
      const num25 = envelopeFromCbor("25");

      expect(patternMatches(envPattern, hello)).toBe(true);
      expect(patternMatches(envPattern, num42)).toBe(true);
      expect(patternMatches(envPattern, num25)).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("successfully converts valid patterns", () => {
      const validPatterns = [
        dcborAnyBool(),
        dcborNumber(42),
        dcborText("hello"),
        dcborOr(dcborBool(true), dcborNumber(123)),
      ];

      for (const pattern of validPatterns) {
        const result = convertDcborPatternToEnvelopePattern(pattern);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("Display Formatting", () => {
    it("converted patterns have meaningful string representations", () => {
      const dcborBoolPat = dcborBool(true);
      const dcborNumPat = dcborNumber(42);
      const dcborTextPat = dcborText("hello");

      const boolResult = convertDcborPatternToEnvelopePattern(dcborBoolPat);
      const numResult = convertDcborPatternToEnvelopePattern(dcborNumPat);
      const textResult = convertDcborPatternToEnvelopePattern(dcborTextPat);

      expect(boolResult.ok).toBe(true);
      expect(numResult.ok).toBe(true);
      expect(textResult.ok).toBe(true);

      if (!boolResult.ok || !numResult.ok || !textResult.ok) return;

      // Check that toString() produces non-empty strings
      const boolStr = boolResult.value.toString();
      const numStr = numResult.value.toString();
      const textStr = textResult.value.toString();

      expect(boolStr.length).toBeGreaterThan(0);
      expect(numStr.length).toBeGreaterThan(0);
      expect(textStr.length).toBeGreaterThan(0);
    });
  });
});
