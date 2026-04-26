/**
 * @bcts/envelope-pattern — LEAF vs NODE({0}) comparison
 *
 * Port of `bc-envelope-pattern-rust/tests/test_leaf_vs_node_zero.rs`.
 *
 * Pins the differing behaviour of `leaf` vs `node({0})` across pure
 * leaves, known-value leaves, bare subjects (which are leaves in
 * bc-envelope, *not* zero-assertion nodes), single/multi-assertion
 * nodes, and wrapped envelopes.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { KnownValue } from "@bcts/known-values";
import { parse, patternMatches } from "../src";

interface EnvelopeIntrospection {
  isLeaf(): boolean;
  isKnownValue(): boolean;
  isNode(): boolean;
  assertions(): unknown[];
}

const i = (env: Envelope): EnvelopeIntrospection =>
  env as unknown as EnvelopeIntrospection;

describe("LEAF vs NODE({0}) comparison (test_leaf_vs_node_zero.rs)", () => {
  function envelopes() {
    return [
      // Pure leaf — just a CBOR value.
      { label: "Pure leaf (hello)", env: Envelope.new("hello") },
      // Known value leaf.
      {
        label: "Known value leaf",
        env: Envelope.new(new KnownValue(42)),
      },
      // Bare subject without assertions — a leaf in bc-envelope's model.
      { label: "Bare subject", env: Envelope.new("subject") },
      // 1 assertion → node.
      {
        label: "1 assertion",
        env: Envelope.new("subject").addAssertion("key", "value"),
      },
      // 2 assertions → node.
      {
        label: "2 assertions",
        env: Envelope.new("subject")
          .addAssertion("key1", "value1")
          .addAssertion("key2", "value2"),
      },
      // Wrapped envelope (a leaf wrapping another envelope's CBOR).
      { label: "Wrapped", env: Envelope.new(Envelope.new("wrapped")) },
    ] as const;
  }

  it("LEAF matches leaves, KVs, bare subjects, and wrapped envelopes; not nodes", () => {
    const r = parse("leaf");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const leaf = r.value;

    // Pin one match per row, mirroring the Rust analysis findings.
    expect(patternMatches(leaf, Envelope.new("hello"))).toBe(true);
    expect(patternMatches(leaf, Envelope.new(new KnownValue(42)))).toBe(true);
    expect(patternMatches(leaf, Envelope.new("subject"))).toBe(true);
    expect(
      patternMatches(
        leaf,
        Envelope.new("subject").addAssertion("key", "value"),
      ),
    ).toBe(false);
    expect(
      patternMatches(
        leaf,
        Envelope.new("subject")
          .addAssertion("key1", "value1")
          .addAssertion("key2", "value2"),
      ),
    ).toBe(false);
    expect(patternMatches(leaf, Envelope.new(Envelope.new("wrapped")))).toBe(true);
  });

  it("NODE({0}) never matches anything (no zero-assertion nodes exist)", () => {
    const r = parse("node({0})");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nodeZero = r.value;

    for (const { env } of envelopes()) {
      expect(patternMatches(nodeZero, env)).toBe(false);
    }
  });

  it("matches Rust's structural envelope-shape introspection", () => {
    // Rust prints `is_leaf` / `is_known_value` / `is_node` / assertions
    // count for each test envelope. Pin the shape here so a future
    // refactor that flips one of these flags surfaces the divergence.
    // Note: TS `isLeaf()` returns `false` for the known-value
    // envelope (the underlying check is "is the subject a CBOR
    // leaf with no assertions"; known values aren't bare CBOR).
    // The `leaf` *pattern* still matches it (per the previous
    // test) — these `isLeaf()` predicates are envelope-shape
    // queries, not pattern-match results, so the divergence is
    // intentional. The Rust file uses these for diagnostic
    // `println!` only and does not assert specific values.
    const expected = [
      { label: "Pure leaf (hello)", isLeaf: true,  isKv: false, isNode: false, assertions: 0 },
      { label: "Known value leaf",  isLeaf: false, isKv: true,  isNode: false, assertions: 0 },
      { label: "Bare subject",      isLeaf: true,  isKv: false, isNode: false, assertions: 0 },
      { label: "1 assertion",       isLeaf: false, isKv: false, isNode: true,  assertions: 1 },
      { label: "2 assertions",      isLeaf: false, isKv: false, isNode: true,  assertions: 2 },
      { label: "Wrapped",           isLeaf: true,  isKv: false, isNode: false, assertions: 0 },
    ];
    const cases = envelopes();
    for (let n = 0; n < cases.length; n++) {
      const c = cases[n];
      const e = expected[n];
      if (c === undefined || e === undefined) {
        throw new Error(`fixture mismatch at ${n}`);
      }
      const env = c.env;
      expect({
        label: c.label,
        isLeaf: i(env).isLeaf(),
        isKv: i(env).isKnownValue(),
        isNode: i(env).isNode(),
        assertions: i(env).assertions().length,
      }).toEqual(e);
    }
  });
});
