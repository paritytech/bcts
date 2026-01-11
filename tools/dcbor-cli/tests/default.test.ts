/**
 * Tests for the default command
 *
 * Ported from:
 * - ref/bc-dcbor-cli/tests/test_default.rs
 * - ref/bc-dcbor-cli/src/main.rs (inline tests)
 */

import { describe, it } from "vitest";
import { runCliExpect, diagToHex, hexToDiag, testRoundTrip } from "./common.js";

describe("default command", () => {
  describe("diag to hex conversion", () => {
    it("converts simple values", () => {
      runCliExpect(diagToHex("42"), "182a");
      runCliExpect(diagToHex('"Hello"'), "6548656c6c6f");
      runCliExpect(diagToHex("true"), "f5");
      runCliExpect(diagToHex("false"), "f4");
      runCliExpect(diagToHex("null"), "f6");
    });
  });

  describe("hex to diag conversion", () => {
    it("converts simple values", () => {
      runCliExpect(hexToDiag("182a"), "42");
      runCliExpect(hexToDiag("6548656c6c6f"), '"Hello"');
      runCliExpect(hexToDiag("f5"), "true");
      runCliExpect(hexToDiag("f4"), "false");
      runCliExpect(hexToDiag("f6"), "null");
    });
  });

  describe("annotations", () => {
    it("annotates hex output", () => {
      runCliExpect(diagToHex("42", true), "182a    # unsigned(42)");
    });

    it("diag output ignores annotate flag", () => {
      runCliExpect(hexToDiag("182a", true), "42");
    });
  });

  describe("complex structures", () => {
    it("handles arrays", () => {
      runCliExpect(diagToHex("[1, 2, 3]"), "83010203");
      runCliExpect(hexToDiag("83010203"), "[1, 2, 3]");
    });

    it("handles maps", () => {
      runCliExpect(diagToHex("{1: 2, 3: 4}"), "a201020304");
      runCliExpect(hexToDiag("a201020304"), "{1: 2, 3: 4}");
    });
  });

  describe("round-trip conversions", () => {
    it("round-trips integer", () => {
      testRoundTrip("42", "182a");
    });

    it("round-trips string", () => {
      testRoundTrip('"Hello"', "6548656c6c6f");
    });

    it("round-trips array", () => {
      testRoundTrip("[1, 2, 3]", "83010203");
    });

    it("round-trips map", () => {
      testRoundTrip("{1: 2}", "a10102");
    });

    it("round-trips boolean", () => {
      testRoundTrip("true", "f5");
      testRoundTrip("false", "f4");
    });

    it("round-trips null", () => {
      testRoundTrip("null", "f6");
    });
  });

  describe("tagged values", () => {
    it("handles date tags", () => {
      runCliExpect(diagToHex("1(1747267200)"), "c11a68252e80");
      runCliExpect(hexToDiag("c11a68252e80"), "1(1747267200)");
    });

    it("handles custom tags", () => {
      runCliExpect(diagToHex("40000(0)"), "d99c4000");
      runCliExpect(hexToDiag("d99c4000"), "40000(0)");
    });
  });

  describe("inline tests from main.rs", () => {
    it("round-trips zero", () => {
      testRoundTrip("0", "00");
    });

    it("round-trips float", () => {
      testRoundTrip("3.14", "fb40091eb851eb851f");
    });

    it("round-trips Infinity", () => {
      testRoundTrip("Infinity", "f97c00");
    });

    it("round-trips -Infinity", () => {
      testRoundTrip("-Infinity", "f9fc00");
    });

    it("round-trips NaN", () => {
      testRoundTrip("NaN", "f97e00");
    });

    it("round-trips text with special chars", () => {
      testRoundTrip('"Hello, world!"', "6d48656c6c6f2c20776f726c6421");
    });

    it("round-trips bytestring", () => {
      testRoundTrip("h'0102030405060708090a'", "4a0102030405060708090a");
    });

    it("round-trips base64 bytestring to hex bytestring", () => {
      testRoundTrip("b64'AQIDBAUGBwgJCg=='", "4a0102030405060708090a", "h'0102030405060708090a'");
    });

    it("round-trips array with booleans and null", () => {
      testRoundTrip("[true, false, null]", "83f5f4f6");
    });

    it("round-trips map with string values", () => {
      testRoundTrip(
        '{1: "value1", 2: "value2", 3: "value3"}',
        "a3016676616c756531026676616c756532036676616c756533",
      );
    });

    it("round-trips complex nested structure", () => {
      testRoundTrip(
        '{"key1": h\'0102\', "key2": "value2", "key3": {1: "value1", 2: "value2", 3: "value3"}}',
        "a3646b657931420102646b6579326676616c756532646b657933a3016676616c756531026676616c756532036676616c756533",
      );
    });

    it("round-trips known value tags", () => {
      testRoundTrip("40000(0)", "d99c4000");
      testRoundTrip("40000(1)", "d99c4001");
    });
  });
});
