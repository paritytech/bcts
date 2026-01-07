/**
 * Extra data behavior tests for dCBOR patterns.
 *
 * Tests that the parser correctly rejects patterns with trailing extra data.
 */

import { describe, it, expect } from "vitest";
import { parse } from "../src";

describe("extra data behavior", () => {
  it("should parse 'true' successfully with no extra data", () => {
    const result = parse("true");
    expect(result.ok).toBe(true);
  });

  it("should fail on 'true extra' - valid pattern followed by extra data", () => {
    const result = parse("true extra");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should be either ExtraData or UnrecognizedToken error
      expect(["ExtraData", "UnrecognizedToken"]).toContain(result.error.type);
    }
  });

  it("should fail on 'true false' - valid pattern followed by another pattern", () => {
    const result = parse("true false");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should be either ExtraData or UnrecognizedToken error
      expect(["ExtraData", "UnrecognizedToken"]).toContain(result.error.type);
    }
  });

  it("should fail on '42    more stuff' - valid pattern followed by whitespace and more", () => {
    const result = parse("42    more stuff");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should be either ExtraData or UnrecognizedToken error
      expect(["ExtraData", "UnrecognizedToken"]).toContain(result.error.type);
    }
  });

  it("should fail on '42 |' - valid pattern followed by a valid token", () => {
    const result = parse("42 |");
    expect(result.ok).toBe(false);
    // The Rust test is more lenient here, accepting any error type
    // We just verify it fails
  });
});
