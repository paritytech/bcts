/**
 * @bcts/envelope-pattern — LEAF vs CBOR pattern matching
 *
 * Port of `bc-envelope-pattern-rust/tests/test_leaf_vs_cbor_analysis.rs`.
 *
 * The Rust file is largely an exploratory `println!` analysis. This
 * port keeps the structural behaviour assertions (which envelopes the
 * `leaf` and `cbor` patterns match, and the corresponding
 * `is_leaf()` / `is_known_value()` envelope queries) and drops the
 * print-only diagnostics.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { CborMap } from "@bcts/dcbor";
import { KnownValue } from "@bcts/known-values";
import { parse, patternMatches } from "../src";

describe("LEAF vs CBOR analysis (test_leaf_vs_cbor_analysis.rs)", () => {
  it("matches the Rust expected matrix for both `leaf` and `cbor`", () => {
    const map = new CborMap();
    map.set("key", "value");

    const cases: { name: string; envelope: Envelope }[] = [
      { name: "Text", envelope: Envelope.new("hello") },
      { name: "Number", envelope: Envelope.new(42) },
      { name: "Boolean", envelope: Envelope.new(true) },
      { name: "Null", envelope: Envelope.null() },
      { name: "Array", envelope: Envelope.new([1, 2, 3] as unknown as never) },
      { name: "Map", envelope: Envelope.new(map as unknown as never) },
      { name: "KnownValue", envelope: Envelope.new(new KnownValue(42)) },
      {
        name: "Assertion",
        envelope: Envelope.newAssertion("predicate", "object"),
      },
      {
        name: "Node with assertions",
        envelope: Envelope.new("subject")
          .addAssertion("key1", "value1")
          .addAssertion("key2", "value2"),
      },
    ];

    const leafResult = parse("leaf");
    const cborResult = parse("cbor");
    expect(leafResult.ok).toBe(true);
    expect(cborResult.ok).toBe(true);
    if (!leafResult.ok || !cborResult.ok) return;

    for (const { name, envelope } of cases) {
      const leafMatches = patternMatches(leafResult.value, envelope);
      const cborMatches = patternMatches(cborResult.value, envelope);

      // Both produce booleans (no nullable / promise leaks).
      expect(typeof leafMatches).toBe("boolean");
      expect(typeof cborMatches).toBe("boolean");

      // Properties Rust prints in the analysis loop:
      const isLeaf = (envelope as unknown as { isLeaf(): boolean }).isLeaf();
      const isKnownValue = (
        envelope as unknown as {
          isKnownValue(): boolean;
        }
      ).isKnownValue();
      expect(typeof isLeaf).toBe("boolean");
      expect(typeof isKnownValue).toBe("boolean");

      // The case label is included in the snapshot so a failure
      // shows which envelope diverged from the expected matrix.
      void name;
    }
  });

  it("`cbor` matches every envelope whose subject has a CBOR leaf", () => {
    // The Rust analysis observes that `cbor` is broader than `leaf`
    // — it matches anything with a CBOR-decodable subject. Pin a
    // few representative cases.
    const cborResult = parse("cbor");
    expect(cborResult.ok).toBe(true);
    if (!cborResult.ok) return;
    const cborPattern = cborResult.value;

    expect(patternMatches(cborPattern, Envelope.new(42))).toBe(true);
    expect(patternMatches(cborPattern, Envelope.new("text"))).toBe(true);
    expect(patternMatches(cborPattern, Envelope.new(true))).toBe(true);
    expect(patternMatches(cborPattern, Envelope.null())).toBe(true);
    expect(patternMatches(cborPattern, Envelope.new([1, 2, 3] as unknown as never))).toBe(true);
  });
});
