/**
 * Value pattern tests ported from pattern_tests_value.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  assertActualExpected,
  getPaths,
  matches,
  formatPathsStr,
  display,
} from "./common";

describe("value pattern tests", () => {
  describe("bool patterns", () => {
    it("test_bool_pattern_any", () => {
      const pattern = parse("bool");

      // Should match true
      const trueCbor = cbor(true);
      const paths = getPaths(pattern, trueCbor);
      assertActualExpected(formatPathsStr(paths), "true");

      // Should match false
      const falseCbor = cbor(false);
      const paths2 = getPaths(pattern, falseCbor);
      assertActualExpected(formatPathsStr(paths2), "false");

      // Should not match non-boolean
      const numberCbor = cbor(42);
      expect(matches(pattern, numberCbor)).toBe(false);
    });

    it("test_bool_pattern_specific", () => {
      const truePattern = parse("true");
      const falsePattern = parse("false");

      const trueCbor = cbor(true);
      const falseCbor = cbor(false);
      const numberCbor = cbor(42);

      // true pattern tests
      const paths = getPaths(truePattern, trueCbor);
      assertActualExpected(formatPathsStr(paths), "true");

      expect(matches(truePattern, falseCbor)).toBe(false);
      expect(matches(truePattern, numberCbor)).toBe(false);

      // false pattern tests
      expect(matches(falsePattern, trueCbor)).toBe(false);
      const paths2 = getPaths(falsePattern, falseCbor);
      assertActualExpected(formatPathsStr(paths2), "false");

      expect(matches(falsePattern, numberCbor)).toBe(false);
    });

    it("test_bool_pattern_display", () => {
      expect(display(parse("bool"))).toBe("bool");
      expect(display(parse("true"))).toBe("true");
      expect(display(parse("false"))).toBe("false");
    });
  });

  describe("text patterns", () => {
    it("test_text_pattern_any", () => {
      const pattern = parse("text");

      // Should match any text
      const helloCbor = cbor("Hello");
      const paths = getPaths(pattern, helloCbor);
      assertActualExpected(formatPathsStr(paths), '"Hello"');

      const emptyCbor = cbor("");
      const paths2 = getPaths(pattern, emptyCbor);
      assertActualExpected(formatPathsStr(paths2), '""');

      // Should not match non-text
      const numberCbor = cbor(42);
      expect(matches(pattern, numberCbor)).toBe(false);
    });

    it("test_text_pattern_specific", () => {
      const helloPattern = parse('"Hello"');
      const worldPattern = parse('"World"');

      const helloCbor = cbor("Hello");
      const worldCbor = cbor("World");
      const numberCbor = cbor(42);

      // hello pattern tests
      const paths = getPaths(helloPattern, helloCbor);
      assertActualExpected(formatPathsStr(paths), '"Hello"');

      expect(matches(helloPattern, worldCbor)).toBe(false);
      expect(matches(helloPattern, numberCbor)).toBe(false);

      // world pattern tests
      expect(matches(worldPattern, helloCbor)).toBe(false);
      const paths2 = getPaths(worldPattern, worldCbor);
      assertActualExpected(formatPathsStr(paths2), '"World"');

      expect(matches(worldPattern, numberCbor)).toBe(false);
    });

    it("test_text_pattern_display", () => {
      expect(display(parse("text"))).toBe("text");
      expect(display(parse('"Hello"'))).toBe('"Hello"');
    });
  });

  describe("number patterns", () => {
    it("test_number_pattern_any", () => {
      const pattern = parse("number");

      // Should match integers
      const intCbor = cbor(42);
      const paths = getPaths(pattern, intCbor);
      assertActualExpected(formatPathsStr(paths), "42");

      // Should match floats
      const floatCbor = cbor(3.2222);
      const paths2 = getPaths(pattern, floatCbor);
      assertActualExpected(formatPathsStr(paths2), "3.2222");

      // Should match negative numbers
      const negCbor = cbor(-5);
      const paths3 = getPaths(pattern, negCbor);
      assertActualExpected(formatPathsStr(paths3), "-5");

      // Should not match non-numbers
      const textCbor = cbor("42");
      expect(matches(pattern, textCbor)).toBe(false);
    });

    it("test_number_pattern_specific", () => {
      const intPattern = parse("42");
      const floatPattern = parse("3.2222");

      const intCbor = cbor(42);
      const floatCbor = cbor(3.2222);
      const differentIntCbor = cbor(24);
      const textCbor = cbor("42");

      // int pattern tests
      const paths = getPaths(intPattern, intCbor);
      assertActualExpected(formatPathsStr(paths), "42");

      expect(matches(intPattern, floatCbor)).toBe(false);
      expect(matches(intPattern, differentIntCbor)).toBe(false);
      expect(matches(intPattern, textCbor)).toBe(false);

      // float pattern tests
      expect(matches(floatPattern, intCbor)).toBe(false);
      const paths2 = getPaths(floatPattern, floatCbor);
      assertActualExpected(formatPathsStr(paths2), "3.2222");

      expect(matches(floatPattern, textCbor)).toBe(false);
    });

    it("test_number_pattern_range", () => {
      const rangePattern = parse("10..20");

      const inRangeCbor = cbor(15);
      const boundaryLowCbor = cbor(10);
      const boundaryHighCbor = cbor(20);
      const belowRangeCbor = cbor(5);
      const aboveRangeCbor = cbor(25);
      const textCbor = cbor("15");

      // Should match numbers in range
      const paths = getPaths(rangePattern, inRangeCbor);
      assertActualExpected(formatPathsStr(paths), "15");

      const paths2 = getPaths(rangePattern, boundaryLowCbor);
      assertActualExpected(formatPathsStr(paths2), "10");

      const paths3 = getPaths(rangePattern, boundaryHighCbor);
      assertActualExpected(formatPathsStr(paths3), "20");

      // Should not match numbers outside range
      expect(matches(rangePattern, belowRangeCbor)).toBe(false);
      expect(matches(rangePattern, aboveRangeCbor)).toBe(false);
      expect(matches(rangePattern, textCbor)).toBe(false);
    });

    it("test_number_pattern_comparisons", () => {
      const gtPattern = parse(">10");
      const gtePattern = parse(">=10");
      const ltPattern = parse("<10");
      const ltePattern = parse("<=10");

      const equalCbor = cbor(10);
      const greaterCbor = cbor(15);
      const lesserCbor = cbor(5);

      // Greater than tests
      expect(matches(gtPattern, equalCbor)).toBe(false);
      const paths = getPaths(gtPattern, greaterCbor);
      assertActualExpected(formatPathsStr(paths), "15");
      expect(matches(gtPattern, lesserCbor)).toBe(false);

      // Greater than or equal tests
      const paths2 = getPaths(gtePattern, equalCbor);
      assertActualExpected(formatPathsStr(paths2), "10");
      expect(matches(gtePattern, greaterCbor)).toBe(true);
      expect(matches(gtePattern, lesserCbor)).toBe(false);

      // Less than tests
      expect(matches(ltPattern, equalCbor)).toBe(false);
      expect(matches(ltPattern, greaterCbor)).toBe(false);
      const paths3 = getPaths(ltPattern, lesserCbor);
      assertActualExpected(formatPathsStr(paths3), "5");

      // Less than or equal tests
      expect(matches(ltePattern, equalCbor)).toBe(true);
      expect(matches(ltePattern, greaterCbor)).toBe(false);
      expect(matches(ltePattern, lesserCbor)).toBe(true);
    });

    it("test_number_pattern_nan", () => {
      const nanPattern = parse("NaN");

      const nanCbor = cbor(NaN);
      const numberCbor = cbor(42);
      const textCbor = cbor("NaN");

      // Should match NaN
      const paths = getPaths(nanPattern, nanCbor);
      assertActualExpected(formatPathsStr(paths), "NaN");

      // Should not match regular numbers or text
      expect(matches(nanPattern, numberCbor)).toBe(false);
      expect(matches(nanPattern, textCbor)).toBe(false);
    });

    it("test_number_pattern_display", () => {
      expect(display(parse("number"))).toBe("number");
      expect(display(parse("42"))).toBe("42");
      expect(display(parse("3.2222"))).toBe("3.2222");
      expect(display(parse("10..20"))).toBe("10..20");
      expect(display(parse(">10"))).toBe(">10");
      expect(display(parse(">=10"))).toBe(">=10");
      expect(display(parse("<10"))).toBe("<10");
      expect(display(parse("<=10"))).toBe("<=10");
      expect(display(parse("NaN"))).toBe("NaN");
    });
  });

  describe("bytestring patterns", () => {
    it("test_byte_string_pattern_any", () => {
      const pattern = parse("bstr");

      // Should match any byte string
      const bytesCbor = cbor(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      const paths = getPaths(pattern, bytesCbor);
      assertActualExpected(formatPathsStr(paths), "h'01020304'");

      const emptyCbor = cbor(new Uint8Array([]));
      const paths2 = getPaths(pattern, emptyCbor);
      assertActualExpected(formatPathsStr(paths2), "h''");

      // Should not match non-byte-string
      const textCbor = cbor("hello");
      expect(matches(pattern, textCbor)).toBe(false);
    });

    it("test_byte_string_pattern_specific", () => {
      const exactPattern = parse("h'01020304'");
      const differentPattern = parse("h'0506'");

      const bytesCbor = cbor(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      const differentCbor = cbor(new Uint8Array([0x05, 0x06]));
      const textCbor = cbor("hello");

      // exact pattern tests
      const paths = getPaths(exactPattern, bytesCbor);
      assertActualExpected(formatPathsStr(paths), "h'01020304'");

      expect(matches(exactPattern, differentCbor)).toBe(false);
      expect(matches(exactPattern, textCbor)).toBe(false);

      // different pattern tests
      expect(matches(differentPattern, bytesCbor)).toBe(false);
      const paths2 = getPaths(differentPattern, differentCbor);
      assertActualExpected(formatPathsStr(paths2), "h'0506'");

      expect(matches(differentPattern, textCbor)).toBe(false);
    });

    it("test_byte_string_pattern_display", () => {
      expect(display(parse("bstr"))).toBe("bstr");
      expect(display(parse("h'deadbeef'"))).toBe("h'deadbeef'");
    });
  });

  describe("null patterns", () => {
    it("test_null_pattern", () => {
      const pattern = parse("null");

      // Should match null
      const nullCbor = cbor(null);
      const paths = getPaths(pattern, nullCbor);
      assertActualExpected(formatPathsStr(paths), "null");

      // Should not match non-null values
      const trueCbor = cbor(true);
      expect(matches(pattern, trueCbor)).toBe(false);

      const falseCbor = cbor(false);
      expect(matches(pattern, falseCbor)).toBe(false);

      const numberCbor = cbor(42);
      expect(matches(pattern, numberCbor)).toBe(false);

      const textCbor = cbor("hello");
      expect(matches(pattern, textCbor)).toBe(false);

      const arrayCbor = cbor([1, 2, 3]);
      expect(matches(pattern, arrayCbor)).toBe(false);
    });

    it("test_null_pattern_display", () => {
      expect(display(parse("null"))).toBe("null");
    });
  });

  describe("map patterns with various key types", () => {
    it("test_map_int_keys", () => {
      const mapPattern = parse("{1: text}");
      // JavaScript objects convert keys to strings, so use Map for numeric keys
      const map = new Map<number, string>();
      map.set(1, "first");
      map.set(2, "second");
      const data = cbor(map);
      const paths = getPaths(mapPattern, data);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("test_map_negative_keys", () => {
      const mapPattern = parse("{-1: text}");
      // Note: JavaScript object keys are strings, so we test with Map
      const map = new Map<number, string>();
      map.set(-1, "first");
      map.set(2, "second");
      const data = cbor(map);
      const paths = getPaths(mapPattern, data);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("test_map_bool_keys", () => {
      const mapPattern = parse("{true: text}");
      const map = new Map<boolean, string>();
      map.set(true, "first");
      map.set(false, "second");
      const data = cbor(map);
      const paths = getPaths(mapPattern, data);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("test_map_complex_keys", () => {
      const mapPattern = parse('{"a"|"b": text}');
      const data = cbor({ z: "first", b: "second" });
      const paths = getPaths(mapPattern, data);
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("array patterns", () => {
    it("test_array_complex_elements", () => {
      // OR patterns work in array elements
      const pattern = parse('["a"|"b"]');
      const data = cbor(["b"]);
      const paths = getPaths(pattern, data);
      assertActualExpected(formatPathsStr(paths), '["b"]');

      // OR patterns work with proper precedence
      const sequencePattern = parse('[(1|2), "hello"]');
      const data2 = cbor([2, "hello"]);
      const paths2 = getPaths(sequencePattern, data2);
      assertActualExpected(formatPathsStr(paths2), '[2, "hello"]');

      // OR patterns work after commas in sequences
      const complexPattern = parse('["hello", "a"|"b"]');
      const data3 = cbor(["hello", "b"]);
      const paths3 = getPaths(complexPattern, data3);
      assertActualExpected(formatPathsStr(paths3), '["hello", "b"]');
    });

    it("test_array_or_precedence_issue", () => {
      // The pattern [1|2, "hello"] should be parsed as [(1|2), "hello"]
      const pattern = parse('[1|2, "hello"]');

      const cbor1Hello = cbor([1, "hello"]);
      const cbor2Hello = cbor([2, "hello"]);
      const cbor1Only = cbor([1]);

      // With correct precedence [(1|2), "hello"], we should have:
      expect(matches(pattern, cbor1Hello)).toBe(true);
      expect(matches(pattern, cbor2Hello)).toBe(true);
      expect(matches(pattern, cbor1Only)).toBe(false);
    });
  });
});
