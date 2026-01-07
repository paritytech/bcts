/**
 * Error position reporting tests for dCBOR patterns.
 *
 * Tests that parse errors report the correct positions in the input string.
 * Ported from bc-dcbor-pattern-rust/tests/test_error_positions.rs
 */

import { describe, it, expect } from "vitest";
import { parse } from "../src";

describe("error positions", () => {
  it("should report correct error position for tagged patterns", () => {
    // This should fail and report the correct position of FOO (at position 14)
    const patternStr = "tagged(12345, FOO)";
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The FOO token starts at position 14 in "tagged(12345, FOO)"
        // 0123456789012345
        const expectedStart = 14;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });

  it("should report correct error position for array patterns", () => {
    // This should fail and report the correct position of BAR
    const patternStr = "[number, BAR]";
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The BAR token starts at position 9 in "[number, BAR]"
        //                                     0123456789012
        const expectedStart = 9;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });

  it("should report correct error position for map pattern key errors", () => {
    // This should fail and report the correct position of FOO as a key
    const patternStr = "{FOO: number}";
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The FOO token starts at position 1 in "{FOO: number}"
        //                                     0123456789012
        const expectedStart = 1;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });

  it("should report correct error position for map pattern value errors", () => {
    // This should fail and report the correct position of FOO as a value
    const patternStr = "{text: FOO}";
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The FOO token starts at position 7 in "{text: FOO}"
        //                                     0123456789
        const expectedStart = 7;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });

  it("should report correct error position for second constraint key errors", () => {
    // This should fail and report the correct position of FOO in the second constraint
    const patternStr = "{text: *, FOO: number}";
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The FOO token starts at position 10 in "{text: *, FOO: number}"
        // 01234567890123456789012
        const expectedStart = 10;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });

  it("should report correct error position for second constraint value errors", () => {
    // This should fail and report the correct position of FOO in the second constraint value
    const patternStr = "{bool: bstr, *: FOO}";
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The FOO token starts at position 16 in "{bool: bstr, *: FOO}"
        // 0123456789012345678901
        const expectedStart = 16;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });

  it("should report correct error position for complex map patterns", () => {
    // Test with multiple constraints and error in the middle
    const patternStr = '{"name": text, "age": number, BAD: *, "email": text}';
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The BAD token starts at position 30 in the pattern
        // {"name": text, "age": number, BAD: *, "email": text}
        //  01234567890123456789012345678901234567890123456789012
        const expectedStart = 30;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });

  it("should report correct error position for nested map pattern errors", () => {
    // Test error inside a nested structure within a map
    const patternStr = '{"data": [number, INVALID], "id": number}';
    const result = parse(patternStr);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UnrecognizedToken");
      if (result.error.type === "UnrecognizedToken") {
        // The INVALID token starts at position 18 in the pattern
        // {"data": [number, INVALID], "id": number}
        //  012345678901234567890123456789012345678901
        const expectedStart = 18;
        expect(result.error.span.start).toBe(expectedStart);
      }
    }
  });
});
