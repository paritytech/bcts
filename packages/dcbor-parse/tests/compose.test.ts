/**
 * Compose tests - 1:1 port of test_compose.rs
 */

import { describe, it, expect } from "vitest";
import { diagnosticOpt } from "@bcts/dcbor";
import { parseDcborItem } from "../src/parse";
import { composeDcborArray, composeDcborMap } from "../src/compose";

function toDiagnosticFlat(cbor: Parameters<typeof diagnosticOpt>[0]): string {
  return diagnosticOpt(cbor, { flat: true });
}

function roundtripArray(array: readonly string[], expectedDiag: string): void {
  const result = composeDcborArray(array);
  expect(result.ok).toBe(true);
  if (result.ok) {
    const diag = toDiagnosticFlat(result.value);
    expect(diag).toBe(expectedDiag);

    // Parse it back and verify
    const parseResult = parseDcborItem(diag);
    expect(parseResult.ok).toBe(true);
    if (parseResult.ok) {
      expect(toDiagnosticFlat(parseResult.value)).toBe(
        toDiagnosticFlat(result.value)
      );
    }
  }
}

function roundtripMap(array: readonly string[], expectedDiag: string): void {
  const result = composeDcborMap(array);
  expect(result.ok).toBe(true);
  if (result.ok) {
    const diag = toDiagnosticFlat(result.value);
    expect(diag).toBe(expectedDiag);

    // Parse it back and verify
    const parseResult = parseDcborItem(diag);
    expect(parseResult.ok).toBe(true);
    if (parseResult.ok) {
      expect(toDiagnosticFlat(parseResult.value)).toBe(
        toDiagnosticFlat(result.value)
      );
    }
  }
}

describe("compose", () => {
  describe("composeDcborArray", () => {
    it("should compose empty array", () => {
      roundtripArray([], "[]");
    });

    it("should compose integer array", () => {
      roundtripArray(["1", "2", "3"], "[1, 2, 3]");
    });

    it("should compose string array", () => {
      roundtripArray(['"hello"', '"world"'], '["hello", "world"]');
    });

    it("should compose mixed types array", () => {
      roundtripArray(
        ["true", "false", "null", "3.14"],
        "[true, false, null, 3.14]"
      );
    });

    it("should compose nested arrays", () => {
      roundtripArray(["[1, 2]", "[3, 4]"], "[[1, 2], [3, 4]]");
    });

    it("should error on empty item", () => {
      const result = composeDcborArray(["1", "2", "", "4"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("ParseError");
        if (result.error.type === "ParseError") {
          expect(result.error.error.type).toBe("EmptyInput");
        }
      }
    });
  });

  describe("composeDcborMap", () => {
    it("should compose empty map", () => {
      roundtripMap([], "{}");
    });

    it("should compose integer key-value map", () => {
      roundtripMap(["1", "2", "3", "4"], "{1: 2, 3: 4}");
    });

    it("should compose mixed key-value map", () => {
      roundtripMap(
        ["true", "false", "null", "null"],
        "{true: false, null: null}"
      );
    });

    it("should compose string key-value map", () => {
      roundtripMap(
        ['"key1"', '"value1"', '"key2"', '"value2"'],
        '{"key1": "value1", "key2": "value2"}'
      );
    });

    it("should compose nested maps", () => {
      roundtripMap(["{1: 2}", "{3: 4}"], "{{1: 2}: {3: 4}}");
    });

    it("should sort keys", () => {
      roundtripMap(["3", "4", "1", "2"], "{1: 2, 3: 4}");
    });

    it("should error on duplicate keys", () => {
      const result = composeDcborMap(["1", "2", "1", "3"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("DuplicateMapKey");
      }
    });

    it("should error on odd number of items", () => {
      const result = composeDcborMap(["1", "2", "3"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("OddMapLength");
      }
    });

    it("should error on empty item", () => {
      const result = composeDcborMap(["1", "2", "", "4"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("ParseError");
        if (result.error.type === "ParseError") {
          expect(result.error.error.type).toBe("EmptyInput");
        }
      }
    });
  });
});
