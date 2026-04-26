/**
 * @bcts/envelope-pattern — `leaf` keyword parsing
 *
 * Port of `bc-envelope-pattern-rust/tests/test_leaf_parsing.rs`.
 *
 * Pins the post-refactor categorization of `leaf`: it is a Structure
 * pattern (not a Leaf pattern any more) and renders as the bare
 * keyword `leaf`.
 */

import { describe, it, expect } from "vitest";
import { parse, patternToString } from "../src";

describe("Leaf keyword parsing (test_leaf_parsing.rs)", () => {
  it("parses `leaf` as a Structure pattern", () => {
    const r = parse("leaf");
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Mirrors Rust `match pattern { Pattern::Structure(_) => OK,
      // Pattern::Leaf(_) | Pattern::Meta(_) => panic }`.
      expect(r.value.type).toBe("Structure");
    }
  });

  it("displays `leaf` as `leaf`", () => {
    const r = parse("leaf");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(patternToString(r.value)).toBe("leaf");
    }
  });
});
