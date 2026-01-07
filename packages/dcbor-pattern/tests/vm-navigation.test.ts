/**
 * VM navigation tests ported from vm_navigation_tests.rs
 *
 * These tests verify how the pattern VM navigates through CBOR data structures
 * using different axis types (ArrayElement, MapValue) and captures elements.
 */

import { describe, it, expect } from "vitest";
import { summary } from "@bcts/dcbor";
import { cbor, assertActualExpected } from "./common";
import {
  run,
  type Program,
  type Instr,
  type Axis,
  type Pattern,
  any,
  number,
  text,
  formatPaths,
  type Path,
} from "../src";

/**
 * Helper to run the VM and get paths and captures in a convenient format.
 * The Rust `run` function returns (Vec<Path>, HashMap<String, Vec<Path>>).
 * In TypeScript, `run` returns { paths: Path[]; captures: Map<string, Path[]> }.
 */
const runVm = (
  program: Program,
  cborData: ReturnType<typeof cbor>,
): [Path[], Map<string, Path[]>] => {
  const result = run(program, cborData);
  return [result.paths, result.captures];
};

describe("vm navigation tests", () => {
  it("test_vm_array_navigation", () => {
    // Test how PushAxis(ArrayElement) works
    const cborData = cbor([42]);

    // Create a simple program that navigates to array elements and captures them
    const code: Instr[] = [
      { type: "PushAxis", axis: "ArrayElement" as Axis }, // Navigate to array elements
      { type: "CaptureStart", captureIndex: 0 }, // Start capture
      { type: "MatchPredicate", literalIndex: 0 }, // Match `42`
      { type: "CaptureEnd", captureIndex: 0 }, // End capture
      { type: "Accept" }, // Accept the match
    ];

    const literals: Pattern[] = [
      number(42), // Pattern to match
    ];

    const captureNames: string[] = ["item"];

    const program: Program = { code, literals, captureNames };

    const [vmPaths, vmCaptures] = runVm(program, cborData);

    const expectedPaths = `[42]
    42`;
    assertActualExpected(formatPaths(vmPaths), expectedPaths);

    // Verify capture
    expect(vmCaptures.size).toBe(1);
    expect(vmCaptures.has("item")).toBe(true);
    const capturedPaths = vmCaptures.get("item");
    expect(capturedPaths).toBeDefined();
    expect(capturedPaths?.length).toBe(1);

    // Verify the captured path contains [42] and 42
    const capturedPath = capturedPaths?.[0];
    expect(capturedPath?.length).toBe(2);

    // The first element should be the array [42]
    const firstElement = capturedPath?.[0];
    expect(firstElement ? summary(firstElement) : undefined).toBe("[42]");

    // The second element should be 42
    const secondElement = capturedPath?.[1];
    expect(secondElement ? summary(secondElement) : undefined).toBe("42");
  });

  it("test_vm_map_navigation", () => {
    // Test how PushAxis(MapValue) works
    const cborData = cbor({ key: "value" });

    const code: Instr[] = [
      { type: "PushAxis", axis: "MapValue" as Axis }, // Navigate to map values
      { type: "CaptureStart", captureIndex: 0 }, // Start capture
      { type: "MatchPredicate", literalIndex: 0 }, // Match "value"
      { type: "CaptureEnd", captureIndex: 0 }, // End capture
      { type: "Accept" }, // Accept the match
    ];

    const literals: Pattern[] = [
      text("value"), // Pattern to match
    ];

    const captureNames: string[] = ["value"];

    const program: Program = { code, literals, captureNames };

    const [vmPaths, vmCaptures] = runVm(program, cborData);

    const expectedPaths = `{"key": "value"}
    "value"`;
    assertActualExpected(formatPaths(vmPaths), expectedPaths);

    // Verify capture
    expect(vmCaptures.size).toBe(1);
    expect(vmCaptures.has("value")).toBe(true);
    const capturedPaths = vmCaptures.get("value");
    expect(capturedPaths).toBeDefined();
    expect(capturedPaths?.length).toBe(1);

    // Verify the captured path
    const capturedPath = capturedPaths?.[0];
    expect(capturedPath?.length).toBe(2);

    // The first element should be the map
    const firstElement = capturedPath?.[0];
    expect(firstElement ? summary(firstElement) : undefined).toBe('{"key": "value"}');

    // The second element should be the value
    const secondElement = capturedPath?.[1];
    expect(secondElement ? summary(secondElement) : undefined).toBe('"value"');
  });

  it("test_vm_nested_navigation", () => {
    // Test navigation through nested structures
    const cborData = cbor([{ inner: 42 }]);

    const code: Instr[] = [
      { type: "PushAxis", axis: "ArrayElement" as Axis }, // Navigate to array elements
      { type: "PushAxis", axis: "MapValue" as Axis }, // Navigate to map values
      { type: "CaptureStart", captureIndex: 0 }, // Start capture
      { type: "MatchPredicate", literalIndex: 0 }, // Match `42`
      { type: "CaptureEnd", captureIndex: 0 }, // End capture
      { type: "Accept" }, // Accept the match
    ];

    const literals: Pattern[] = [
      number(42), // Pattern to match
    ];

    const captureNames: string[] = ["nested"];

    const program: Program = { code, literals, captureNames };

    const [vmPaths, vmCaptures] = runVm(program, cborData);

    const expectedPaths = `[{"inner": 42}]
    {"inner": 42}
        42`;
    assertActualExpected(formatPaths(vmPaths), expectedPaths);

    // Verify capture
    expect(vmCaptures.size).toBe(1);
    expect(vmCaptures.has("nested")).toBe(true);
    const capturedPaths = vmCaptures.get("nested");
    expect(capturedPaths).toBeDefined();
    expect(capturedPaths?.length).toBe(1);

    // Verify the captured path contains 3 elements
    const capturedPath = capturedPaths?.[0];
    expect(capturedPath?.length).toBe(3);

    // The first element should be the outer array
    const firstElement = capturedPath?.[0];
    expect(firstElement ? summary(firstElement) : undefined).toBe('[{"inner": 42}]');

    // The second element should be the inner map
    const secondElement = capturedPath?.[1];
    expect(secondElement ? summary(secondElement) : undefined).toBe('{"inner": 42}');

    // The third element should be 42
    const thirdElement = capturedPath?.[2];
    expect(thirdElement ? summary(thirdElement) : undefined).toBe("42");
  });

  it("test_vm_multiple_captures", () => {
    // Test multiple captures in sequence
    const cborData = cbor([42, 100]);

    const code: Instr[] = [
      { type: "PushAxis", axis: "ArrayElement" as Axis }, // Navigate to array elements
      { type: "CaptureStart", captureIndex: 0 }, // Start first capture
      { type: "MatchPredicate", literalIndex: 0 }, // Match *
      { type: "CaptureEnd", captureIndex: 0 }, // End first capture
      { type: "Accept" }, // Accept the match
    ];

    const literals: Pattern[] = [
      any(), // Pattern to match any element
    ];

    const captureNames: string[] = ["element"];

    const program: Program = { code, literals, captureNames };

    const [vmPaths, vmCaptures] = runVm(program, cborData);

    // Should capture both elements
    const expectedPaths = `[42, 100]
    100
[42, 100]
    42`;
    assertActualExpected(formatPaths(vmPaths), expectedPaths);

    // Note: VM captures may contain multiple entries for the same name
    // when matching multiple elements
    expect(vmCaptures.size).toBeGreaterThan(0);
  });

  it("test_vm_no_match_navigation", () => {
    // Test navigation when no match is found
    const cborData = cbor([100]); // Different number

    const code: Instr[] = [
      { type: "PushAxis", axis: "ArrayElement" as Axis }, // Navigate to array elements
      { type: "CaptureStart", captureIndex: 0 }, // Start capture
      { type: "MatchPredicate", literalIndex: 0 }, // Match `42` - won't match
      { type: "CaptureEnd", captureIndex: 0 }, // End capture
      { type: "Accept" }, // Accept the match
    ];

    const literals: Pattern[] = [
      number(42), // Pattern that won't match
    ];

    const captureNames: string[] = ["item"];

    const program: Program = { code, literals, captureNames };

    const [vmPaths, vmCaptures] = runVm(program, cborData);

    // Should have no paths or captures when no match
    expect(vmPaths.length).toBe(0);
    expect(vmCaptures.size).toBe(0);
  });
});
