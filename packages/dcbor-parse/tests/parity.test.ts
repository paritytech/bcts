/**
 * Parity tests - ensuring exact match with Rust bc-dcbor-parse behavior
 *
 * These tests verify the specific edge cases identified in the parity analysis
 * where TypeScript and Rust behavior may differ.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { registerTags } from "@bcts/tags";
import { parseDcborItem } from "../src/parse";

// Register tags before running tests
beforeAll(() => {
  registerTags();
});

describe("Parity with Rust bc-dcbor-parse", () => {
  describe("Invalid date validation (Rust expects InvalidDateString)", () => {
    it("should error on invalid month (13)", () => {
      // Rust: check_error("2023-13-01", |e| matches!(e, ParseError::InvalidDateString(_, _)));
      const result = parseDcborItem("2023-13-01");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidDateString");
      }
    });

    it("should error on invalid day (30 in February)", () => {
      // Rust: check_error("2023-02-30", |e| matches!(e, ParseError::InvalidDateString(_, _)));
      const result = parseDcborItem("2023-02-30");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidDateString");
      }
    });

    it("should error on day 32", () => {
      const result = parseDcborItem("2023-01-32");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidDateString");
      }
    });

    it("should error on month 0", () => {
      const result = parseDcborItem("2023-00-15");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidDateString");
      }
    });

    it("should error on day 0", () => {
      const result = parseDcborItem("2023-06-00");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidDateString");
      }
    });
  });

  describe("Base64 validation (Rust expects InvalidBase64String)", () => {
    it("should error on base64 missing padding", () => {
      // Rust: check_error("b64'AQIDBAUGBwgJCg'", |e| matches!(e, ParseError::InvalidBase64String(_)));
      // This is missing the '==' padding that should be there
      const result = parseDcborItem("b64'AQIDBAUGBwgJCg'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidBase64String");
      }
    });

    it("should accept properly padded base64", () => {
      // Same content but with proper padding
      const result = parseDcborItem("b64'AQIDBAUGBwgJCg=='");
      expect(result.ok).toBe(true);
    });

    it("should error on base64 with wrong padding length", () => {
      // Single = when two are needed
      const result = parseDcborItem("b64'AQIDBAUGBwgJCg='");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidBase64String");
      }
    });

    it("should error on base64 with invalid characters", () => {
      const result = parseDcborItem("b64'!!!invalid!!!'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("InvalidBase64String");
      }
    });
  });
});
