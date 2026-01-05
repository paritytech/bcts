/**
 * @bcts/envelope-pattern - Leaf Parsing Tests
 *
 * Tests for parsing leaf patterns: bool, number, text, bytestring, array, map, etc.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust parse_tests_leaf.rs
 */

import { describe, it, expect } from "vitest";
import { parse } from "../src";

describe("Leaf Parsing Tests", () => {
  describe("Boolean Patterns", () => {
    it("parses any bool pattern", () => {
      const result = parse("bool");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses true pattern", () => {
      const result = parse("true");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses false pattern", () => {
      const result = parse("false");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });
  });

  describe("Text Patterns", () => {
    it("parses any text pattern", () => {
      const result = parse("text");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses quoted text pattern", () => {
      const result = parse('"hello"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses text regex pattern", () => {
      const result = parse("/h.*o/");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses text with spaces", () => {
      const result = parse('"hello world"');
      expect(result.ok).toBe(true);
    });

    it("parses text with escaped quotes", () => {
      const result = parse('"say \\"hello\\""');
      expect(result.ok).toBe(true);
    });
  });

  describe("Number Patterns", () => {
    it("parses any number pattern", () => {
      const result = parse("number");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses integer pattern", () => {
      const result = parse("42");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses float pattern", () => {
      const result = parse("3.75");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses number range pattern", () => {
      const result = parse("1...3");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses greater than pattern", () => {
      const result = parse(">5");
      expect(result.ok).toBe(true);
    });

    it("parses greater than or equal pattern", () => {
      const result = parse(">=5");
      expect(result.ok).toBe(true);
    });

    it("parses less than pattern", () => {
      const result = parse("<5");
      expect(result.ok).toBe(true);
    });

    it("parses less than or equal pattern", () => {
      const result = parse("<=5");
      expect(result.ok).toBe(true);
    });

    it("parses NaN pattern", () => {
      const result = parse("NaN");
      expect(result.ok).toBe(true);
    });

    it("parses Infinity pattern", () => {
      const result = parse("Infinity");
      expect(result.ok).toBe(true);
    });

    it("parses negative Infinity pattern", () => {
      const result = parse("-Infinity");
      expect(result.ok).toBe(true);
    });

    it("parses negative number pattern", () => {
      const result = parse("-42");
      expect(result.ok).toBe(true);
    });
  });

  describe("Leaf Structure Pattern", () => {
    it("parses leaf pattern", () => {
      const result = parse("leaf");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Structure");
      }
    });
  });

  describe("Array Patterns", () => {
    it("parses any array pattern", () => {
      const result = parse("array");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses array with count pattern", () => {
      const result = parse("[{3}]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses array with range pattern", () => {
      const result = parse("[{2,4}]");
      expect(result.ok).toBe(true);
    });

    it("parses array with minimum count pattern", () => {
      const result = parse("[{2,}]");
      expect(result.ok).toBe(true);
    });
  });

  describe("ByteString Patterns", () => {
    it("parses any bytestring pattern", () => {
      const result = parse("bstr");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses hex bytestring pattern", () => {
      const result = parse("h'0102'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses bytestring regex pattern", () => {
      const result = parse("h'/abc/'");
      expect(result.ok).toBe(true);
    });
  });

  describe("Date Patterns", () => {
    it("parses any date pattern", () => {
      const result = parse("date");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses specific date pattern", () => {
      const result = parse("date'2023-12-25'");
      expect(result.ok).toBe(true);
    });

    it("parses date range pattern", () => {
      const result = parse("date'2023-12-24...2023-12-26'");
      expect(result.ok).toBe(true);
    });

    it("parses earliest date pattern", () => {
      const result = parse("date'2023-12-24...'");
      expect(result.ok).toBe(true);
    });

    it("parses latest date pattern", () => {
      const result = parse("date'...2023-12-26'");
      expect(result.ok).toBe(true);
    });

    it("parses date regex pattern", () => {
      const result = parse("date'/2023-.*/'");
      expect(result.ok).toBe(true);
    });
  });

  describe("Map Patterns", () => {
    it("parses any map pattern", () => {
      const result = parse("map");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses map with count pattern", () => {
      const result = parse("{{3}}");
      expect(result.ok).toBe(true);
    });

    it("parses map with range pattern", () => {
      const result = parse("{{2,4}}");
      expect(result.ok).toBe(true);
    });

    it("parses map with minimum count pattern", () => {
      const result = parse("{{2,}}");
      expect(result.ok).toBe(true);
    });
  });

  describe("Null Pattern", () => {
    it("parses null pattern", () => {
      const result = parse("null");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });
  });

  describe("Tag Patterns", () => {
    it("parses any tagged pattern", () => {
      const result = parse("tagged");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses tagged with specific tag", () => {
      const result = parse("tagged(100, *)");
      expect(result.ok).toBe(true);
    });

    it("parses tagged with name", () => {
      const result = parse("tagged(date, *)");
      expect(result.ok).toBe(true);
    });

    it("parses tagged with regex", () => {
      const result = parse("tagged(/da.*/, *)");
      expect(result.ok).toBe(true);
    });

    it("parses tagged with array content", () => {
      const result = parse("tagged(100, [number, (number)*])");
      expect(result.ok).toBe(true);
    });

    it("parses tagged with map content", () => {
      const result = parse('tagged(100, { "key": * })');
      expect(result.ok).toBe(true);
    });
  });

  describe("Known Value Patterns", () => {
    it("parses any known value pattern", () => {
      const result = parse("known");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses known value by number", () => {
      const result = parse("'1'");
      expect(result.ok).toBe(true);
    });

    it("parses known value by name", () => {
      const result = parse("'date'");
      expect(result.ok).toBe(true);
    });

    it("parses known value regex", () => {
      const result = parse("'/da.*/'");
      expect(result.ok).toBe(true);
    });
  });

  describe("CBOR Patterns", () => {
    it("parses any cbor pattern", () => {
      const result = parse("cbor");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe("Leaf");
      }
    });

    it("parses cbor with boolean value", () => {
      const result = parse("cbor(true)");
      expect(result.ok).toBe(true);
    });

    it("parses cbor with number value", () => {
      const result = parse("cbor(42)");
      expect(result.ok).toBe(true);
    });

    it("parses cbor with text value", () => {
      const result = parse('cbor("hello")');
      expect(result.ok).toBe(true);
    });

    it("parses cbor with array value", () => {
      const result = parse("cbor([1, 2])");
      expect(result.ok).toBe(true);
    });

    it("parses cbor with map value", () => {
      const result = parse("cbor({1: 2})");
      expect(result.ok).toBe(true);
    });

    it("parses cbor with tagged value", () => {
      const result = parse('cbor(1("t"))');
      expect(result.ok).toBe(true);
    });

    it("parses cbor with array", () => {
      const result = parse("cbor([1, 2, 3])");
      expect(result.ok).toBe(true);
    });

    it("parses cbor with map string keys", () => {
      const result = parse('cbor({"a": 1})');
      expect(result.ok).toBe(true);
    });
  });
});
