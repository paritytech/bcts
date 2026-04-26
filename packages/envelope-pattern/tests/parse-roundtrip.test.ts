/**
 * @bcts/envelope-pattern - Parser round-trip + AST-shape tests (EP1)
 *
 * Mirrors Rust `bc-envelope-pattern-rust/tests/parse_tests_*.rs`.
 *
 * **Why this file exists.** The original parser test suite had ~180
 * cases that all checked just `result.ok === true` plus the top-level
 * `result.value.type` field — never the *shape* of the parsed AST,
 * never the `format(parse(s)) === s` round-trip. Most parser
 * divergences caught in the original audit were invisible to those
 * tests. This file pins:
 *
 *   1. Successful parse for every representative source pattern.
 *   2. `patternToString(parse(s).value) === s` round-trip for every
 *      successful parse — the same check Rust performs via
 *      `assert_actual_expected!(p.to_string(), src)` in
 *      `parse_tests_leaf.rs:11` and friends.
 *
 * The patterns exercised below come directly from the Rust
 * `parse_tests_leaf.rs`, `parse_tests_meta.rs`, and
 * `parse_tests_structure.rs` source files.
 */

import { describe, it, expect } from "vitest";
import { parse, patternToString, type Pattern } from "../src";

/**
 * Parse `src` and assert successful parse + byte-identical round-trip.
 *
 * Equivalent to Rust's `Pattern::parse(src).unwrap()` followed by
 * `assert_actual_expected!(p.to_string(), src)`.
 */
function parseAndRoundTrip(src: string): Pattern {
  const r = parse(src);
  if (!r.ok) {
    throw new Error(`parse(${JSON.stringify(src)}) failed: ${String(r.error)}`);
  }
  expect(r.ok).toBe(true);
  expect(patternToString(r.value)).toBe(src);
  return r.value;
}

describe("EP1 — Parser round-trip + AST shape", () => {
  // ============================================================
  // Leaf patterns (mirrors parse_tests_leaf.rs)
  // ============================================================
  describe("Leaf — boolean", () => {
    it("bool", () => {
      const p = parseAndRoundTrip("bool");
      expect(p.type).toBe("Leaf");
    });
    it("true", () => {
      const p = parseAndRoundTrip("true");
      expect(p.type).toBe("Leaf");
    });
    it("false", () => {
      const p = parseAndRoundTrip("false");
      expect(p.type).toBe("Leaf");
    });
  });

  describe("Leaf — text", () => {
    it("text", () => parseAndRoundTrip("text"));
    it('"hello"', () => parseAndRoundTrip('"hello"'));
    it("/h.*o/ regex", () => parseAndRoundTrip("/h.*o/"));
    it('"hello world" with spaces', () => parseAndRoundTrip('"hello world"'));
    it('"say \\"hello\\"" with escaped quotes', () => parseAndRoundTrip('"say \\"hello\\""'));
  });

  describe("Leaf — number", () => {
    it("number", () => parseAndRoundTrip("number"));
    it("integer 42", () => parseAndRoundTrip("42"));
    it("float 3.75", () => parseAndRoundTrip("3.75"));
    it("range 1...3", () => parseAndRoundTrip("1...3"));
    it("greater-than >5", () => parseAndRoundTrip(">5"));
    it("greater-equal >=5", () => parseAndRoundTrip(">=5"));
    it("less-than <5", () => parseAndRoundTrip("<5"));
    it("less-equal <=5", () => parseAndRoundTrip("<=5"));
    it("NaN", () => parseAndRoundTrip("NaN"));
    it("Infinity", () => parseAndRoundTrip("Infinity"));
    it("-Infinity", () => parseAndRoundTrip("-Infinity"));
  });

  describe("Leaf — leaf / array / bstr / null / known", () => {
    it("leaf", () => {
      const p = parseAndRoundTrip("leaf");
      // Mirrors `test_leaf_parsing.rs` — `leaf` is now a *structure*
      // pattern (post-refactor in the Rust upstream).
      expect(p.type).toBe("Structure");
    });
    it("array", () => parseAndRoundTrip("array"));
    it("[{3}] array length 3", () => parseAndRoundTrip("[{3}]"));
    it("[{2,4}] array length 2..4", () => parseAndRoundTrip("[{2,4}]"));
    it("[{2,}] array length 2..", () => parseAndRoundTrip("[{2,}]"));
    it("bstr", () => parseAndRoundTrip("bstr"));
    it("h'0102' byte string literal", () => parseAndRoundTrip("h'0102'"));
    it("h'/abc/' byte string regex", () => parseAndRoundTrip("h'/abc/'"));
    it("null", () => parseAndRoundTrip("null"));
    it("known", () => parseAndRoundTrip("known"));
    it("'1' known value", () => parseAndRoundTrip("'1'"));
    it("'date' named known value", () => parseAndRoundTrip("'date'"));
  });

  describe("Leaf — date", () => {
    it("date any", () => parseAndRoundTrip("date"));
    it("date'2023-12-25' literal", () => parseAndRoundTrip("date'2023-12-25'"));
    it("date'2023-12-24...2023-12-26' range", () =>
      parseAndRoundTrip("date'2023-12-24...2023-12-26'"));
    it("date'2023-12-24...' range from", () => parseAndRoundTrip("date'2023-12-24...'"));
    it("date'...2023-12-26' range to", () => parseAndRoundTrip("date'...2023-12-26'"));
    it("date'/2023-.*/' regex", () => parseAndRoundTrip("date'/2023-.*/'"));
  });

  describe("Leaf — map", () => {
    it("map", () => parseAndRoundTrip("map"));
    it("{{3}} map length 3", () => parseAndRoundTrip("{{3}}"));
    it("{{2,4}} map length 2..4", () => parseAndRoundTrip("{{2,4}}"));
    it("{{2,}} map length 2..", () => parseAndRoundTrip("{{2,}}"));
  });

  describe("Leaf — tagged", () => {
    it("tagged any", () => parseAndRoundTrip("tagged"));
    it("tagged(100, *) numeric tag + any content", () => parseAndRoundTrip("tagged(100, *)"));
    it("tagged(date, *) named tag + any content", () => parseAndRoundTrip("tagged(date, *)"));
    it("tagged(/da.*/, *) regex tag", () => parseAndRoundTrip("tagged(/da.*/, *)"));
  });

  describe("Leaf — cbor", () => {
    it("cbor any", () => parseAndRoundTrip("cbor"));
    it("cbor(true)", () => parseAndRoundTrip("cbor(true)"));
    it("cbor([1, 2, 3])", () => parseAndRoundTrip("cbor([1, 2, 3])"));
  });

  // ============================================================
  // Meta patterns (mirrors parse_tests_meta.rs)
  // ============================================================
  describe("Meta — any / capture / and-or", () => {
    it("* any", () => {
      const p = parseAndRoundTrip("*");
      expect(p.type).toBe("Meta");
    });
    it("@cap_1(42) capture", () => parseAndRoundTrip("@cap_1(42)"));
    it("@name(1) capture with name", () => parseAndRoundTrip("@name(1)"));
    it("* & true and-combinator", () => parseAndRoundTrip("* & true"));
  });

  describe("Meta — repeat / quantifier", () => {
    it("(number){2,4}+ possessive bounded", () => parseAndRoundTrip("(number){2,4}+"));
    it("(text)+? lazy plus", () => parseAndRoundTrip("(text)+?"));
    it("(wrapped)* greedy star", () => parseAndRoundTrip("(wrapped)*"));
  });

  describe("Meta — search", () => {
    it("search(text)", () => parseAndRoundTrip("search(text)"));
  });

  // ============================================================
  // Structure patterns (mirrors parse_tests_structure.rs)
  // ============================================================
  describe("Structure — node / assertion / wrap / obscured", () => {
    it("node any", () => {
      const p = parseAndRoundTrip("node");
      expect(p.type).toBe("Structure");
    });
    it("node({1,3}) bounded assertion count", () => parseAndRoundTrip("node({1,3})"));
    it("assert top-level assertion", () => parseAndRoundTrip("assert"));
    it("subj subject role", () => parseAndRoundTrip("subj"));
    it("pred predicate role", () => parseAndRoundTrip("pred"));
    it("pred(1) predicate equals", () => parseAndRoundTrip("pred(1)"));
    it("obj object role", () => parseAndRoundTrip("obj"));
    it("assertobj(1) assertion-object equals", () => parseAndRoundTrip("assertobj(1)"));
    it("wrapped", () => parseAndRoundTrip("wrapped"));
    it("unwrap", () => parseAndRoundTrip("unwrap"));
    it("unwrap(node) unwrap structure", () => parseAndRoundTrip("unwrap(node)"));
    it("compressed", () => parseAndRoundTrip("compressed"));
    it("encrypted", () => parseAndRoundTrip("encrypted"));
    it("elided", () => parseAndRoundTrip("elided"));
    it("obscured", () => parseAndRoundTrip("obscured"));
    it("digest(a1b2c3) digest prefix", () => parseAndRoundTrip("digest(a1b2c3)"));
  });

  // ============================================================
  // Negative cases — invalid patterns must fail to parse
  // ============================================================
  describe("Negative — invalid patterns reject", () => {
    const invalid = [
      "", // empty
      "?", // unknown keyword
      "[{}]", // empty quantifier
      "(unclosed",
      ")",
      "@", // dangling capture marker
    ];
    for (const src of invalid) {
      it(`rejects ${JSON.stringify(src)}`, () => {
        const r = parse(src);
        expect(r.ok).toBe(false);
      });
    }
  });
});
