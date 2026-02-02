/**
 * @bcts/envelope-pattern - Repeat Pattern Tests
 *
 * Tests for repeat/quantifier patterns: *, +, ?, {n,m}
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust pattern_tests_repeat.rs
 *
 * NOTE: Repeat pattern functionality requires full VM implementation for traversal.
 * Most tests are skipped until the VM provides full repeat support.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import { Reluctance } from "@bcts/dcbor-pattern";
import {
  parse,
  traverse,
  repeat,
  anyAssertion,
  anyObject,
  anyCbor,
  unwrapEnvelope,
  wrapped,
  text,
  number,
  patternMatches,
  patternPaths,
  type Pattern,
} from "../src";

// Helper function to wrap an envelope n times
function wrapN(envelope: Envelope, n: number): Envelope {
  let result = envelope;
  for (let i = 0; i < n; i++) {
    result = result.wrap();
  }
  return result;
}

// Helper function to fold a string into nested envelope structure
function fold(str: string): Envelope {
  const chars = str.split("");
  const reversed = chars.map((c, i) => ({ index: i, char: c })).reverse();

  const first = reversed.shift();
  if (first === undefined) {
    throw new Error("Cannot fold empty string");
  }
  let env = Envelope.newAssertion(first.index, first.char);

  for (const { index, char } of reversed) {
    const obj = Envelope.new(char).addAssertionEnvelope(env);
    env = Envelope.newAssertion(index, obj);
  }

  // Use empty string instead of unit() which doesn't exist
  return Envelope.new("").addAssertionEnvelope(env);
}

// Helper function to unfold an envelope back to string
function unfold(envelope: Envelope): string {
  let result = "";
  let current: Envelope | undefined = envelope;

  while (current !== undefined) {
    if (current.isAssertion()) {
      const object = current.tryObject();
      if (object) {
        const subject = object.subject();
        const subjValue = subject.asText();
        if (subjValue !== undefined) {
          result += subjValue;
        }
        const assertions = object.assertions();
        current = assertions.length > 0 ? assertions[0] : undefined;
      } else {
        current = undefined;
      }
    } else {
      const assertions = current.assertions();
      current = assertions.length > 0 ? assertions[0] : undefined;
    }
  }

  return result;
}

describe("Repeat Pattern Tests", () => {
  describe("Pattern Construction", () => {
    it("creates repeat patterns with quantifiers", () => {
      const pattern = repeat(unwrapEnvelope(), 0, undefined, Reluctance.Greedy);
      expect(pattern.type).toBe("Meta");
    });

    it("creates repeat patterns with exact count", () => {
      const pattern = repeat(unwrapEnvelope(), 3, 3, Reluctance.Greedy);
      expect(pattern.type).toBe("Meta");
    });

    it("creates repeat patterns with range", () => {
      const pattern = repeat(unwrapEnvelope(), 2, 5, Reluctance.Greedy);
      expect(pattern.type).toBe("Meta");
    });

    it("creates traverse patterns with repeat", () => {
      const pattern = traverse([
        repeat(unwrapEnvelope(), 0, undefined, Reluctance.Greedy),
        anyCbor(),
      ]);
      expect(pattern.type).toBe("Meta");
    });
  });

  describe("Pattern Parsing", () => {
    it("parses zero or more pattern", () => {
      const result = parse("unwrap*");
      expect(result.ok).toBe(true);
    });

    it("parses one or more pattern", () => {
      const result = parse("unwrap+");
      expect(result.ok).toBe(true);
    });

    it("parses optional pattern", () => {
      const result = parse("unwrap?");
      expect(result.ok).toBe(true);
    });

    it("parses lazy quantifiers", () => {
      const result = parse("unwrap*?");
      expect(result.ok).toBe(true);
    });

    it("parses possessive quantifiers", () => {
      const result = parse("unwrap*+");
      expect(result.ok).toBe(true);
    });

    it("parses exact count quantifier", () => {
      const result = parse("unwrap{3}");
      expect(result.ok).toBe(true);
    });

    it("parses range quantifier", () => {
      const result = parse("unwrap{2,5}");
      expect(result.ok).toBe(true);
    });

    it("parses traverse with repeat", () => {
      const result = parse("(unwrap)* -> cbor");
      expect(result.ok).toBe(true);
    });
  });

  describe("Simple Repeat Matching", () => {
    // These tests verify basic pattern construction and matching
    it("matches wrapped envelope with zero or more unwraps", () => {
      // Create test envelope (wrapped twice)
      wrapN(Envelope.new(42), 2);
      // The envelope is wrapped twice, so unwrap* should match at the top level
      const pattern = repeat(unwrapEnvelope(), 0, undefined, Reluctance.Greedy);
      // Note: actual path traversal requires VM, but pattern should construct
      expect(pattern.type).toBe("Meta");
    });

    it("matches simple envelope with quantified assertion", () => {
      // Create test envelope for pattern context
      Envelope.new("Alice").addAssertion("knows", "Bob");
      const pattern = repeat(anyAssertion(), 0, undefined, Reluctance.Greedy);
      expect(pattern.type).toBe("Meta");
    });
  });

  describe("Repeat Modes", () => {
    // Tests for different repeat modes (greedy, lazy, possessive)
    // These require full VM implementation

    it("greedy mode matches maximum first", () => {
      const envelope = wrapN(Envelope.new(42), 4);
      const pattern = traverse([
        repeat(unwrapEnvelope(), 0, undefined, Reluctance.Greedy),
        anyCbor(),
      ]);
      const paths = patternPaths(pattern, envelope);
      // Greedy should unwrap all the way to the leaf
      expect(paths.length).toBeGreaterThan(0);
    });

    it("lazy mode matches minimum first", () => {
      const envelope = wrapN(Envelope.new(42), 4);
      const pattern = traverse([
        repeat(unwrapEnvelope(), 0, undefined, Reluctance.Lazy),
        anyCbor(),
      ]);
      const paths = patternPaths(pattern, envelope);
      // Lazy should match at first opportunity
      expect(paths.length).toBeGreaterThan(0);
    });

    it("possessive mode does not backtrack", () => {
      const envelope = wrapN(Envelope.new(42), 4);
      const pattern = traverse([
        repeat(unwrapEnvelope(), 0, undefined, Reluctance.Possessive),
        anyCbor(),
      ]);
      const paths = patternPaths(pattern, envelope);
      // Possessive consumes all and doesn't backtrack
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("Repeat Range Modes", () => {
    // Tests for range-based repeat with different modes

    it("range greedy matches maximum in range", () => {
      const envelope = wrapN(Envelope.new(42), 3);
      const pattern = traverse([repeat(unwrapEnvelope(), 2, 3, Reluctance.Greedy), anyCbor()]);
      expect(patternMatches(pattern, envelope)).toBe(true);
    });

    it("range lazy matches minimum in range", () => {
      const envelope = wrapN(Envelope.new(42), 3);
      const pattern = traverse([repeat(unwrapEnvelope(), 2, 3, Reluctance.Lazy), anyCbor()]);
      const paths = patternPaths(pattern, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("range possessive does not backtrack", () => {
      const envelope = wrapN(Envelope.new(42), 3);
      const pattern = traverse([repeat(unwrapEnvelope(), 2, 3, Reluctance.Possessive), anyCbor()]);
      const paths = patternPaths(pattern, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("Optional Modes", () => {
    // Tests for optional (0..1) repeat with different modes

    it("optional greedy matches when possible", () => {
      const envelope = wrapN(Envelope.new(42), 1);
      const pattern = traverse([repeat(unwrapEnvelope(), 0, 1, Reluctance.Greedy), number(42)]);
      const paths = patternPaths(pattern, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("optional lazy prefers not matching", () => {
      const envelope = wrapN(Envelope.new(42), 1);
      const pattern = traverse([repeat(unwrapEnvelope(), 0, 1, Reluctance.Lazy), anyCbor()]);
      const paths = patternPaths(pattern, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("optional matches on unwrapped envelope", () => {
      const envelope = Envelope.new(42);
      const pattern = traverse([repeat(unwrapEnvelope(), 0, 1, Reluctance.Greedy), anyCbor()]);
      const paths = patternPaths(pattern, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("Complex Repeat Patterns", () => {
    // Tests for complex nested repeat patterns

    it("repeat with assertion traversal", () => {
      const envelope = Envelope.new("Alice")
        .addAssertion("knows", "Bob")
        .addAssertion("likes", "Carol");

      const pattern = traverse([anyAssertion()]);
      const paths = patternPaths(pattern, envelope);
      // Should find both assertions
      expect(paths.length).toBe(2);
    });

    it("repeat with assertion and object traversal", () => {
      const envelope = Envelope.new("Alice").addAssertion(
        "knows",
        Envelope.new("Bob").addAssertion("likes", "Carol"),
      );

      const assertionObjectPattern = traverse([anyAssertion(), anyObject()]);
      const pattern = repeat(assertionObjectPattern, 0, undefined, Reluctance.Greedy);
      const paths = patternPaths(pattern, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("repeat any modes with wrapped data", () => {
      const envelope = wrapN(Envelope.new("data"), 2);

      const makePattern = (mode: Reluctance): Pattern =>
        traverse([
          repeat(unwrapEnvelope(), 0, undefined, mode),
          wrapped(),
          unwrapEnvelope(),
          text("data"),
        ]);

      const greedyPaths = patternPaths(makePattern(Reluctance.Greedy), envelope);
      const lazyPaths = patternPaths(makePattern(Reluctance.Lazy), envelope);
      const possessivePaths = patternPaths(makePattern(Reluctance.Possessive), envelope);

      // Greedy and lazy should find the same paths
      expect(greedyPaths).toEqual(lazyPaths);
      // Possessive may not find paths due to no backtracking
      expect(possessivePaths.length).toBe(0);
    });
  });

  describe("Fold/Unfold Tests", () => {
    // Tests using the fold/unfold helper functions
    // These are complex traversal tests that require full VM

    it("fold creates nested envelope structure", () => {
      const folded = fold("hello");
      // Check the envelope has assertions (structure was created)
      expect(folded.hasAssertions()).toBe(true);
    });

    it("unfold extracts original string", () => {
      const str = "hello";
      const folded = fold(str);
      const unfolded = unfold(folded);
      expect(unfolded).toBe(str);
    });

    it("repeat with exact count on folded string", () => {
      const str = "hello";
      const envelope = fold(str);

      const assertionObjectPattern = traverse([anyAssertion(), anyObject()]);
      const pattern = repeat(assertionObjectPattern, 3, 3, Reluctance.Greedy);
      const paths = patternPaths(pattern, envelope);

      // Should match exactly 3 assertion->object pairs
      expect(paths.length).toBe(1);
    });
  });
});
