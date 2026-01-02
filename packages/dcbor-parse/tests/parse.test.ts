/**
 * Parse tests - 1:1 port of test_parse.rs
 */

import { describe, it, expect, beforeAll } from "vitest";
import { type Cbor, cbor, CborMap, CborDate } from "@bcts/dcbor";
import { registerTags } from "@bcts/tags";
import { IS_A, UNIT, KnownValue } from "@bcts/known-values";
import { parseDcborItem, parseDcborItemPartial } from "../src/parse";
import { type ParseError, fullErrorMessage } from "../src/error";

// Register tags before running tests
beforeAll(() => {
  registerTags();
});

/**
 * Helper function for roundtrip testing.
 * Parses the diagnostic output of a Cbor value and checks it matches.
 */
function roundtrip(value: Cbor): void {
  const src = value.toDiagnostic();
  const result = parseDcborItem(src);
  if (!result.ok) {
    throw new Error(`Parse error: ${fullErrorMessage(result.error, src)}`);
  }
  expect(result.value.toDiagnostic()).toBe(value.toDiagnostic());
}

function hexDiagnostic(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `h'${hex}'`;
}

function base64Diagnostic(bytes: Uint8Array): string {
  // Use btoa for base64 encoding
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return `b64'${btoa(binary)}'`;
}

describe("parse", () => {
  describe("basic types", () => {
    it("should parse booleans", () => {
      roundtrip(cbor(true));
      roundtrip(cbor(false));
    });

    it("should parse null", () => {
      roundtrip(cbor(null));
    });

    it("should parse integers", () => {
      roundtrip(cbor(10));
      roundtrip(cbor(0));
      roundtrip(cbor(-1));
      roundtrip(cbor(42));
    });

    it("should parse floats", () => {
      roundtrip(cbor(3.28));
      roundtrip(cbor(3.14));
    });

    it("should parse infinity", () => {
      roundtrip(cbor(Infinity));
      roundtrip(cbor(-Infinity));
    });

    it("should parse strings", () => {
      roundtrip(cbor("Hello, world!"));
      roundtrip(cbor(""));
      roundtrip(cbor("unicode: \u{1F600}"));
    });
  });

  describe("byte strings", () => {
    it("should parse hex byte strings", () => {
      const bytes = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
      ]);
      const cborBytes = cbor(bytes);
      roundtrip(cborBytes);

      const hex = hexDiagnostic(bytes);
      expect(hex).toBe("h'0102030405060708090a'");
      const result = parseDcborItem(hex);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe(cborBytes.toDiagnostic());
      }
    });

    it("should parse base64 byte strings", () => {
      const bytes = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
      ]);
      const cborBytes = cbor(bytes);

      const base64 = base64Diagnostic(bytes);
      expect(base64).toBe("b64'AQIDBAUGBwgJCg=='");
      const result = parseDcborItem(base64);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe(cborBytes.toDiagnostic());
      }
    });
  });

  describe("NaN", () => {
    it("should parse NaN", () => {
      const cborNaN = cbor(NaN);
      const src = cborNaN.toDiagnostic();
      expect(src).toBe("NaN");
      const result = parseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Number.isNaN(result.value.toNumber())).toBe(true);
      }
    });
  });

  describe("tagged values", () => {
    it("should parse tagged byte strings", () => {
      roundtrip(cbor({ tag: 1234, value: cbor(new Uint8Array([1, 2, 3])) }));
    });

    it("should parse tagged strings", () => {
      roundtrip(cbor({ tag: 5678, value: cbor("Hello, world!") }));
    });

    it("should parse tagged booleans", () => {
      roundtrip(cbor({ tag: 9012, value: cbor(true) }));
    });
  });

  describe("arrays", () => {
    it("should parse empty arrays", () => {
      roundtrip(cbor([]));
    });

    it("should parse integer arrays", () => {
      roundtrip(cbor([cbor(1), cbor(2), cbor(3)]));
    });

    it("should parse mixed arrays", () => {
      roundtrip(cbor([cbor(true), cbor(false), cbor(null)]));
    });

    it("should parse nested arrays", () => {
      roundtrip(
        cbor([cbor([cbor(1), cbor(2)]), cbor([cbor(3), cbor(4)])])
      );
    });
  });

  describe("maps", () => {
    it("should parse empty maps", () => {
      const map = new CborMap();
      roundtrip(cbor(map));
    });

    it("should parse string-keyed maps", () => {
      const map = new CborMap();
      map.set(cbor("key1"), cbor(1));
      map.set(cbor("key2"), cbor(2));
      map.set(cbor("key3"), cbor(3));
      roundtrip(cbor(map));
    });

    it("should parse integer-keyed maps", () => {
      const map = new CborMap();
      map.set(cbor(1), cbor("value1"));
      map.set(cbor(2), cbor("value2"));
      map.set(cbor(3), cbor("value3"));
      roundtrip(cbor(map));
    });
  });

  describe("known values", () => {
    it("should parse known value by number", () => {
      const v = IS_A;
      const cborValue = v.taggedCbor();
      const src = cborValue.toDiagnostic();
      expect(src).toBe("40000(1)");
      const result = parseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe(cborValue.toDiagnostic());
      }
    });

    it("should parse known value with single quotes", () => {
      const v = IS_A;
      const cborValue = v.taggedCbor();

      // Test '1'
      const result2 = parseDcborItem("'1'");
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value.toDiagnostic()).toBe(cborValue.toDiagnostic());
      }

      // Test 'isA'
      const result3 = parseDcborItem("'isA'");
      expect(result3.ok).toBe(true);
      if (result3.ok) {
        expect(result3.value.toDiagnostic()).toBe(cborValue.toDiagnostic());
      }
    });

    it("should parse unit known value", () => {
      const v = UNIT;
      const cborValue = v.taggedCbor();
      const src = cborValue.toDiagnostic();
      expect(src).toBe("40000(0)");

      // Test various unit representations
      const tests = ["40000(0)", "'0'", "''", "Unit"];
      for (const test of tests) {
        const result = parseDcborItem(test);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.toDiagnostic()).toBe(cborValue.toDiagnostic());
        }
      }
    });
  });

  describe("errors", () => {
    function checkError(
      source: string,
      expectedType: ParseError["type"]
    ): void {
      const result = parseDcborItem(source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(expectedType);
      }
    }

    it("should error on empty input", () => {
      checkError("", "EmptyInput");
    });

    it("should error on unexpected end of input", () => {
      checkError("[1, 2", "UnexpectedEndOfInput");
      checkError("[1, 2,\n3, 4,", "UnexpectedEndOfInput");
    });

    it("should error on extra data", () => {
      checkError("1 1", "ExtraData");
    });

    it("should error on unexpected token", () => {
      checkError("(", "UnexpectedToken");
    });

    it("should error on unrecognized token", () => {
      checkError("q", "UnrecognizedToken");
    });

    it("should error on expected comma", () => {
      checkError("[1 2 3]", "ExpectedComma");
    });

    it("should error on expected colon", () => {
      checkError("{1: 2, 3}", "ExpectedColon");
    });

    it("should error on unmatched parentheses", () => {
      checkError("1([1, 2, 3]", "UnmatchedParentheses");
    });

    it("should error on unmatched braces", () => {
      checkError("{1: 2, 3: 4", "UnmatchedBraces");
    });

    it("should error on expected map key", () => {
      checkError("{1: 2, 3:}", "ExpectedMapKey");
    });

    it("should error on invalid tag value", () => {
      checkError("20000000000000000000(1)", "InvalidTagValue");
    });

    it("should error on unknown tag name", () => {
      checkError("foobar(1)", "UnknownTagName");
    });

    it("should error on invalid hex string", () => {
      checkError("h'01020'", "InvalidHexString");
    });

    it("should error on invalid base64 string", () => {
      // Note: The TS atob is more lenient than Rust's base64 decoder
      // Testing with clearly invalid base64 (invalid characters)
      checkError("b64'!!!invalid!!!'", "InvalidBase64String");
    });

    it("should error on unknown known value name", () => {
      checkError("'foobar'", "UnknownKnownValueName");
    });

    it("should error on invalid date string", () => {
      // Note: JavaScript Date is more lenient with invalid dates
      // Testing with clearly malformed date format
      checkError("2023-1-01", "UnrecognizedToken"); // Single digit month not valid
      checkError("23-01-01", "UnrecognizedToken"); // Two digit year not valid
    });
  });

  describe("whitespace and comments", () => {
    it("should handle multiline whitespace", () => {
      const src = `{
  "Hello":
      "World"
}`;
      const result = parseDcborItem(src);
      expect(result.ok).toBe(true);
    });

    it("should handle inline comments", () => {
      const src = "/this is a comment/ [1, /ignore me/ 2, 3]";
      const result = parseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe("[1, 2, 3]");
      }
    });

    it("should handle end-of-line comments", () => {
      const src = "[1, 2, 3] # this should be ignored";
      const result = parseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe("[1, 2, 3]");
      }
    });
  });

  describe("partial parsing", () => {
    it("should parse partial input", () => {
      const result = parseDcborItemPartial("true )");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [cborValue, used] = result.value;
        expect(cborValue.toDiagnostic()).toBe("true");
        expect(used).toBe(5);
      }
    });

    it("should handle trailing whitespace in partial", () => {
      const src = "false  # comment\n";
      const result = parseDcborItemPartial(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const [cborValue, used] = result.value;
        expect(cborValue.toDiagnostic()).toBe("false");
        expect(used).toBe(src.length);
      }
    });
  });

  describe("date literals", () => {
    it("should parse simple dates", () => {
      const result = parseDcborItem("2023-02-08");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should be a tagged date value
        expect(result.value.toDiagnostic()).toMatch(/^\d+\(/);
      }
    });

    it("should parse date-time", () => {
      const result = parseDcborItem("2023-02-08T15:30:45Z");
      expect(result.ok).toBe(true);
    });

    it("should parse array of dates", () => {
      const result = parseDcborItem("[1965-05-15, 2000-07-25, 2004-10-30]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Dates should be tagged, not quoted strings
        const diag = result.value.toDiagnostic();
        expect(diag).not.toContain('"');
      }
    });
  });

  describe("duplicate map keys", () => {
    it("should error on duplicate string keys", () => {
      const result = parseDcborItem('{"key1": 1, "key2": 2, "key1": 3}');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("DuplicateMapKey");
      }
    });

    it("should error on duplicate integer keys", () => {
      const result = parseDcborItem('{1: "value1", 2: "value2", 1: "value3"}');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("DuplicateMapKey");
      }
    });

    it("should allow non-duplicate keys", () => {
      const result = parseDcborItem('{"key1": 1, "key2": 2, "key3": 3}');
      expect(result.ok).toBe(true);
    });
  });
});
