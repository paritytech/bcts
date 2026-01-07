/**
 * Array comma display tests ported from test_array_comma_display.rs
 *
 * Tests for verifying that array sequence patterns display with proper comma formatting.
 */

import { describe, it, expect } from "vitest";
import { parse, display } from "./common";

describe("array comma display", () => {
  it("test_array_sequence_display_format", () => {
    const pattern = parse('["a", "b"]');
    const displayStr = display(pattern);
    expect(displayStr).toBe('["a", "b"]');
  });

  it("test_complex_array_sequence_display", () => {
    const pattern = parse("[(*)*, 42, (*)*]");
    const displayStr = display(pattern);
    expect(displayStr).toBe("[(*)*, 42, (*)*]");
  });
});
