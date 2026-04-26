/**
 * Meta pattern tests ported from pattern_tests_meta.rs
 */

import { describe, it, expect } from "vitest";
import {
  and,
  or,
  capture,
  search,
  group,
  repeat,
  number,
  text,
  numberGreaterThan,
  numberLessThan,
  Quantifier,
  Interval,
  Reluctance,
  patternDisplay,
} from "../src";
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

    // Display uses & operator
    expect(display(pattern)).toBe(">5 & <10");
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

    // Display uses | operator
    expect(display(pattern)).toBe('5 | "hello" | true');
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

    // Display shows nested operators
    expect(display(pattern)).toBe('>5 & <10 | "hello"');
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

    // Display shows search(pattern) syntax
    expect(display(pattern)).toBe("search(42)");
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

    // Display shows search(pattern) syntax
    expect(display(pattern)).toBe('search("hello")');
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

    // Display shows search(pattern) syntax
    expect(display(pattern)).toBe("search(*)");
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

  it("test_empty_and_pattern", () => {
    const pattern = and();

    // Empty AND should match everything (vacuous truth)
    expect(matches(pattern, cbor(42))).toBe(true);
    expect(matches(pattern, cbor("hello"))).toBe(true);

    // Display should be empty string
    expect(display(pattern)).toBe("");
  });

  it("test_empty_or_pattern", () => {
    const pattern = or();

    // Empty OR should match nothing
    expect(matches(pattern, cbor(42))).toBe(false);
    expect(matches(pattern, cbor("hello"))).toBe(false);

    // Display should be empty string
    expect(display(pattern)).toBe("");
  });

  it("test_capture_pattern_complex", () => {
    const pattern = capture("range", and(numberGreaterThan(5), numberLessThan(10)));

    // Should match numbers in range 5 < x < 10
    let paths = getPaths(pattern, cbor(7));
    assertActualExpected(formatPathsStr(paths), "7");

    paths = getPaths(pattern, cbor(6));
    assertActualExpected(formatPathsStr(paths), "6");

    paths = getPaths(pattern, cbor(9));
    assertActualExpected(formatPathsStr(paths), "9");

    // Should not match values outside range
    expect(matches(pattern, cbor(5))).toBe(false);
    expect(matches(pattern, cbor(10))).toBe(false);
    expect(matches(pattern, cbor(15))).toBe(false);

    // Display should show capture syntax with complex inner pattern
    const displayStr = patternDisplay(pattern);
    expect(displayStr.startsWith("@range(")).toBe(true);
    expect(displayStr.includes("&")).toBe(true);
    expect(displayStr.endsWith(")")).toBe(true);
  });

  it("test_nested_capture_patterns", () => {
    const pattern = capture(
      "outer",
      or(capture("inner1", number(42)), capture("inner2", text("hello"))),
    );

    // Should match either captured pattern
    let paths = getPaths(pattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    paths = getPaths(pattern, cbor("hello"));
    assertActualExpected(formatPathsStr(paths), '"hello"');

    // Should not match other values
    expect(matches(pattern, cbor(43))).toBe(false);
    expect(matches(pattern, cbor("world"))).toBe(false);

    // Display should show nested capture syntax
    const displayStr = patternDisplay(pattern);
    expect(displayStr.startsWith("@outer(")).toBe(true);
    expect(displayStr.includes("@inner1")).toBe(true);
    expect(displayStr.includes("@inner2")).toBe(true);
    expect(displayStr.includes("|")).toBe(true);
    expect(displayStr.endsWith(")")).toBe(true);
  });

  it("test_capture_pattern_name_access", () => {
    const innerPattern = number(42);
    const pattern = capture("test_name", innerPattern);

    // Test that we can access the capture pattern internals
    expect(pattern.kind).toBe("Meta");
    if (pattern.kind === "Meta" && pattern.pattern.type === "Capture") {
      expect(pattern.pattern.pattern.name).toBe("test_name");
      expect(pattern.pattern.pattern.pattern).toBe(innerPattern);
    } else {
      throw new Error("Expected capture pattern");
    }
  });

  it("test_capture_pattern_is_complex", () => {
    // Note: TS doesn't expose `isComplex()` directly, but the display format
    // should show parentheses around complex inner patterns. We verify by
    // checking the display string. Mirrors the spirit of the Rust test.

    // Simple capture should not wrap inner pattern in parens
    const simple = capture("simple", number(42));
    expect(patternDisplay(simple)).toBe("@simple(42)");

    // Complex capture's display reflects the complexity of its inner pattern
    const complex = capture("complex", and(number(1), number(2)));
    const complexDisplay = patternDisplay(complex);
    expect(complexDisplay.startsWith("@complex(")).toBe(true);
    expect(complexDisplay.includes("&")).toBe(true);
  });

  it("test_repeat_pattern_basic", () => {
    // Test exact match (default quantifier)
    const pattern = group(number(42));

    const paths = getPaths(pattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    // Should not match other values
    expect(matches(pattern, cbor(41))).toBe(false);
    expect(matches(pattern, cbor("hello"))).toBe(false);

    // Display should show pattern with {1} quantifier
    expect(display(pattern)).toBe("(42){1}");
  });

  it("test_repeat_pattern_with_quantifier", () => {
    // Test optional pattern (0 or 1 match)
    const optionalPattern = repeat(
      number(42),
      new Quantifier(new Interval(0, 1), Reluctance.Greedy),
    );

    // Should match the number or succeed without it
    const paths = getPaths(optionalPattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    // Display should show pattern with ? quantifier
    expect(display(optionalPattern)).toBe("(42)?");
  });

  it("test_repeat_pattern_zero_or_more", () => {
    // Test zero or more pattern
    const starPattern = repeat(
      number(42),
      new Quantifier(Interval.atLeast(0), Reluctance.Greedy),
    );

    // Should always succeed with 0 matches or with the actual match
    const paths = getPaths(starPattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    // Also succeeds with 0 matches for non-matching values - tested with matches()
    expect(matches(starPattern, cbor(41))).toBe(true); // Succeeds with 0 matches

    // Display should show pattern with * quantifier
    expect(display(starPattern)).toBe("(42)*");
  });

  it("test_repeat_pattern_one_or_more", () => {
    // Test one or more pattern
    const plusPattern = repeat(
      number(42),
      new Quantifier(Interval.atLeast(1), Reluctance.Greedy),
    );

    // Should match the number but not other values
    const paths = getPaths(plusPattern, cbor(42));
    assertActualExpected(formatPathsStr(paths), "42");

    // Should not match other values
    expect(matches(plusPattern, cbor(41))).toBe(false);

    // Display should show pattern with + quantifier
    expect(display(plusPattern)).toBe("(42)+");
  });

  it("test_repeat_pattern_exact_count", () => {
    // Test exact count pattern
    const exactPattern = repeat(
      number(42),
      new Quantifier(new Interval(3, 3), Reluctance.Greedy),
    );

    // For single values, this should fail if count > 1
    expect(matches(exactPattern, cbor(42))).toBe(false);

    // Display should show pattern with {3} quantifier
    expect(display(exactPattern)).toBe("(42){3}");
  });

  it("test_repeat_pattern_display_with_reluctance", () => {
    // Test lazy quantifier
    const lazyPattern = repeat(
      text("test"),
      new Quantifier(new Interval(0, 1), Reluctance.Lazy),
    );

    expect(display(lazyPattern)).toBe('("test")??');

    // Test possessive quantifier
    const possessivePattern = repeat(
      text("test"),
      new Quantifier(Interval.atLeast(1), Reluctance.Possessive),
    );

    expect(display(possessivePattern)).toBe('("test")++');
  });

  it("test_search_pattern_complex", () => {
    // Search for arrays containing the number 5
    const pattern = search(number(5));

    const testData = cbor({
      data: [{ values: [1, 2, 3] }, { values: [4, 5, 6] }, { other: "text" }],
      meta: {
        count: 5,
        items: [7, 8, 9],
      },
    });

    // Should match because the structure contains the number 5 in multiple places
    const paths = getPaths(pattern, testData);
    const expected = `{"data": [{"values": [1, 2, 3]}, {"values": [4, 5, 6]}, {"other": "text"}], "meta": {"count": 5, "items": [7, 8, 9]}}
    [{"values": [1, 2, 3]}, {"values": [4, 5, 6]}, {"other": "text"}]
        {"values": [4, 5, 6]}
            [4, 5, 6]
                5
{"data": [{"values": [1, 2, 3]}, {"values": [4, 5, 6]}, {"other": "text"}], "meta": {"count": 5, "items": [7, 8, 9]}}
    {"count": 5, "items": [7, 8, 9]}
        5`;
    assertActualExpected(formatPathsStr(paths), expected);

    // Check specific paths are found
    expect(paths.length).toBeGreaterThan(0);
  });

  it("test_search_pattern_with_captures", () => {
    // Create a search pattern that captures what it finds
    const innerPattern = capture("found", number(42));
    const pattern = search(innerPattern);

    // Test with a nested structure
    const data = cbor([1, { key: 42 }, 3]);
    const paths = getPaths(pattern, data);
    const expected = `[1, {"key": 42}, 3]
    {"key": 42}
        42`;
    assertActualExpected(formatPathsStr(paths), expected);

    // Display should show the capture in the search
    expect(display(pattern)).toBe("search(@found(42))");
  });

  it("test_search_pattern_paths", () => {
    const pattern = search(text("target"));

    const data = cbor({
      level1: {
        level2: ["target", "other"],
      },
      another: "target",
    });

    const paths = getPaths(pattern, data);

    // Should find multiple paths to "target"
    expect(paths.length).toBeGreaterThanOrEqual(2);

    // All paths should be valid (non-empty)
    for (const path of paths) {
      expect(path.length).toBeGreaterThan(0);
    }
  });

  it("test_search_pattern_with_structure_pattern", () => {
    // Search for any array
    const pattern = search(parse("array"));

    const data = cbor({
      arrays: [
        [1, 2],
        [3, 4],
      ],
      not_array: 42,
    });

    const paths = getPaths(pattern, data);
    // Should find the outer arrays structure and the inner arrays
    const expected = `{"arrays": [[1, 2], [3, 4]], "not_array": 42}
    [[1, 2], [3, 4]]
{"arrays": [[1, 2], [3, 4]], "not_array": 42}
    [[1, 2], [3, 4]]
        [1, 2]
{"arrays": [[1, 2], [3, 4]], "not_array": 42}
    [[1, 2], [3, 4]]
        [3, 4]`;
    assertActualExpected(formatPathsStr(paths), expected);

    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it("test_search_array_order", () => {
    const data = cbor([
      [1, 2, 3],
      [4, 5, 6],
    ]);

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
