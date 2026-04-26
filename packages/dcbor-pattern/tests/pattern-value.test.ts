/**
 * Value pattern tests ported from pattern_tests_value.rs
 */

import { describe, it, expect } from "vitest";
import { CborDate, registerTags, type Cbor } from "@bcts/dcbor";
import { parseDcborItem } from "@bcts/dcbor-parse";
import { IS_A, DATE } from "@bcts/known-values";
import {
  textRegex,
  byteStringRegex,
  date as datePattern,
  dateRange,
  dateEarliest,
  dateLatest,
  dateIso8601,
  dateRegex,
  knownValue as knownValuePattern,
  knownValueNamed,
  knownValueRegex,
  patternDisplay,
} from "../src";
import {
  cbor,
  parse,
  assertActualExpected,
  getPaths,
  matches,
  formatPathsStr,
  display,
} from "./common";

/**
 * Helper to convert a CborDate to a Cbor tagged value (tag 1).
 */
const dateToCbor = (d: CborDate): Cbor => {
  return d.taggedCbor();
};

/**
 * Helper to parse a CBOR diagnostic notation string into a Cbor object.
 */
const cborFromString = (s: string): Cbor => {
  const result = parseDcborItem(s);
  if (!result.ok) {
    throw new Error(`Failed to parse CBOR: ${s}`);
  }
  return result.value;
};

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

    it("test_text_pattern_regex", () => {
      const digitsPattern = textRegex(/^\d+$/);

      const digitsCbor = cbor("12345");
      const lettersCbor = cbor("Hello");
      const mixedCbor = cbor("Hello123");
      const numberCbor = cbor(42);

      // Should match pure digits
      const paths = getPaths(digitsPattern, digitsCbor);
      assertActualExpected(formatPathsStr(paths), '"12345"');

      // Should not match letters, mixed content, or non-text
      expect(matches(digitsPattern, lettersCbor)).toBe(false);
      expect(matches(digitsPattern, mixedCbor)).toBe(false);
      expect(matches(digitsPattern, numberCbor)).toBe(false);
    });

    it("test_text_pattern_display", () => {
      expect(display(parse("text"))).toBe("text");
      expect(display(parse('"Hello"'))).toBe('"Hello"');

      const regexPattern = textRegex(/^\d+$/);
      expect(patternDisplay(regexPattern)).toBe("/^\\d+$/");
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
      const rangePattern = parse("10...20");

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
      expect(display(parse("10...20"))).toBe("10...20");
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

    it("test_byte_string_pattern_regex", () => {
      // Test with binary data that looks like digits
      const digitsPattern = byteStringRegex(/^\d+$/);

      const digitsCbor = cbor(new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35])); // "12345" in hex
      const lettersCbor = cbor(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])); // "Hello" in hex
      const mixedCbor = cbor(
        new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x31, 0x32, 0x33]),
      ); // "Hello123" in hex
      const textCbor = cbor("12345");

      // Should match byte strings with digits
      const paths = getPaths(digitsPattern, digitsCbor);
      assertActualExpected(formatPathsStr(paths), "h'3132333435'");

      // Should not match letters, mixed content, or text strings
      expect(matches(digitsPattern, lettersCbor)).toBe(false);
      expect(matches(digitsPattern, mixedCbor)).toBe(false);
      expect(matches(digitsPattern, textCbor)).toBe(false);
    });

    it("test_byte_string_pattern_binary_data", () => {
      const pattern = parse("bstr");

      // Test with actual binary data (not text)
      const binaryCbor = cbor(
        new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd]),
      );

      const paths = getPaths(pattern, binaryCbor);
      assertActualExpected(formatPathsStr(paths), "h'00010203fffefd'");

      const exactPattern = parse("h'00010203fffefd'");
      const paths2 = getPaths(exactPattern, binaryCbor);
      assertActualExpected(formatPathsStr(paths2), "h'00010203fffefd'");

      const differentPattern = parse("h'000102'");
      expect(matches(differentPattern, binaryCbor)).toBe(false);

      // Test regex that matches any bytes starting with 0x00
      // eslint-disable-next-line no-control-regex
      const startsWithZeroPattern = byteStringRegex(new RegExp("^\\x00"));
      const paths3 = getPaths(startsWithZeroPattern, binaryCbor);
      assertActualExpected(formatPathsStr(paths3), "h'00010203fffefd'");

      // Test regex that doesn't match
      // eslint-disable-next-line no-control-regex
      const startsWithOnePattern = byteStringRegex(new RegExp("^\\x01"));
      expect(matches(startsWithOnePattern, binaryCbor)).toBe(false);
    });

    it("test_byte_string_pattern_display", () => {
      expect(display(parse("bstr"))).toBe("bstr");
      expect(display(parse("h'deadbeef'"))).toBe("h'deadbeef'");

      const regexPattern = byteStringRegex(/^test.*/);
      expect(patternDisplay(regexPattern)).toBe("h'/^test.*/'");
    });
  });

  describe("date patterns", () => {
    it("test_date_pattern_any", () => {
      registerTags();
      const pattern = parse("date");

      // Should match any date
      const date = CborDate.fromYmd(2023, 12, 25);
      const dateCborValue = dateToCbor(date);
      const paths = getPaths(pattern, dateCborValue);
      assertActualExpected(formatPathsStr(paths), "2023-12-25");

      // Should not match non-date
      const textCbor = cbor("2023-12-25");
      expect(matches(pattern, textCbor)).toBe(false);

      const numberCbor = cbor(1703462400); // Unix timestamp for 2023-12-25
      expect(matches(pattern, numberCbor)).toBe(false);
    });

    it("test_date_pattern_specific", () => {
      registerTags();

      const date = CborDate.fromYmd(2023, 12, 25);
      const pattern = datePattern(date);

      // Should match the specific date
      const dateCborValue = dateToCbor(date);
      const paths = getPaths(pattern, dateCborValue);
      assertActualExpected(formatPathsStr(paths), "2023-12-25");

      // Should not match a different date
      const otherDate = CborDate.fromYmd(2024, 1, 1);
      const otherDateCbor = dateToCbor(otherDate);
      expect(matches(pattern, otherDateCbor)).toBe(false);

      // Should not match non-date
      const textCbor = cbor("2023-12-25");
      expect(matches(pattern, textCbor)).toBe(false);
    });

    it("test_date_pattern_range", () => {
      registerTags();

      const startDate = CborDate.fromYmd(2023, 12, 20);
      const endDate = CborDate.fromYmd(2023, 12, 30);
      const pattern = dateRange(startDate, endDate);

      // Should match date within range
      const middleDate = CborDate.fromYmd(2023, 12, 25);
      const middleDateCbor = dateToCbor(middleDate);
      const paths = getPaths(pattern, middleDateCbor);
      assertActualExpected(formatPathsStr(paths), "2023-12-25");

      // Should match date at start of range
      const startDateCbor = dateToCbor(startDate);
      const paths2 = getPaths(pattern, startDateCbor);
      assertActualExpected(formatPathsStr(paths2), "2023-12-20");

      // Should match date at end of range
      const endDateCbor = dateToCbor(endDate);
      const paths3 = getPaths(pattern, endDateCbor);
      assertActualExpected(formatPathsStr(paths3), "2023-12-30");

      // Should not match date before range
      const earlyDate = CborDate.fromYmd(2023, 12, 15);
      const earlyDateCbor = dateToCbor(earlyDate);
      expect(matches(pattern, earlyDateCbor)).toBe(false);

      // Should not match date after range
      const lateDate = CborDate.fromYmd(2024, 1, 5);
      const lateDateCbor = dateToCbor(lateDate);
      expect(matches(pattern, lateDateCbor)).toBe(false);
    });

    it("test_date_pattern_earliest", () => {
      registerTags();

      const earliestDate = CborDate.fromYmd(2023, 12, 20);
      const pattern = dateEarliest(earliestDate);

      // Should match date equal to earliest
      const earliestDateCbor = dateToCbor(earliestDate);
      const paths = getPaths(pattern, earliestDateCbor);
      assertActualExpected(formatPathsStr(paths), "2023-12-20");

      // Should match date after earliest
      const laterDate = CborDate.fromYmd(2023, 12, 25);
      const laterDateCbor = dateToCbor(laterDate);
      const paths2 = getPaths(pattern, laterDateCbor);
      assertActualExpected(formatPathsStr(paths2), "2023-12-25");

      // Should not match date before earliest
      const earlierDate = CborDate.fromYmd(2023, 12, 15);
      const earlierDateCbor = dateToCbor(earlierDate);
      expect(matches(pattern, earlierDateCbor)).toBe(false);
    });

    it("test_date_pattern_latest", () => {
      registerTags();

      const latestDate = CborDate.fromYmd(2023, 12, 30);
      const pattern = dateLatest(latestDate);

      // Should match date equal to latest
      const latestDateCbor = dateToCbor(latestDate);
      const paths = getPaths(pattern, latestDateCbor);
      assertActualExpected(formatPathsStr(paths), "2023-12-30");

      // Should match date before latest
      const earlierDate = CborDate.fromYmd(2023, 12, 25);
      const earlierDateCbor = dateToCbor(earlierDate);
      const paths2 = getPaths(pattern, earlierDateCbor);
      assertActualExpected(formatPathsStr(paths2), "2023-12-25");

      // Should not match date after latest
      const laterDate = CborDate.fromYmd(2024, 1, 5);
      const laterDateCbor = dateToCbor(laterDate);
      expect(matches(pattern, laterDateCbor)).toBe(false);
    });

    it("test_date_pattern_iso8601", () => {
      registerTags();
      const date = CborDate.fromYmd(2023, 12, 25);
      const isoString = date.toString();
      const pattern = dateIso8601(isoString);

      // Should match date with matching ISO string
      const dateCborValue = dateToCbor(date);
      const paths = getPaths(pattern, dateCborValue);
      assertActualExpected(formatPathsStr(paths), "2023-12-25");

      // Should not match date with different ISO string
      const otherDate = CborDate.fromYmd(2024, 1, 1);
      const otherDateCbor = dateToCbor(otherDate);
      expect(matches(pattern, otherDateCbor)).toBe(false);
    });

    it("test_date_pattern_regex", () => {
      registerTags();

      // Pattern to match any date in 2023
      const pattern = dateRegex(/^2023-/);

      // Should match date in 2023
      const date2023 = CborDate.fromYmd(2023, 12, 25);
      const date2023Cbor = dateToCbor(date2023);
      const paths = getPaths(pattern, date2023Cbor);
      assertActualExpected(formatPathsStr(paths), "2023-12-25");

      // Should not match date in 2024
      const date2024 = CborDate.fromYmd(2024, 1, 1);
      const date2024Cbor = dateToCbor(date2024);
      expect(matches(pattern, date2024Cbor)).toBe(false);

      // Test with more specific regex (December dates)
      const decemberPattern = dateRegex(/-12-/);

      // Should match December date
      const paths2 = getPaths(decemberPattern, date2023Cbor);
      assertActualExpected(formatPathsStr(paths2), "2023-12-25");

      // Should not match January date
      const januaryDate = CborDate.fromYmd(2023, 1, 15);
      const januaryDateCbor = dateToCbor(januaryDate);
      expect(matches(decemberPattern, januaryDateCbor)).toBe(false);
    });

    it("test_date_pattern_with_time", () => {
      registerTags();
      // Test with dates that include time components
      const datetime = CborDate.fromTimestamp(1703462400.0); // 2023-12-25 00:00:00 UTC
      const pattern = parse("date");

      const datetimeCbor = dateToCbor(datetime);
      const paths = getPaths(pattern, datetimeCbor);
      assertActualExpected(formatPathsStr(paths), "2023-12-25");

      // Test specific time matching
      const specificPattern = datePattern(datetime);
      const paths2 = getPaths(specificPattern, datetimeCbor);
      assertActualExpected(formatPathsStr(paths2), "2023-12-25");

      // Test with fractional seconds
      const datetimeWithMillis = CborDate.fromTimestamp(1703462400.123);
      const datetimeWithMillisCbor = dateToCbor(datetimeWithMillis);
      const paths3 = getPaths(pattern, datetimeWithMillisCbor);
      assertActualExpected(formatPathsStr(paths3), "2023-12-25");
    });

    it("test_date_pattern_display", () => {
      registerTags();
      expect(display(parse("date"))).toBe("date");

      const date = CborDate.fromYmd(2023, 12, 25);
      expect(patternDisplay(datePattern(date))).toBe(`date'${date.toString()}'`);

      const startDate = CborDate.fromYmd(2023, 12, 20);
      const endDate = CborDate.fromYmd(2023, 12, 30);
      expect(patternDisplay(dateRange(startDate, endDate))).toBe(
        `date'${startDate.toString()}...${endDate.toString()}'`,
      );

      expect(patternDisplay(dateEarliest(date))).toBe(`date'${date.toString()}...'`);

      expect(patternDisplay(dateLatest(date))).toBe(`date'...${date.toString()}'`);

      expect(patternDisplay(dateIso8601("2023-12-25T00:00:00Z"))).toBe(
        "date'2023-12-25T00:00:00Z'",
      );

      const regex = /^2023-/;
      expect(patternDisplay(dateRegex(regex))).toBe("date'/^2023-/'");
    });
  });

  describe("known value patterns", () => {
    it("test_known_value_pattern_any", () => {
      const pattern = parse("known");

      // Test with known values represented as tagged values with tag 40000
      const knownValueCbor = cborFromString("'1'"); // This represents known_values::IS_A as 40000(1)
      const paths = getPaths(pattern, knownValueCbor);
      assertActualExpected(formatPathsStr(paths), "40000(1)");

      // Test with another known value
      const dateValueCbor = cborFromString("'16'"); // This represents known_values::DATE as 40000(16)
      const paths2 = getPaths(pattern, dateValueCbor);
      assertActualExpected(formatPathsStr(paths2), "40000(16)");

      // Test with custom known value
      const customValueCbor = cborFromString("'12345'");
      const paths3 = getPaths(pattern, customValueCbor);
      assertActualExpected(formatPathsStr(paths3), "40000(12345)");

      // Should not match plain unsigned integers (these are NOT known values)
      const plainIntCbor = cbor(1);
      expect(matches(pattern, plainIntCbor)).toBe(false);

      const textCbor = cbor("hello");
      expect(matches(pattern, textCbor)).toBe(false);

      const negativeCbor = cbor(-1);
      expect(matches(pattern, negativeCbor)).toBe(false);
    });

    it("test_known_value_pattern_specific", () => {
      registerTags();

      const isAPattern = parse("'isA'");
      const dateValPattern = parse("'date'");

      const isACbor = cborFromString("'1'"); // IS_A value as 40000(1)
      const dateCbor = cborFromString("'16'"); // DATE value as 40000(16)
      const otherCbor = cborFromString("'42'"); // Some other known value as 40000(42)
      const plainIntCbor = cbor(1); // Plain integer, NOT a known value
      const textCbor = cbor("hello");

      // is_a pattern tests
      const paths = getPaths(isAPattern, isACbor);
      assertActualExpected(formatPathsStr(paths), "40000(1)");

      expect(matches(isAPattern, dateCbor)).toBe(false);
      expect(matches(isAPattern, otherCbor)).toBe(false);
      expect(matches(isAPattern, plainIntCbor)).toBe(false); // Should NOT match plain integers
      expect(matches(isAPattern, textCbor)).toBe(false);

      // date pattern tests
      expect(matches(dateValPattern, isACbor)).toBe(false);
      const paths2 = getPaths(dateValPattern, dateCbor);
      assertActualExpected(formatPathsStr(paths2), "40000(16)");

      expect(matches(dateValPattern, otherCbor)).toBe(false);
      expect(matches(dateValPattern, plainIntCbor)).toBe(false); // Should NOT match plain integers
      expect(matches(dateValPattern, textCbor)).toBe(false);
    });

    it("test_known_value_pattern_named", () => {
      registerTags();

      const isAPattern = parse("'isA'");
      const dateValPattern = parse("'date'");
      const unknownPattern = parse("'unknownValue'");

      const isACbor = cborFromString("'isA'"); // IS_A value as 40000(1)
      const dateCbor = cborFromString("'date'"); // DATE value as 40000(16)
      const otherCbor = cborFromString("'42'"); // Some other known value as 40000(42)
      const plainIntCbor = cbor(1); // Plain integer, NOT a known value
      const textCbor = cbor("hello");

      // is_a pattern tests
      const paths = getPaths(isAPattern, isACbor);
      assertActualExpected(formatPathsStr(paths), "40000(1)");

      expect(matches(isAPattern, dateCbor)).toBe(false);
      expect(matches(isAPattern, otherCbor)).toBe(false);
      expect(matches(isAPattern, plainIntCbor)).toBe(false); // Should NOT match plain integers
      expect(matches(isAPattern, textCbor)).toBe(false);

      // date pattern tests
      expect(matches(dateValPattern, isACbor)).toBe(false);
      const paths2 = getPaths(dateValPattern, dateCbor);
      assertActualExpected(formatPathsStr(paths2), "40000(16)");

      expect(matches(dateValPattern, otherCbor)).toBe(false);
      expect(matches(dateValPattern, plainIntCbor)).toBe(false); // Should NOT match plain integers
      expect(matches(dateValPattern, textCbor)).toBe(false);

      // unknown pattern tests (should not match anything)
      expect(matches(unknownPattern, isACbor)).toBe(false);
      expect(matches(unknownPattern, dateCbor)).toBe(false);
      expect(matches(unknownPattern, otherCbor)).toBe(false);
      expect(matches(unknownPattern, plainIntCbor)).toBe(false);
      expect(matches(unknownPattern, textCbor)).toBe(false);
    });

    it("test_known_value_pattern_regex", () => {
      // Test regex that matches names starting with "is"
      const isPattern = knownValueRegex(/^is.*/);

      // Test regex that matches names ending with "te"
      const tePattern = knownValueRegex(/.*te$/);

      // Test regex that doesn't match any known value names
      const noMatchPattern = knownValueRegex(/^xyz.*/);

      const isACbor = cborFromString("'1'"); // IS_A value (name: "isA") as 40000(1)
      const dateCbor = cborFromString("'16'"); // DATE value (name: "date") as 40000(16)
      const noteCbor = cborFromString("'4'"); // NOTE value (name: "note") as 40000(4)
      const otherCbor = cborFromString("'42'"); // Some other known value as 40000(42)
      const plainIntCbor = cbor(1); // Plain integer, NOT a known value
      const textCbor = cbor("hello");

      // is pattern tests (should match IS_A which starts with "is")
      const paths = getPaths(isPattern, isACbor);
      assertActualExpected(formatPathsStr(paths), "40000(1)");

      expect(matches(isPattern, dateCbor)).toBe(false);
      expect(matches(isPattern, noteCbor)).toBe(false);
      expect(matches(isPattern, otherCbor)).toBe(false);
      expect(matches(isPattern, plainIntCbor)).toBe(false); // Should NOT match plain integers
      expect(matches(isPattern, textCbor)).toBe(false);

      // te pattern tests (should match DATE and NOTE which end with "te")
      expect(matches(tePattern, isACbor)).toBe(false);
      const paths2 = getPaths(tePattern, dateCbor);
      assertActualExpected(formatPathsStr(paths2), "40000(16)");

      const paths3 = getPaths(tePattern, noteCbor);
      assertActualExpected(formatPathsStr(paths3), "40000(4)");

      expect(matches(tePattern, otherCbor)).toBe(false);
      expect(matches(tePattern, plainIntCbor)).toBe(false); // Should NOT match plain integers
      expect(matches(tePattern, textCbor)).toBe(false);

      // no match pattern tests
      expect(matches(noMatchPattern, isACbor)).toBe(false);
      expect(matches(noMatchPattern, dateCbor)).toBe(false);
      expect(matches(noMatchPattern, noteCbor)).toBe(false);
      expect(matches(noMatchPattern, otherCbor)).toBe(false);
      expect(matches(noMatchPattern, plainIntCbor)).toBe(false);
      expect(matches(noMatchPattern, textCbor)).toBe(false);
    });

    it("test_known_value_pattern_display", () => {
      const anyPattern = parse("known");
      expect(display(anyPattern)).toBe("known");

      const isAPattern = knownValuePattern(IS_A);
      expect(patternDisplay(isAPattern)).toBe("'isA'");

      const dateKvPattern = knownValuePattern(DATE);
      expect(patternDisplay(dateKvPattern)).toBe("'date'");

      const namedPattern = knownValueNamed("customName");
      expect(patternDisplay(namedPattern)).toBe("'customName'");

      const regexPattern = knownValueRegex(/^is.*/);
      expect(patternDisplay(regexPattern)).toBe("'/^is.*/'");
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

    it("test_map_float_keys", () => {
      const mapPattern = parse("{3.2222: text}");
      const data = cborFromString(`{3.2222: "first", 2: "second"}`);
      const paths = getPaths(mapPattern, data);
      assertActualExpected(formatPathsStr(paths), `{2: "second", 3.2222: "first"}`);
    });

    it("test_map_bstr_keys", () => {
      const mapPattern = parse("{h'68656c6c6f': text}");
      const data = cborFromString(
        `{h'68656c6c6f': "first", h'776f726c64': "second"}`,
      );
      const paths = getPaths(mapPattern, data);
      assertActualExpected(
        formatPathsStr(paths),
        `{h'68656c6c6f': "first", h'776f726c64': "second"}`,
      );
    });

    it("test_map_known_value_keys", () => {
      registerTags();
      const mapPattern = parse("{'100': text}");
      const data = cborFromString(`{'100': "first", '200': "second"}`);
      const paths = getPaths(mapPattern, data);
      assertActualExpected(
        formatPathsStr(paths),
        `{40000(100): "first", 40000(200): "second"}`,
      );
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
