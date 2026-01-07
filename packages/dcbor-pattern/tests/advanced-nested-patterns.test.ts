/**
 * Advanced nested pattern tests ported from test_advanced_nested_patterns.rs
 */

import { describe, it, expect } from "vitest";
import { cbor, toTaggedValue } from "@bcts/dcbor";
import {
  parse,
  matches,
  getPaths,
  formatPathsStr,
  assertActualExpected,
} from "./common";

describe("advanced nested patterns", () => {
  it("test_simple_nested_tagged_array", () => {
    const pattern = parse(`tagged(100, ["target"])`);

    // Should match: 100(["target"])
    const matchCase = toTaggedValue(100, ["target"]);
    expect(matches(pattern, matchCase)).toBe(true);

    const paths = getPaths(pattern, matchCase);
    const expected = `100(["target"])`;
    assertActualExpected(formatPathsStr(paths), expected);

    // Should not match: 100([42])
    const noMatchCase = toTaggedValue(100, [42]);
    expect(matches(pattern, noMatchCase)).toBe(false);
    const noMatchPaths = getPaths(pattern, noMatchCase);
    expect(noMatchPaths.length).toBe(0);

    // Should not match: 101(["target"])
    const wrongTagCase = toTaggedValue(101, ["target"]);
    expect(matches(pattern, wrongTagCase)).toBe(false);
    const wrongTagPaths = getPaths(pattern, wrongTagCase);
    expect(wrongTagPaths.length).toBe(0);
  });

  it("test_complex_nested_tagged_array_with_repeat", () => {
    const pattern = parse(`tagged(100, [(*)*, "target", (*)*])`);

    // Should match: 100(["target"])
    const case1 = toTaggedValue(100, ["target"]);
    expect(matches(pattern, case1)).toBe(true);
    const paths1 = getPaths(pattern, case1);
    const expected1 = `100(["target"])`;
    assertActualExpected(formatPathsStr(paths1), expected1);

    // Should match: 100([1, "target"])
    const case2 = toTaggedValue(100, [1, "target"]);
    expect(matches(pattern, case2)).toBe(true);
    const paths2 = getPaths(pattern, case2);
    const expected2 = `100([1, "target"])`;
    assertActualExpected(formatPathsStr(paths2), expected2);

    // Should match: 100(["target", 2])
    const case3 = toTaggedValue(100, ["target", 2]);
    expect(matches(pattern, case3)).toBe(true);
    const paths3 = getPaths(pattern, case3);
    const expected3 = `100(["target", 2])`;
    assertActualExpected(formatPathsStr(paths3), expected3);

    // Should match: 100([1, "target", 2])
    const case4 = toTaggedValue(100, [1, "target", 2]);
    expect(matches(pattern, case4)).toBe(true);
    const paths4 = getPaths(pattern, case4);
    const expected4 = `100([1, "target", 2])`;
    assertActualExpected(formatPathsStr(paths4), expected4);

    // Should not match: 100([1, 2])
    const noMatch = toTaggedValue(100, [1, 2]);
    expect(matches(pattern, noMatch)).toBe(false);
    const noMatchPaths = getPaths(pattern, noMatch);
    expect(noMatchPaths.length).toBe(0);
  });

  it("test_map_with_array_constraints", () => {
    const pattern = parse(`{"users": [{3,}]}`);

    // Should match: {"users": [1, 2, 3]}
    const case1 = cbor({ users: [1, 2, 3] });
    expect(matches(pattern, case1)).toBe(true);
    const paths1 = getPaths(pattern, case1);
    const expected1 = `{"users": [1, 2, 3]}`;
    assertActualExpected(formatPathsStr(paths1), expected1);

    // Should match: {"users": [1, 2, 3, 4]}
    const case2 = cbor({ users: [1, 2, 3, 4] });
    expect(matches(pattern, case2)).toBe(true);
    const paths2 = getPaths(pattern, case2);
    const expected2 = `{"users": [1, 2, 3, 4]}`;
    assertActualExpected(formatPathsStr(paths2), expected2);

    // Should not match: {"users": [1, 2]}
    const noMatch1 = cbor({ users: [1, 2] });
    expect(matches(pattern, noMatch1)).toBe(false);
    const noMatchPaths1 = getPaths(pattern, noMatch1);
    expect(noMatchPaths1.length).toBe(0);

    // Should not match: {"items": [1, 2, 3]}
    const noMatch2 = cbor({ items: [1, 2, 3] });
    expect(matches(pattern, noMatch2)).toBe(false);
    const noMatchPaths2 = getPaths(pattern, noMatch2);
    expect(noMatchPaths2.length).toBe(0);
  });

  it("test_array_starting_with_maps", () => {
    const pattern = parse(`[{"id": number}, (*)*]`);

    // Should match: [{"id": 42}]
    const case1 = cbor([{ id: 42 }]);
    expect(matches(pattern, case1)).toBe(true);
    const paths1 = getPaths(pattern, case1);
    const expected1 = `[{"id": 42}]`;
    assertActualExpected(formatPathsStr(paths1), expected1);

    // Should match: [{"id": 42}, "extra"]
    const case2 = cbor([{ id: 42 }, "extra"]);
    expect(matches(pattern, case2)).toBe(true);
    const paths2 = getPaths(pattern, case2);
    const expected2 = `[{"id": 42}, "extra"]`;
    assertActualExpected(formatPathsStr(paths2), expected2);

    // Should match: [{"id": 42}, 123, true]
    const case3 = cbor([{ id: 42 }, 123, true]);
    expect(matches(pattern, case3)).toBe(true);
    const paths3 = getPaths(pattern, case3);
    const expected3 = `[{"id": 42}, 123, true]`;
    assertActualExpected(formatPathsStr(paths3), expected3);

    // Should not match: [{"name": "test"}]
    const noMatch1 = cbor([{ name: "test" }]);
    expect(matches(pattern, noMatch1)).toBe(false);

    // Should not match: ["string", {"id": 42}]
    const noMatch2 = cbor(["string", { id: 42 }]);
    expect(matches(pattern, noMatch2)).toBe(false);
  });

  it("test_deeply_nested_structures", () => {
    const pattern = parse(`tagged(200, {"data": [{"value": number}]})`);

    // Should match: 200({"data": [{"value": 42}]})
    const case1 = toTaggedValue(200, { data: [{ value: 42 }] });
    expect(matches(pattern, case1)).toBe(true);
    const paths1 = getPaths(pattern, case1);
    const expected1 = `200({"data": [{"value": 42}]})`;
    assertActualExpected(formatPathsStr(paths1), expected1);

    // Should not match: 200({"data": [{"name": "test"}]})
    const noMatch = toTaggedValue(200, { data: [{ name: "test" }] });
    expect(matches(pattern, noMatch)).toBe(false);
  });

  it("test_deeply_nested_structures_with_multiple_maps", () => {
    // For multiple maps, we need a repeat pattern
    const pattern = parse(`tagged(200, {"data": [({"value": number})*]})`);

    // Should match: 200({"data": []}) - zero maps
    const case0 = toTaggedValue(200, { data: [] });
    expect(matches(pattern, case0)).toBe(true);
    const paths0 = getPaths(pattern, case0);
    const expected0 = `200({"data": []})`;
    assertActualExpected(formatPathsStr(paths0), expected0);

    // Should match: 200({"data": [{"value": 42}]}) - one map
    const case1 = toTaggedValue(200, { data: [{ value: 42 }] });
    expect(matches(pattern, case1)).toBe(true);
    const paths1 = getPaths(pattern, case1);
    const expected1 = `200({"data": [{"value": 42}]})`;
    assertActualExpected(formatPathsStr(paths1), expected1);

    // Should match: 200({"data": [{"value": 1}, {"value": 2}]}) - multiple maps
    const case2 = toTaggedValue(200, { data: [{ value: 1 }, { value: 2 }] });
    expect(matches(pattern, case2)).toBe(true);
    const paths2 = getPaths(pattern, case2);
    const expected2 = `200({"data": [{"value": 1}, {"value": 2}]})`;
    assertActualExpected(formatPathsStr(paths2), expected2);

    // Should not match: 200({"data": [{"value": 1}, {"name": "test"}]}) - mixed valid/invalid
    const noMatch = toTaggedValue(200, { data: [{ value: 1 }, { name: "test" }] });
    expect(matches(pattern, noMatch)).toBe(false);
  });

  it("test_multiple_levels_of_nesting_with_any", () => {
    const pattern = parse(`tagged(300, [{*: *}, (*)*])`);

    // Should match: 300([{"key": "value"}])
    const case1 = toTaggedValue(300, [{ key: "value" }]);
    expect(matches(pattern, case1)).toBe(true);
    const paths1 = getPaths(pattern, case1);
    const expected1 = `300([{"key": "value"}])`;
    assertActualExpected(formatPathsStr(paths1), expected1);

    // Should match: 300([{42: true}, "extra", 123])
    // Note: We need to use CborMap for non-string keys
    // For this test, we'll use a simpler approach with string keys
    const case2Alt = toTaggedValue(300, [{ "42": true }, "extra", 123]);
    expect(matches(pattern, case2Alt)).toBe(true);
    const paths2 = getPaths(pattern, case2Alt);
    const expected2 = `300([{"42": true}, "extra", 123])`;
    assertActualExpected(formatPathsStr(paths2), expected2);

    // Should not match: 300(["string"])
    const noMatch = toTaggedValue(300, ["string"]);
    expect(matches(pattern, noMatch)).toBe(false);
  });

  it("test_extreme_nesting_depth", () => {
    // Test deeply nested structures for performance
    const pattern = parse(`tagged(400, {"level1": {"level2": {"level3": [42]}}})`);

    const deepStructure = toTaggedValue(400, {
      level1: { level2: { level3: [42] } },
    });
    expect(matches(pattern, deepStructure)).toBe(true);
    const paths = getPaths(pattern, deepStructure);
    const expected = `400({"level1": {"level2": {"level3": [42]}}})`;
    assertActualExpected(formatPathsStr(paths), expected);

    const wrongStructure = toTaggedValue(400, {
      level1: { level2: { level3: [43] } },
    });
    expect(matches(pattern, wrongStructure)).toBe(false);
  });

  it("test_complex_combined_patterns", () => {
    // Combining multiple advanced patterns
    const pattern = parse(`tagged(500, [{"type": "user"}, {"id": number}, ({"name": text} | {"email": text})*])`);

    // Minimum valid structure
    const case1 = toTaggedValue(500, [{ type: "user" }, { id: 123 }]);
    expect(matches(pattern, case1)).toBe(true);
    const paths1 = getPaths(pattern, case1);
    const expected1 = `500([{"type": "user"}, {"id": 123}])`;
    assertActualExpected(formatPathsStr(paths1), expected1);

    // With optional name map
    const case2 = toTaggedValue(500, [
      { type: "user" },
      { id: 123 },
      { name: "John" },
    ]);
    expect(matches(pattern, case2)).toBe(true);
    const paths2 = getPaths(pattern, case2);
    const expected2 = `500([{"type": "user"}, {"id": 123}, {"name": "John"}])`;
    assertActualExpected(formatPathsStr(paths2), expected2);

    // With optional email map
    const case3 = toTaggedValue(500, [
      { type: "user" },
      { id: 123 },
      { email: "john@example.com" },
    ]);
    expect(matches(pattern, case3)).toBe(true);
    const paths3 = getPaths(pattern, case3);
    const expected3 = `500([{"type": "user"}, {"id": 123}, {"email": "john@example.com"}])`;
    assertActualExpected(formatPathsStr(paths3), expected3);

    // With multiple optional maps
    const case4 = toTaggedValue(500, [
      { type: "user" },
      { id: 123 },
      { name: "John" },
      { email: "john@example.com" },
    ]);
    expect(matches(pattern, case4)).toBe(true);
    const paths4 = getPaths(pattern, case4);
    const expected4 = `500([{"type": "user"}, {"id": 123}, {"name": "John"}, {"email": "john@example.com"}])`;
    assertActualExpected(formatPathsStr(paths4), expected4);
  });
});
