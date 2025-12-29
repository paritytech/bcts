/**
 * Meta pattern tests ported from pattern_tests_meta.rs
 */

import { describe, it, expect } from "vitest";
import {
  cbor,
  parse,
  matches,
  display,
  getPaths,
  formatPathsStr,
  assertActualExpected,
} from "./common";

describe("meta pattern tests", () => {
  it("test_any_pattern", () => {
    const pattern = parse("*");

    // Should match all types of CBOR values
    const numberCbor = cbor(42);
    let paths = getPaths(pattern, numberCbor);
    assertActualExpected(formatPathsStr(paths), "42");

    const textCbor = cbor("hello");
    paths = getPaths(pattern, textCbor);
    assertActualExpected(formatPathsStr(paths), '"hello"');

    const boolCbor = cbor(true);
    paths = getPaths(pattern, boolCbor);
    assertActualExpected(formatPathsStr(paths), "true");

    const arrayCbor = cbor([1, 2, 3]);
    paths = getPaths(pattern, arrayCbor);
    assertActualExpected(formatPathsStr(paths), "[1, 2, 3]");

    const nullCbor = cbor(null);
    paths = getPaths(pattern, nullCbor);
    assertActualExpected(formatPathsStr(paths), "null");

    // Display should show *
    expect(display(pattern)).toBe("*");
  });

  it("test_not_any_pattern", () => {
    const pattern = parse("!*");

    // Should never match any CBOR value
    expect(matches(pattern, cbor(42))).toBe(false);
    expect(matches(pattern, cbor("hello"))).toBe(false);
    expect(matches(pattern, cbor(true))).toBe(false);
    expect(matches(pattern, cbor([1, 2, 3]))).toBe(false);
    expect(matches(pattern, cbor(null))).toBe(false);

    // Display should show !*
    expect(display(pattern)).toBe("!*");
  });

  it("test_and_pattern", () => {
    const pattern = parse(">5 & <10");

    // Should match values that satisfy all conditions
    let paths = getPaths(pattern, cbor(7));
    assertActualExpected(formatPathsStr(paths), "7");

    paths = getPaths(pattern, cbor(6));
    assertActualExpected(formatPathsStr(paths), "6");

    paths = getPaths(pattern, cbor(9));
    assertActualExpected(formatPathsStr(paths), "9");

    // Should not match values that fail any condition
    expect(matches(pattern, cbor(3))).toBe(false); // < 5
    expect(matches(pattern, cbor(12))).toBe(false); // > 10
    expect(matches(pattern, cbor("hello"))).toBe(false); // not a number

    // Display should use & operator (with parentheses in TS)
    expect(display(pattern)).toBe("(>5 & <10)");
  });

  it("test_or_pattern", () => {
    const pattern = parse('5 | "hello" | true');

    // Should match values that satisfy any condition
    let paths = getPaths(pattern, cbor(5));
    assertActualExpected(formatPathsStr(paths), "5");

    paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    paths = getPaths(pattern, cbor(true));
    assertActualExpected(formatPathsStr(paths), "true");

    // Should not match values that don't satisfy any condition
    expect(matches(pattern, cbor(42))).toBe(false);
    expect(matches(pattern, cbor("world"))).toBe(false);
    expect(matches(pattern, cbor(false))).toBe(false);

    // Display should use | operator (with parentheses in TS)
    expect(display(pattern)).toBe('(5 | "hello" | true)');
  });

  it("test_not_pattern", () => {
    const pattern = parse("!5");

    // Should match values that don't match the inner pattern
    let paths = getPaths(pattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    paths = getPaths(pattern, cbor(true));
    assertActualExpected(formatPathsStr(paths), "true");

    // Should not match the exact value
    expect(matches(pattern, cbor(5))).toBe(false);

    // Display should use ! operator
    expect(display(pattern)).toBe("!5");
  });

  it("test_not_pattern_complex", () => {
    const pattern = parse("!(>5 & <10)");

    // Should match values outside the range
    let paths = getPaths(pattern, cbor(3));
    assertActualExpected(formatPathsStr(paths), "3");

    paths = getPaths(pattern, cbor(12));
    assertActualExpected(formatPathsStr(paths), "12");

    paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    // Should not match values in the range
    expect(matches(pattern, cbor(7))).toBe(false);

    // Display should wrap complex patterns in parentheses
    // Note: TS adds {1} quantifier suffix to grouped patterns
    expect(display(pattern)).toBe("!(>5 & <10){1}");
  });

  it("test_nested_meta_patterns", () => {
    // (number > 5 AND number < 10) OR text = "hello"
    const pattern = parse('>5 & <10 | "hello"');

    // Should match numbers in range
    let paths = getPaths(pattern, cbor(7));
    assertActualExpected(formatPathsStr(paths), "7");

    // Should match the specific text
    paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    // Should not match numbers outside range or other text
    expect(matches(pattern, cbor(3))).toBe(false);
    expect(matches(pattern, cbor(12))).toBe(false);
    expect(matches(pattern, cbor("world"))).toBe(false);

    // Display should properly nest the operators (with parentheses in TS)
    expect(display(pattern)).toBe('((>5 & <10) | "hello")');
  });

  it("test_capture_pattern_basic", () => {
    const pattern = parse("@test(42)");

    // Should match the same things as the inner pattern
    const paths = getPaths(pattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    // Should not match other values
    expect(matches(pattern, cbor(43))).toBe(false);
    expect(matches(pattern, cbor("hello"))).toBe(false);

    // Display should show capture syntax
    expect(display(pattern)).toBe("@test(42)");
  });

  it("test_capture_pattern_text", () => {
    const pattern = parse('@name("hello")');

    // Should match the same things as the inner pattern
    const paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    // Should not match other values
    expect(matches(pattern, cbor("world"))).toBe(false);
    expect(matches(pattern, cbor(42))).toBe(false);

    // Display should show capture syntax
    expect(display(pattern)).toBe('@name("hello")');
  });

  it("test_capture_pattern_any", () => {
    const pattern = parse("@anything(*)");

    // Should match anything since inner pattern is *
    let paths = getPaths(pattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    paths = getPaths(pattern, cbor(true));
    assertActualExpected(formatPathsStr(paths), "true");

    paths = getPaths(pattern, cbor([1, 2, 3]));
    assertActualExpected(formatPathsStr(paths), "[1, 2, 3]");

    // Display should show capture syntax
    expect(display(pattern)).toBe("@anything(*)");
  });

  it("test_capture_pattern_not_any", () => {
    const pattern = parse("@nothing(!*)");

    // Should never match since inner pattern is !*
    expect(matches(pattern, cbor(42))).toBe(false);
    expect(matches(pattern, cbor("hello"))).toBe(false);
    expect(matches(pattern, cbor(true))).toBe(false);

    // Display should show capture syntax
    expect(display(pattern)).toBe("@nothing(!*)");
  });

  it("test_search_pattern_basic", () => {
    const pattern = parse("search(42)");

    // Test with a flat CBOR value containing the number
    let paths = getPaths(pattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    // Should not match other flat values
    expect(matches(pattern, cbor(43))).toBe(false);

    // Test with nested structure containing the number
    paths = getPaths(pattern, cbor([1, 42, 3]));
    const expected1 = `[1, 42, 3]
    42`;
    assertActualExpected(formatPathsStr(paths), expected1);

    paths = getPaths(pattern, cbor({ key: 42 }));
    const expected2 = `{"key": 42}
    42`;
    assertActualExpected(formatPathsStr(paths), expected2);

    // Test that it doesn't match when the value is not present
    expect(matches(pattern, cbor([1, 2, 3]))).toBe(false);
    expect(matches(pattern, cbor({ key: 2 }))).toBe(false);

    // Display shows `..pattern` syntax in TS
    expect(display(pattern)).toBe("..42");
  });

  it("test_search_pattern_text", () => {
    const pattern = parse('search("hello")');

    // Test with nested structures
    let paths = getPaths(pattern, cbor(["hello", "world"]));
    const expected1 = `["hello", "world"]
    "hello"`;
    assertActualExpected(formatPathsStr(paths), expected1);

    paths = getPaths(pattern, cbor({ greeting: "hello" }));
    const expected2 = `{"greeting": "hello"}
    "hello"`;
    assertActualExpected(formatPathsStr(paths), expected2);

    // Test that it doesn't match when the text is not present
    expect(matches(pattern, cbor(["goodbye", "world"]))).toBe(false);

    // Display shows `..pattern` syntax in TS
    expect(display(pattern)).toBe('.."hello"');
  });

  it("test_search_pattern_any", () => {
    const pattern = parse("search(*)");

    // Should match any CBOR value because * matches everything
    let paths = getPaths(pattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    // * matches everything, so arrays should match all nodes
    paths = getPaths(pattern, cbor([1, 2, 3]));
    const expected = `[1, 2, 3]
[1, 2, 3]
    1
[1, 2, 3]
    2
[1, 2, 3]
    3`;
    assertActualExpected(formatPathsStr(paths), expected);

    const emptyMapPaths = getPaths(pattern, cbor({}));
    assertActualExpected(formatPathsStr(emptyMapPaths), "{}");

    // Display shows `..pattern` syntax in TS
    expect(display(pattern)).toBe("..*");
  });

  it("test_search_pattern_edge_cases", () => {
    const pattern = parse("search(1)");

    // Test with empty structures
    expect(matches(pattern, cbor([]))).toBe(false);
    expect(matches(pattern, cbor({}))).toBe(false);

    // Test with null
    expect(matches(pattern, cbor(null))).toBe(false);

    // Test with deeply nested structure containing the target
    expect(matches(pattern, cbor([[[[1]]]]))).toBe(true);
  });

  it("test_search_array_order", () => {
    const data = cbor([[1, 2, 3], [4, 5, 6]]);

    const arrayPattern = parse("search(array)");
    let paths = getPaths(arrayPattern, data);
    const expectedArray = `[[1, 2, 3], [4, 5, 6]]
[[1, 2, 3], [4, 5, 6]]
    [1, 2, 3]
[[1, 2, 3], [4, 5, 6]]
    [4, 5, 6]`;
    assertActualExpected(formatPathsStr(paths), expectedArray);

    const numberPattern = parse("search(number)");
    paths = getPaths(numberPattern, data);
    const expectedNumber = `[[1, 2, 3], [4, 5, 6]]
    [1, 2, 3]
        1
[[1, 2, 3], [4, 5, 6]]
    [1, 2, 3]
        2
[[1, 2, 3], [4, 5, 6]]
    [1, 2, 3]
        3
[[1, 2, 3], [4, 5, 6]]
    [4, 5, 6]
        4
[[1, 2, 3], [4, 5, 6]]
    [4, 5, 6]
        5
[[1, 2, 3], [4, 5, 6]]
    [4, 5, 6]
        6`;
    assertActualExpected(formatPathsStr(paths), expectedNumber);
  });
});
