/**
 * Tests for verifying canonical format of parsed patterns.
 * Ported from bc-dcbor-pattern-rust/tests/verify_canonical_format.rs
 */

import { describe, it, expect } from "vitest";
import { parse, patternDisplay } from "../src";

describe("verify canonical format", () => {
  it("parsing with spaces produces canonical format", () => {
    // Parse patterns with spaces (should work)
    const orWithSpaces = parse("bool | text | number");
    const andWithSpaces = parse("bool & text & number");

    expect(orWithSpaces.ok).toBe(true);
    expect(andWithSpaces.ok).toBe(true);

    // Parse patterns without spaces (should also work)
    const orNoSpaces = parse("bool|text|number");
    const andNoSpaces = parse("bool&text&number");

    expect(orNoSpaces.ok).toBe(true);
    expect(andNoSpaces.ok).toBe(true);

    if (orWithSpaces.ok && orNoSpaces.ok) {
      // Both should produce the same canonical format
      expect(patternDisplay(orNoSpaces.value)).toBe(patternDisplay(orWithSpaces.value));

      // Verify canonical format has spaces
      expect(patternDisplay(orWithSpaces.value)).toBe("bool | text | number");
    }

    if (andWithSpaces.ok && andNoSpaces.ok) {
      // Both should produce the same canonical format
      expect(patternDisplay(andNoSpaces.value)).toBe(patternDisplay(andWithSpaces.value));

      // Verify canonical format has spaces
      expect(patternDisplay(andWithSpaces.value)).toBe("bool & text & number");
    }
  });
});
