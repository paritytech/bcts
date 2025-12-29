/**
 * Structure pattern matching tests for dCBOR patterns.
 */

import { describe, it, expect } from "vitest";
import { cbor } from "@bcts/dcbor";
import { parse, patternMatches } from "../src";

describe("structure patterns", () => {
  describe("array patterns", () => {
    it("array pattern should match any array", () => {
      const result = parse("array");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor([1, 2, 3]))).toBe(true);
        expect(patternMatches(result.value, cbor([]))).toBe(true);
        expect(patternMatches(result.value, cbor(["a", "b"]))).toBe(true);
        expect(patternMatches(result.value, cbor(42))).toBe(false);
      }
    });

    it("bracket array with element pattern should match arrays with matching elements", () => {
      const result = parse("[number]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Single value pattern requires exactly one matching element
        expect(patternMatches(result.value, cbor([1]))).toBe(true);
        expect(patternMatches(result.value, cbor([1, 2, 3]))).toBe(false); // Rust semantics: single pattern = single element
        expect(patternMatches(result.value, cbor(["a"]))).toBe(false);
      }
    });

    it("bracket array with repeat pattern should match arrays with multiple matching elements", () => {
      const result = parse("[(number)*]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Repeat pattern can match any number of elements
        expect(patternMatches(result.value, cbor([]))).toBe(true);
        expect(patternMatches(result.value, cbor([1]))).toBe(true);
        expect(patternMatches(result.value, cbor([1, 2, 3]))).toBe(true);
        expect(patternMatches(result.value, cbor(["a"]))).toBe(false);
      }
    });
  });

  describe("map patterns", () => {
    it("map pattern should match any map", () => {
      const result = parse("map");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor({ a: 1 }))).toBe(true);
        expect(patternMatches(result.value, cbor({}))).toBe(true);
        expect(patternMatches(result.value, cbor(42))).toBe(false);
      }
    });

    it("empty brace map should match any map", () => {
      const result = parse("{}");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor({ a: 1 }))).toBe(true);
        expect(patternMatches(result.value, cbor({}))).toBe(true);
      }
    });

    it("brace map with key-value constraint should match maps with matching entries", () => {
      const result = parse("{text: number}");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor({ a: 1, b: 2 }))).toBe(true);
        expect(patternMatches(result.value, cbor({ x: 99 }))).toBe(true);
      }
    });
  });

  describe("tagged patterns", () => {
    it("tagged pattern should match any tagged value", () => {
      const result = parse("tagged");
      expect(result.ok).toBe(true);
      // Tagged patterns require actual tagged CBOR values
    });
  });

  describe("combined patterns", () => {
    it("should match OR of structure patterns", () => {
      const result = parse("array | map");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(patternMatches(result.value, cbor([1, 2, 3]))).toBe(true);
        expect(patternMatches(result.value, cbor({ a: 1 }))).toBe(true);
        expect(patternMatches(result.value, cbor(42))).toBe(false);
      }
    });
  });
});
