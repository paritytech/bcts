/**
 * Runtime functionality tests - port of test_runtime_functionality.rs
 *
 * These tests verify full parser functionality including complex patterns.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { cbor, CborDate, asBytes, asText } from "@bcts/dcbor";
import { registerTags } from "@bcts/tags";
import { parseDcborItem } from "../src/parse";

// Register tags before running tests
beforeAll(() => {
  registerTags();
});

describe("runtime functionality", () => {
  describe("basic functionality preserved", () => {
    it("should parse basic string", () => {
      const result = parseDcborItem('"Hello, World!"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe('"Hello, World!"');
      }
    });

    it("should parse empty string", () => {
      const result = parseDcborItem('""');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe('""');
      }
    });

    it("should parse hex string", () => {
      const result = parseDcborItem("h'deadbeef'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe("h'deadbeef'");
      }
    });

    it("should parse empty hex string", () => {
      const result = parseDcborItem("h''");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toDiagnostic()).toBe("h''");
      }
    });

    it("should parse basic base64", () => {
      const result = parseDcborItem("b64'SGVsbG8='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // "Hello" in base64
        const bytes = asBytes(result.value);
        expect(bytes).toEqual(new TextEncoder().encode("Hello"));
      }
    });

    it("should parse date (date only)", () => {
      const result = parseDcborItem("2023-12-25");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromYmd(2023, 12, 25);
        expect(result.value.toDiagnostic()).toBe(expected.taggedCbor().toDiagnostic());
      }
    });

    it("should parse basic array", () => {
      const result = parseDcborItem("[\"hello\", h'dead', 42]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const arr = result.value.toArray();
        expect(arr.length).toBe(3);
        expect(arr[0].toDiagnostic()).toBe('"hello"');
        expect(arr[1].toDiagnostic()).toBe("h'dead'");
        expect(arr[2].toDiagnostic()).toBe("42");
      }
    });

    it("should parse basic map", () => {
      const result = parseDcborItem('{"key": "value", "number": 123}');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const map = result.value.toMap();
        expect(map.has(cbor("key"))).toBe(true);
        expect(map.has(cbor("number"))).toBe(true);
      }
    });
  });

  describe("basic patterns compilation", () => {
    it("should parse all basic token types", () => {
      const inputs = [
        '"simple"',
        "h'ff'",
        "b64'QUE='",
        "2023-01-01",
        "42",
        "true",
        "false",
        "null",
        "[1, 2, 3]",
        '{"a": 1}',
      ];

      for (const input of inputs) {
        const result = parseDcborItem(input);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("hex parsing comprehensive", () => {
    it("should parse empty hex string", () => {
      const result = parseDcborItem("h''");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([]));
      }
    });

    it("should parse single byte hex", () => {
      const result = parseDcborItem("h'FF'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xff]));
      }
    });

    it("should parse lowercase hex", () => {
      const result = parseDcborItem("h'deadbeef'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      }
    });

    it("should parse uppercase hex", () => {
      const result = parseDcborItem("h'DEADBEEF'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      }
    });

    it("should parse mixed case hex", () => {
      const result = parseDcborItem("h'DeAdBeEf'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      }
    });
  });

  describe("complex string escapes", () => {
    it("should parse string with escaped quotes", () => {
      const result = parseDcborItem('"She said \\"Hello\\""');
      expect(result.ok).toBe(true);
      if (result.ok) {
        // The parser stores literal escape sequences
        const text = asText(result.value);
        expect(text).toBe('She said \\"Hello\\"');
      }
    });

    it("should parse string with backslash escapes", () => {
      const result = parseDcborItem('"Path\\\\to\\\\file"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const text = asText(result.value);
        expect(text).toBe("Path\\\\to\\\\file");
      }
    });

    it("should parse string with escape sequences", () => {
      const result = parseDcborItem('"Line 1\\nLine 2\\tTabbed"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Parser stores literal backslash-n, not newline
        const text = asText(result.value);
        expect(text).toContain("\\n");
        expect(text).toContain("\\t");
      }
    });

    it("should parse string with unicode escapes", () => {
      const result = parseDcborItem('"Unicode: \\u0041\\u0042\\u0043"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Parser stores literal unicode escapes
        const text = asText(result.value);
        expect(text).toContain("\\u0041");
      }
    });

    it("should parse valid escape sequence", () => {
      const result = parseDcborItem('"Valid escape: \\""');
      expect(result.ok).toBe(true);
    });

    it("should parse valid unicode escape", () => {
      const result = parseDcborItem('"Valid unicode: \\u1234"');
      expect(result.ok).toBe(true);
    });
  });

  describe("complex date formats", () => {
    it("should parse date with timezone Z", () => {
      const result = parseDcborItem("2023-12-25T10:30:45Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45Z");
        expect(result.value.toDiagnostic()).toBe(expected.taggedCbor().toDiagnostic());
      }
    });

    it("should parse date with positive timezone offset", () => {
      const result = parseDcborItem("2023-12-25T10:30:45+05:30");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45+05:30");
        expect(result.value.toDiagnostic()).toBe(expected.taggedCbor().toDiagnostic());
      }
    });

    it("should parse date with negative timezone offset", () => {
      const result = parseDcborItem("2023-12-25T10:30:45-08:00");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45-08:00");
        expect(result.value.toDiagnostic()).toBe(expected.taggedCbor().toDiagnostic());
      }
    });

    it("should parse date with milliseconds", () => {
      const result = parseDcborItem("2023-12-25T10:30:45.123Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45.123Z");
        expect(result.value.toDiagnostic()).toBe(expected.taggedCbor().toDiagnostic());
      }
    });

    it("should parse date with microseconds", () => {
      const result = parseDcborItem("2023-12-25T10:30:45.123456Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45.123456Z");
        expect(result.value.toDiagnostic()).toBe(expected.taggedCbor().toDiagnostic());
      }
    });
  });

  describe("base64 requirements", () => {
    it("should parse base64 with minimum 2-character requirement", () => {
      const result = parseDcborItem("b64'QQ=='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0x41])); // 'A'
      }
    });

    it("should parse longer base64 strings", () => {
      const result = parseDcborItem("b64'SGVsbG8gV29ybGQ='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new TextEncoder().encode("Hello World"));
      }
    });

    it("should parse base64 without padding", () => {
      const result = parseDcborItem("b64'SGVsbG8='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new TextEncoder().encode("Hello"));
      }
    });
  });

  describe("complex mixed patterns", () => {
    it("should parse complex array with various types", () => {
      const complexArray = `[
        "String with \\"quotes\\" and \\\\n newlines",
        h'deadbeef',
        b64'SGVsbG8gV29ybGQ=',
        2023-12-25T10:30:45.123Z,
        "Unicode: \\\\u0041\\\\u0042\\\\u0043"
      ]`;

      const result = parseDcborItem(complexArray);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const array = result.value.toArray();
        expect(array.length).toBe(5);

        // Verify hex bytes
        expect(asBytes(array[1])).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));

        // Verify base64 bytes
        expect(asBytes(array[2])).toEqual(new TextEncoder().encode("Hello World"));

        // Verify date
        const expectedDate = CborDate.fromString("2023-12-25T10:30:45.123Z");
        expect(array[3].toDiagnostic()).toBe(expectedDate.taggedCbor().toDiagnostic());
      }
    });

    it("should parse complex map with various types", () => {
      const complexMap = `{
        "message": "Hello \\"World\\" with \\n newlines",
        "data": h'0123456789abcdef',
        "timestamp": 2023-12-25T10:30:45-08:00
      }`;

      const result = parseDcborItem(complexMap);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const map = result.value.toMap();
        expect(map.has(cbor("message"))).toBe(true);
        expect(map.has(cbor("data"))).toBe(true);
        expect(map.has(cbor("timestamp"))).toBe(true);
      }
    });
  });

  describe("base64 minimum length enforcement", () => {
    it("should reject empty base64", () => {
      const result = parseDcborItem("b64''");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidBase64String");
      }
    });

    it("should reject single character base64", () => {
      const result = parseDcborItem("b64'A'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidBase64String");
      }
    });
  });

  describe("date with fractional seconds", () => {
    it("should parse date with fractional seconds", () => {
      const result = parseDcborItem("2023-12-25T12:30:45.123Z");
      expect(result.ok).toBe(true);
    });
  });

  describe("date with timezone offset", () => {
    it("should parse date with timezone offset", () => {
      const result = parseDcborItem("2023-12-25T12:30:45+05:30");
      expect(result.ok).toBe(true);
    });
  });

  describe("string with control characters rejected", () => {
    it("should reject strings with control characters", () => {
      // String containing control character \x01
      const input = '"hello\x01world"';
      const result = parseDcborItem(input);
      expect(result.ok).toBe(false);
    });
  });

  describe("string with unescaped quotes rejected", () => {
    it("should reject strings with unescaped quotes", () => {
      // Contains unescaped quote in middle
      const input = '"hello"world"';
      const result = parseDcborItem(input);
      expect(result.ok).toBe(false);
    });
  });

  describe("runtime pattern validation", () => {
    it("should validate complex date with microseconds and timezone", () => {
      const result = parseDcborItem("2023-12-25T10:30:45.123456Z");
      expect(result.ok).toBe(true);
    });

    it("should validate string with valid escape sequences", () => {
      const result = parseDcborItem('"line1\\nline2\\ttab\\u0041end"');
      expect(result.ok).toBe(true);
    });

    it("should validate proper base64", () => {
      const result = parseDcborItem("b64'SGVsbG8gV29ybGQ='");
      expect(result.ok).toBe(true);
    });

    it("should validate complex mixed input", () => {
      const complexInput = `{
        "message": "Hello\\nWorld",
        "data": b64'SGVsbG8=',
        "timestamp": 2023-12-25T10:30:45.123Z,
        "binary": h'deadbeef'
      }`;
      const result = parseDcborItem(complexInput);
      expect(result.ok).toBe(true);
    });
  });
});
