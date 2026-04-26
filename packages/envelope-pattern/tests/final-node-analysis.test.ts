/**
 * @bcts/envelope-pattern — NODE pattern behaviour
 *
 * Port of `bc-envelope-pattern-rust/tests/test_final_node_analysis.rs`.
 *
 * Pins the matrix of `node`, `node({0})`, `node({1})`, `node({2})`,
 * `node({1,2})` against envelopes with 0..3 assertions, plus the
 * "LEAF and NODE({0}) are NOT equivalent" comparison.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { KnownValue } from "@bcts/known-values";
import { parse, patternMatches } from "../src";

describe("NODE pattern behaviour (test_final_node_analysis.rs)", () => {
  it("matches the Rust assertion-count matrix", () => {
    const patternSources = [
      { src: "node", label: "NODE (any)" },
      { src: "node({0})", label: "NODE({0})" },
      { src: "node({1})", label: "NODE({1})" },
      { src: "node({2})", label: "NODE({2})" },
      { src: "node({1,2})", label: "NODE({1,2})" },
    ];
    const patterns = patternSources.map(({ src, label }) => {
      const r = parse(src);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(`failed to parse ${src}`);
      return { label, pattern: r.value };
    });

    const cases: { label: string; envelope: Envelope; expectedAssertions: number }[] = [
      { label: "Plain CBOR", envelope: Envelope.new(42), expectedAssertions: 0 },
      {
        label: "Known value",
        envelope: Envelope.new(new KnownValue(42)),
        expectedAssertions: 0,
      },
      {
        label: "1 assertion",
        envelope: Envelope.new("subject").addAssertion("key", "value"),
        expectedAssertions: 1,
      },
      {
        label: "2 assertions",
        envelope: Envelope.new("subject")
          .addAssertion("key1", "value1")
          .addAssertion("key2", "value2"),
        expectedAssertions: 2,
      },
      {
        label: "3 assertions",
        envelope: Envelope.new("subject")
          .addAssertion("key1", "value1")
          .addAssertion("key2", "value2")
          .addAssertion("key3", "value3"),
        expectedAssertions: 3,
      },
    ];

    // Expected match matrix, mirroring Rust's print + "Key findings":
    //   - NODE (any) matches only envelopes with ≥1 assertion (since
    //     a node *by construction* has assertions in bc-envelope).
    //   - NODE({0}) never matches anything.
    //   - NODE({n}) matches when the assertion count equals n.
    //   - NODE({n,m}) matches when the assertion count is in [n,m].
    const expected: Record<string, Record<string, boolean>> = {
      "Plain CBOR":   { "NODE (any)": false, "NODE({0})": false, "NODE({1})": false, "NODE({2})": false, "NODE({1,2})": false },
      "Known value":  { "NODE (any)": false, "NODE({0})": false, "NODE({1})": false, "NODE({2})": false, "NODE({1,2})": false },
      "1 assertion":  { "NODE (any)": true,  "NODE({0})": false, "NODE({1})": true,  "NODE({2})": false, "NODE({1,2})": true },
      "2 assertions": { "NODE (any)": true,  "NODE({0})": false, "NODE({1})": false, "NODE({2})": true,  "NODE({1,2})": true },
      "3 assertions": { "NODE (any)": true,  "NODE({0})": false, "NODE({1})": false, "NODE({2})": false, "NODE({1,2})": false },
    };

    for (const { label, envelope, expectedAssertions } of cases) {
      // Sanity: envelope assertion count matches what we expect.
      const assertions = (envelope as unknown as { assertions(): unknown[] }).assertions();
      expect(assertions.length).toBe(expectedAssertions);

      for (const { label: patLabel, pattern } of patterns) {
        const matches = patternMatches(pattern, envelope);
        expect({ envelope: label, pattern: patLabel, matches }).toEqual({
          envelope: label,
          pattern: patLabel,
          matches: expected[label]?.[patLabel],
        });
      }
    }
  });

  it("LEAF and NODE({0}) are NOT equivalent (final_comparison)", () => {
    const leafResult = parse("leaf");
    const nodeZeroResult = parse("node({0})");
    expect(leafResult.ok).toBe(true);
    expect(nodeZeroResult.ok).toBe(true);
    if (!leafResult.ok || !nodeZeroResult.ok) return;

    const env = Envelope.new("test");
    // `test` is a leaf envelope (no assertions). Pin Rust's findings:
    //   - LEAF matches: true
    //   - NODE({0}) matches: false (NODE never matches a leaf)
    //   - is_leaf(): true
    //   - is_node(): false
    expect(patternMatches(leafResult.value, env)).toBe(true);
    expect(patternMatches(nodeZeroResult.value, env)).toBe(false);
    expect((env as unknown as { isLeaf(): boolean }).isLeaf()).toBe(true);
    expect((env as unknown as { isNode(): boolean }).isNode()).toBe(false);
  });
});
