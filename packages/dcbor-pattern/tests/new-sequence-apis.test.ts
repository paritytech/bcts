/**
 * New sequence API tests ported from test_new_sequence_apis.rs
 *
 * Tests for sequence pattern convenience methods and structure pattern helpers.
 */

import { describe, it, expect } from "vitest";
import { cbor, toTaggedValue } from "@bcts/dcbor";
import {
  sequence,
  text,
  number,
  anyBool,
  capture,
  anyArray,
  anyMap,
  anyTagged,
  patternDisplay,
  patternPaths,
  formatPaths,
  type Pattern,
} from "../src";

describe("new sequence APIs", () => {
  it("test_sequence_pattern_new_api", () => {
    // Test the new sequence() convenience method
    const sequencePattern = sequence(text("first"), text("second"));

    // Verify display format shows sequence syntax
    const display = patternDisplay(sequencePattern);
    expect(display).toContain("first");
    expect(display).toContain("second");
    expect(display).toContain(", "); // Changed from > to comma

    // Verify sequence is marked as complex by having multiple patterns
    // (In TypeScript, we verify this by checking the pattern structure)
    if (sequencePattern.kind === "Meta" && sequencePattern.pattern.type === "Sequence") {
      expect(sequencePattern.pattern.pattern.patterns.length).toBe(2);
    } else {
      expect.fail("Expected a Sequence pattern");
    }
  });

  it("test_structure_convenience_methods", () => {
    // Test new structure pattern convenience methods
    const arrayPattern = anyArray();
    const mapPattern = anyMap();
    const taggedPattern = anyTagged();

    expect(patternDisplay(arrayPattern)).toBe("array"); // Updated for new syntax
    expect(patternDisplay(mapPattern)).toBe("map"); // Updated for new syntax
    expect(patternDisplay(taggedPattern)).toBe("tagged");

    // Test that they work with real CBOR data
    const arrayCbor = cbor([1, 2, 3]);
    const mapCbor = cbor({ key: "value" });
    const taggedCbor = toTaggedValue(42, cbor("content"));

    // Test array pattern paths
    const arrayPaths = patternPaths(arrayPattern, arrayCbor);
    expect(arrayPaths.length).toBeGreaterThan(0);
    const expectedArray = "[1, 2, 3]";
    expect(formatPaths(arrayPaths)).toBe(expectedArray);

    // Test map pattern paths
    const mapPaths = patternPaths(mapPattern, mapCbor);
    expect(mapPaths.length).toBeGreaterThan(0);
    const expectedMap = '{"key": "value"}';
    expect(formatPaths(mapPaths)).toBe(expectedMap);

    // Test tagged pattern paths
    const taggedPaths = patternPaths(taggedPattern, taggedCbor);
    expect(taggedPaths.length).toBeGreaterThan(0);
    const expectedTagged = '42("content")';
    expect(formatPaths(taggedPaths)).toBe(expectedTagged);
  });

  it("test_sequence_pattern_compilation", () => {
    const sequencePattern = sequence(text("a"), number(42), anyBool());

    // Verify the pattern has the correct structure
    if (sequencePattern.kind === "Meta" && sequencePattern.pattern.type === "Sequence") {
      const patterns = sequencePattern.pattern.pattern.patterns;

      // Should have 3 patterns (one for each element)
      expect(patterns.length).toBe(3);

      // Verify the types of the patterns
      expect(patterns[0].kind).toBe("Value");
      expect(patterns[1].kind).toBe("Value");
      expect(patterns[2].kind).toBe("Value");
    } else {
      expect.fail("Expected a Sequence pattern");
    }
  });

  it("test_sequence_pattern_with_captures", () => {
    const sequencePattern = sequence(
      capture("first", text("hello")),
      capture("second", number(42)),
    );

    // Collect capture names by traversing the pattern structure
    const captureNames: string[] = [];

    const collectCaptureNames = (pattern: Pattern): void => {
      if (pattern.kind === "Meta") {
        switch (pattern.pattern.type) {
          case "Capture":
            captureNames.push(pattern.pattern.pattern.name);
            collectCaptureNames(pattern.pattern.pattern.pattern);
            break;
          case "Sequence":
            for (const inner of pattern.pattern.pattern.patterns) {
              collectCaptureNames(inner);
            }
            break;
          case "And":
            for (const inner of pattern.pattern.pattern.patterns) {
              collectCaptureNames(inner);
            }
            break;
          case "Or":
            for (const inner of pattern.pattern.pattern.patterns) {
              collectCaptureNames(inner);
            }
            break;
          case "Not":
            collectCaptureNames(pattern.pattern.pattern.pattern);
            break;
          case "Repeat":
            collectCaptureNames(pattern.pattern.pattern.pattern);
            break;
          case "Search":
            collectCaptureNames(pattern.pattern.pattern.pattern);
            break;
          case "Any":
            // No inner pattern to traverse
            break;
        }
      }
    };

    collectCaptureNames(sequencePattern);

    expect(captureNames.length).toBe(2);
    expect(captureNames).toContain("first");
    expect(captureNames).toContain("second");
  });

  it("test_empty_sequence_pattern", () => {
    const emptySequence = sequence();

    // Empty sequence should display as "()" or empty string
    // Note: The TypeScript implementation may format this differently
    const display = patternDisplay(emptySequence);
    // In TypeScript, an empty sequence displays as empty string when joined with ", "
    expect(display).toBe("");

    // Empty sequence should not be complex (has no patterns)
    if (emptySequence.kind === "Meta" && emptySequence.pattern.type === "Sequence") {
      expect(emptySequence.pattern.pattern.patterns.length).toBe(0);
    } else {
      expect.fail("Expected a Sequence pattern");
    }
  });
});
