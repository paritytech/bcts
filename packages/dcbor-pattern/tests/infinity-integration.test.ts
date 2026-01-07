/**
 * Infinity pattern integration tests for dCBOR patterns.
 * Ported from bc-dcbor-pattern-rust/tests/infinity_integration_test.rs
 */

import { describe, it, expect } from "vitest";
import { cbor } from "@bcts/dcbor";
import { parse, patternDisplay, patternMatches } from "../src";

describe("infinity pattern integration", () => {
  it("should parse and match infinity patterns", () => {
    // Test parsing and matching of infinity patterns

    // Parse Infinity pattern
    const infResult = parse("Infinity");
    expect(infResult.ok).toBe(true);
    if (infResult.ok) {
      expect(patternDisplay(infResult.value)).toBe("Infinity");
    }

    // Parse -Infinity pattern
    const negInfResult = parse("-Infinity");
    expect(negInfResult.ok).toBe(true);
    if (negInfResult.ok) {
      expect(patternDisplay(negInfResult.value)).toBe("-Infinity");
    }

    // Create CBOR values
    const infCbor = cbor(Infinity);
    const negInfCbor = cbor(-Infinity);
    const nanCbor = cbor(NaN);
    const regularCbor = cbor(42.0);

    // Test positive infinity pattern matching
    if (infResult.ok) {
      expect(patternMatches(infResult.value, infCbor)).toBe(true);
      expect(patternMatches(infResult.value, negInfCbor)).toBe(false);
      expect(patternMatches(infResult.value, nanCbor)).toBe(false);
      expect(patternMatches(infResult.value, regularCbor)).toBe(false);
    }

    // Test negative infinity pattern matching
    if (negInfResult.ok) {
      expect(patternMatches(negInfResult.value, infCbor)).toBe(false);
      expect(patternMatches(negInfResult.value, negInfCbor)).toBe(true);
      expect(patternMatches(negInfResult.value, nanCbor)).toBe(false);
      expect(patternMatches(negInfResult.value, regularCbor)).toBe(false);
    }

    // Test parsing still works for NaN
    const nanResult = parse("NaN");
    expect(nanResult.ok).toBe(true);
    if (nanResult.ok) {
      expect(patternDisplay(nanResult.value)).toBe("NaN");
      expect(patternMatches(nanResult.value, infCbor)).toBe(false);
      expect(patternMatches(nanResult.value, negInfCbor)).toBe(false);
      expect(patternMatches(nanResult.value, nanCbor)).toBe(true);
      expect(patternMatches(nanResult.value, regularCbor)).toBe(false);
    }
  });
});
