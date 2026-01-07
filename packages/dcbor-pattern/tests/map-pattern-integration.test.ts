/**
 * Map pattern integration tests ported from map_pattern_integration_tests.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  assertActualExpected,
  matches,
  getPaths,
  formatPathsStr,
  display,
} from "./common";
import { any, anyText, anyNumber, anyBool, text, number } from "../src";
import {
  mapPatternAny,
  mapPatternWithLength,
  mapPatternWithConstraints,
  mapPatternPaths,
} from "../src/pattern/structure/map-pattern";
import { CborMap, cbor as createCbor, type CborInput } from "@bcts/dcbor";
import { formatPaths, type Path } from "../src/format";

/**
 * Helper to create a CBOR map with integer keys (JavaScript objects convert numbers to strings)
 */
const createIntegerKeyMap = (entries: [number | string, CborInput][]): ReturnType<typeof cbor> => {
  const map = new CborMap();
  for (const [key, value] of entries) {
    map.set(key, value);
  }
  return createCbor(map);
};

/**
 * Helper to get paths from a MapPattern directly (not the Pattern wrapper)
 */
const getMapPatternPaths = (
  pattern: ReturnType<typeof mapPatternAny>,
  data: ReturnType<typeof cbor>,
): Path[] => {
  return mapPatternPaths(pattern, data);
};

describe("map pattern integration tests", () => {
  describe("test_map_patterns_with_real_cbor", () => {
    // Create test maps using CBOR values
    const emptyMap = cbor({});
    const singleItem = cbor({ key: "hello" });
    const threeItems = cbor({ a: 1, b: 2, c: 3 });
    // Use CborMap for maps with integer keys to preserve them as integers
    const largeMap = createIntegerKeyMap([
      [0, "item0"],
      [1, "item1"],
      [2, "item2"],
      [3, "item3"],
      [4, "item4"],
      [5, "item5"],
      [6, "item6"],
      [7, "item7"],
      [8, "item8"],
      [9, "item9"],
    ]);

    it("map pattern should match any map", () => {
      // Test map (any map)
      const anyMap = parse("map");

      // Should match empty map
      const paths1 = getPaths(anyMap, emptyMap);
      const expected1 = "{}";
      assertActualExpected(formatPathsStr(paths1), expected1);

      // Should match single item map
      const paths2 = getPaths(anyMap, singleItem);
      const expected2 = `{"key": "hello"}`;
      assertActualExpected(formatPathsStr(paths2), expected2);

      // Should match three items map
      const paths3 = getPaths(anyMap, threeItems);
      const expected3 = `{"a": 1, "b": 2, "c": 3}`;
      assertActualExpected(formatPathsStr(paths3), expected3);

      // Should match large map
      const paths4 = getPaths(anyMap, largeMap);
      const expected4 = `{0: "item0", 1: "item1", 2: "item2", 3: "item3", 4: "item4", 5: "item5", 6: "item6", 7: "item7", 8: "item8", 9: "item9"}`;
      assertActualExpected(formatPathsStr(paths4), expected4);

      // Should not match non-map
      expect(matches(anyMap, cbor(1))).toBe(false);
    });

    it("empty map pattern {{0}} should match only empty maps", () => {
      // Test {{0}} - empty map
      const emptyPattern = parse("{{0}}");
      const paths = getPaths(emptyPattern, emptyMap);
      const expected = "{}";
      assertActualExpected(formatPathsStr(paths), expected);

      // Should not match other maps
      expect(matches(emptyPattern, singleItem)).toBe(false);
      expect(matches(emptyPattern, threeItems)).toBe(false);
    });

    it("single item map pattern {{1}} should match only single item maps", () => {
      // Test {{1}} - single item map
      const singlePattern = parse("{{1}}");
      const paths = getPaths(singlePattern, singleItem);
      const expected = `{"key": "hello"}`;
      assertActualExpected(formatPathsStr(paths), expected);

      // Should not match other maps
      expect(matches(singlePattern, emptyMap)).toBe(false);
      expect(matches(singlePattern, threeItems)).toBe(false);
    });

    it("three item map pattern {{3}} should match only three item maps", () => {
      // Test {{3}} - three item map
      const threePattern = parse("{{3}}");
      const paths = getPaths(threePattern, threeItems);
      const expected = `{"a": 1, "b": 2, "c": 3}`;
      assertActualExpected(formatPathsStr(paths), expected);

      // Should not match other maps
      expect(matches(threePattern, emptyMap)).toBe(false);
      expect(matches(threePattern, singleItem)).toBe(false);
      expect(matches(threePattern, largeMap)).toBe(false);
    });

    it("range map pattern {{5,15}} should match maps with 5-15 items", () => {
      // Test {{5,15}} - range pattern
      const rangePattern = parse("{{5,15}}");
      const paths = getPaths(rangePattern, largeMap);
      const expected = `{0: "item0", 1: "item1", 2: "item2", 3: "item3", 4: "item4", 5: "item5", 6: "item6", 7: "item7", 8: "item8", 9: "item9"}`;
      assertActualExpected(formatPathsStr(paths), expected);

      // Should not match smaller maps
      expect(matches(rangePattern, emptyMap)).toBe(false);
      expect(matches(rangePattern, singleItem)).toBe(false);
      expect(matches(rangePattern, threeItems)).toBe(false);
    });

    it("min map pattern {{5,}} should match maps with at least 5 items", () => {
      // Test {{5,}} - at least 5 items
      const minPattern = parse("{{5,}}");
      const paths = getPaths(minPattern, largeMap);
      const expected = `{0: "item0", 1: "item1", 2: "item2", 3: "item3", 4: "item4", 5: "item5", 6: "item6", 7: "item7", 8: "item8", 9: "item9"}`;
      assertActualExpected(formatPathsStr(paths), expected);

      // Should not match smaller maps
      expect(matches(minPattern, emptyMap)).toBe(false);
      expect(matches(minPattern, singleItem)).toBe(false);
      expect(matches(minPattern, threeItems)).toBe(false);
    });
  });

  describe("test_map_pattern_display", () => {
    it("should display map patterns correctly", () => {
      // Test MapPattern.any() display
      const anyMapPattern = mapPatternAny();
      expect(formatPaths(getMapPatternPaths(anyMapPattern, cbor({})))).toBe("{}");

      // Test display through parse/display roundtrip
      // Note: TypeScript Interval.rangeNotation() doesn't include a space in ranges
      expect(display(parse("map"))).toBe("map");
      expect(display(parse("{{0}}"))).toBe("{{0}}");
      expect(display(parse("{{5}}"))).toBe("{{5}}");
      expect(display(parse("{{2,8}}"))).toBe("{{2,8}}");
      expect(display(parse("{{3,}}"))).toBe("{{3,}}");
    });
  });

  describe("test_map_pattern_round_trip", () => {
    it("should preserve pattern format through parse/display", () => {
      const patterns = ["map", "{{0}}", "{{1}}", "{{5}}", "{{2,8}}", "{{3,}}"];
      // Note: TypeScript Interval.rangeNotation() doesn't include a space in ranges
      const expectedDisplays = ["map", "{{0}}", "{{1}}", "{{5}}", "{{2,8}}", "{{3,}}"];

      for (let i = 0; i < patterns.length; i++) {
        const pattern = parse(patterns[i]);
        expect(display(pattern)).toBe(expectedDisplays[i]);
      }
    });
  });

  describe("test_map_pattern_paths", () => {
    it("should return correct paths for map patterns", () => {
      // Create a test map
      const testMap = cbor({ key1: "value1", key2: 42 });

      // Test that MAP pattern returns the map itself as a path
      const anyMap = mapPatternAny();
      const paths = getMapPatternPaths(anyMap, testMap);
      const expected = `{"key1": "value1", "key2": 42}`;
      assertActualExpected(formatPaths(paths), expected);

      // Test with non-map data - should return no paths
      const notMap = cbor("not a map");
      const pathsNotMap = getMapPatternPaths(anyMap, notMap);
      expect(pathsNotMap.length).toBe(0);

      // Test exact length match
      const exactPattern = mapPatternWithLength(2);
      const pathsExact = getMapPatternPaths(exactPattern, testMap);
      const expectedExact = `{"key1": "value1", "key2": 42}`;
      assertActualExpected(formatPaths(pathsExact), expectedExact);

      // Test length mismatch - should return no paths
      const wrongLength = mapPatternWithLength(3);
      const pathsWrong = getMapPatternPaths(wrongLength, testMap);
      expect(pathsWrong.length).toBe(0);
    });
  });

  describe("test_map_key_value_constraints_single", () => {
    it("should match map with single key-value constraint", () => {
      // Test map with single key-value constraint
      const testMap = cbor({ name: "Alice", age: 30, city: "New York" });

      // Single constraint: name must be a text value
      const pattern = mapPatternWithConstraints([[text("name"), anyText()]]);

      const paths = getMapPatternPaths(pattern, testMap);
      const expected = `{"age": 30, "city": "New York", "name": "Alice"}`;
      assertActualExpected(formatPaths(paths), expected);

      // Test non-matching constraint
      const nonMatching = mapPatternWithConstraints([
        [text("name"), anyNumber()], // name is text, not number
      ]);

      const pathsNonMatching = getMapPatternPaths(nonMatching, testMap);
      expect(pathsNonMatching.length).toBe(0);
    });
  });

  describe("test_map_key_value_constraints_multiple", () => {
    it("should match map with multiple key-value constraints", () => {
      // Test map with multiple key-value constraints
      const testMap = cbor({ name: "Bob", age: 25, active: true });

      // Multiple constraints: all must be satisfied
      const pattern = mapPatternWithConstraints([
        [text("name"), anyText()],
        [text("age"), anyNumber()],
        [text("active"), anyBool()],
      ]);

      const paths = getMapPatternPaths(pattern, testMap);
      const expected = `{"age": 25, "name": "Bob", "active": true}`;
      assertActualExpected(formatPaths(paths), expected);

      // Test with one failing constraint
      const partialPattern = mapPatternWithConstraints([
        [text("name"), anyText()], // matches
        [text("age"), anyText()], // fails: age is number, not text
        [text("active"), anyBool()], // matches
      ]);

      const pathsPartial = getMapPatternPaths(partialPattern, testMap);
      expect(pathsPartial.length).toBe(0);
    });
  });

  describe("test_map_key_value_constraints_any_key", () => {
    it("should match constraints with * key pattern", () => {
      // Test constraints with * key pattern
      const testMap = cbor({ key1: "hello", key2: "world", key3: 42 });

      // Match any key with text value
      const pattern = mapPatternWithConstraints([[any(), anyText()]]);

      const paths = getMapPatternPaths(pattern, testMap);
      const expected = `{"key1": "hello", "key2": "world", "key3": 42}`;
      assertActualExpected(formatPaths(paths), expected);

      // Match any key with number value
      const numberPattern = mapPatternWithConstraints([[any(), anyNumber()]]);

      const pathsNumber = getMapPatternPaths(numberPattern, testMap);
      assertActualExpected(formatPaths(pathsNumber), expected);
    });
  });

  describe("test_map_key_value_constraints_specific_values", () => {
    it("should match constraints with specific values", () => {
      // Test constraints with specific values
      const testMap = cbor({ status: "active", count: 42, flag: true });

      // Match specific key-value pairs
      const pattern = mapPatternWithConstraints([
        [text("status"), text("active")],
        [text("count"), number(42)],
      ]);

      const paths = getMapPatternPaths(pattern, testMap);
      const expected = `{"flag": true, "count": 42, "status": "active"}`;
      assertActualExpected(formatPaths(paths), expected);

      // Test with non-matching specific values
      const wrongValues = mapPatternWithConstraints([
        [text("status"), text("inactive")], // wrong value
        [text("count"), number(42)], // correct value
      ]);

      const pathsWrong = getMapPatternPaths(wrongValues, testMap);
      expect(pathsWrong.length).toBe(0);
    });
  });

  describe("test_map_key_value_constraints_empty_map", () => {
    it("should not match constraints against empty map", () => {
      // Test constraints against empty map
      const emptyMap = cbor({});

      // Any constraint should fail on empty map
      const pattern = mapPatternWithConstraints([[any(), any()]]);

      const paths = getMapPatternPaths(pattern, emptyMap);
      expect(paths.length).toBe(0);

      // Multiple constraints should also fail
      const multiPattern = mapPatternWithConstraints([
        [text("key1"), any()],
        [text("key2"), any()],
      ]);

      const pathsMulti = getMapPatternPaths(multiPattern, emptyMap);
      expect(pathsMulti.length).toBe(0);
    });
  });

  describe("test_map_key_value_constraints_pattern_text_parsing", () => {
    it("should parse and match unified {pattern:pattern, ...} syntax", () => {
      // Test the unified {pattern:pattern, ...} syntax from text
      const pattern = parse(`{"name":text, "age":number}`);

      const matchingMap = cbor({ name: "Charlie", age: 28, extra: "data" });
      expect(matches(pattern, matchingMap)).toBe(true);

      const nonMatchingMap = cbor({ name: 123, age: 28 }); // name is number, not text
      expect(matches(pattern, nonMatchingMap)).toBe(false);

      const missingKeyMap = cbor({ name: "Charlie" }); // missing age key
      expect(matches(pattern, missingKeyMap)).toBe(false);

      // Test display format
      expect(display(pattern)).toBe(`{"name": text, "age": number}`);
    });
  });

  describe("test_map_key_value_constraints_complex_patterns", () => {
    it("should match with complex nested patterns", () => {
      // Test with complex nested patterns
      // Use createIntegerKeyMap to preserve integer key 42
      const pattern = parse(`{*:"target", 42:true}`);

      const matchingMap = createIntegerKeyMap([
        ["somekey", "target"],
        [42, true],
        ["other", "data"],
      ]);
      expect(matches(pattern, matchingMap)).toBe(true);

      const partialMatch = createIntegerKeyMap([
        ["somekey", "target"],
        [42, false], // boolean is wrong
      ]);
      expect(matches(pattern, partialMatch)).toBe(false);

      const noMatch = createIntegerKeyMap([
        ["somekey", "other"], // text value is wrong
        [42, true],
      ]);
      expect(matches(pattern, noMatch)).toBe(false);
    });
  });
});
