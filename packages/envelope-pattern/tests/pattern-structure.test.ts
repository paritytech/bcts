/**
 * @bcts/envelope-pattern - Structure Pattern Tests
 *
 * Tests for envelope structure patterns: subject, predicate, object,
 * assertions, wrapped, node, obscured, etc.
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust pattern_tests_structure.rs
 *
 * NOTE: Some pattern matching behaviors require additional VM implementation.
 * Tests marked with .skip require the VM to properly traverse envelope structures.
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "@bcts/envelope";
import {
  // Structure patterns
  anySubject,
  subject,
  anyPredicate,
  anyObject,
  anyAssertion,
  assertionWithPredicate,
  anyNode,
  wrapped,
  unwrapEnvelope,
  obscured,
  elided,
  encrypted,
  compressed,
  traverse,
  // Leaf patterns
  anyText,
  text,
  anyNumber,
  // Matching functions
  patternMatches,
  patternPaths,
} from "../src";

describe("Structure Pattern Construction Tests", () => {
  describe("Pattern Type Verification", () => {
    it("creates subject patterns", () => {
      const anySubjectPat = anySubject();
      expect(anySubjectPat.type).toBe("Structure");

      const specificSubjectPat = subject(anyText());
      expect(specificSubjectPat.type).toBe("Structure");
    });

    it("creates predicate patterns", () => {
      const anyPredicatePat = anyPredicate();
      expect(anyPredicatePat.type).toBe("Structure");
    });

    it("creates object patterns", () => {
      const anyObjectPat = anyObject();
      expect(anyObjectPat.type).toBe("Structure");
    });

    it("creates assertion patterns", () => {
      const anyAssertionPat = anyAssertion();
      expect(anyAssertionPat.type).toBe("Structure");

      const withPredicatePat = assertionWithPredicate(text("knows"));
      expect(withPredicatePat.type).toBe("Structure");
    });

    it("creates node patterns", () => {
      const anyNodePat = anyNode();
      expect(anyNodePat.type).toBe("Structure");
    });

    it("creates wrapped patterns", () => {
      const wrappedPat = wrapped();
      expect(wrappedPat.type).toBe("Structure");

      const unwrapPat = unwrapEnvelope();
      expect(unwrapPat.type).toBe("Structure");
    });

    it("creates obscured patterns", () => {
      const obscuredPat = obscured();
      expect(obscuredPat.type).toBe("Structure");

      const elidedPat = elided();
      expect(elidedPat.type).toBe("Structure");

      const encryptedPat = encrypted();
      expect(encryptedPat.type).toBe("Structure");

      const compressedPat = compressed();
      expect(compressedPat.type).toBe("Structure");
    });

    it("creates traverse patterns", () => {
      const traversePat = traverse([anySubject(), anyNumber()]);
      expect(traversePat.type).toBe("Meta");
    });
  });
});

describe("Structure Pattern Matching Tests", () => {
  describe("Subject Pattern", () => {
    it("matches any subject in a leaf envelope", () => {
      const envelope = Envelope.new("Alice");

      const anySubjectPat = anySubject();
      expect(patternMatches(anySubjectPat, envelope)).toBe(true);

      const paths = patternPaths(anySubjectPat, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("matches any subject in an envelope with assertions", () => {
      const envelope = Envelope.new("Alice").addAssertion("knows", "Bob");

      const anySubjectPat = anySubject();
      expect(patternMatches(anySubjectPat, envelope)).toBe(true);

      const paths = patternPaths(anySubjectPat, envelope);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("matches text subjects with specific pattern", () => {
      const envelope = Envelope.new("Alice");
      const textSubjectPat = subject(anyText());
      expect(patternMatches(textSubjectPat, envelope)).toBe(true);
    });

    it("does not match when subject type doesn't match", () => {
      const textEnvelope = Envelope.new("Alice");
      const numberSubjectPat = subject(anyNumber());
      expect(patternMatches(numberSubjectPat, textEnvelope)).toBe(false);
    });
  });

  describe("Wrapped Pattern", () => {
    it("does not match non-wrapped envelopes", () => {
      const envelope = Envelope.new(42);
      expect(patternMatches(wrapped(), envelope)).toBe(false);
    });

    it("matches wrapped envelopes", () => {
      const envelope = Envelope.new(42).wrap();
      expect(patternMatches(wrapped(), envelope)).toBe(true);
    });
  });

  describe("Assertion Pattern", () => {
    it("does not match envelopes without assertions", () => {
      const envelope = Envelope.new("Alice");
      expect(patternMatches(anyAssertion(), envelope)).toBe(false);
    });

    it("matches envelopes with assertions", () => {
      const envelope = Envelope.new("Alice")
        .addAssertion("knows", "Bob")
        .addAssertion("worksWith", "Charlie");

      expect(patternMatches(anyAssertion(), envelope)).toBe(true);

      const paths = patternPaths(anyAssertion(), envelope);
      expect(paths.length).toBe(2);
    });
  });

  describe("Obscured Pattern", () => {
    it("matches elided envelopes", () => {
      const original = Envelope.new("Secret data");
      const elidedEnvelope = original.elide();

      expect(patternMatches(obscured(), elidedEnvelope)).toBe(true);
      expect(patternMatches(elided(), elidedEnvelope)).toBe(true);
      expect(patternMatches(encrypted(), elidedEnvelope)).toBe(false);
      expect(patternMatches(compressed(), elidedEnvelope)).toBe(false);
    });

    it("does not match non-obscured envelopes", () => {
      const original = Envelope.new("Secret data");

      expect(patternMatches(obscured(), original)).toBe(false);
      expect(patternMatches(elided(), original)).toBe(false);
      expect(patternMatches(encrypted(), original)).toBe(false);
      expect(patternMatches(compressed(), original)).toBe(false);
    });

    it("matches compressed envelopes", () => {
      const original = Envelope.new(
        "Secret data that is long enough to compress effectively and test the compression pattern matching functionality",
      );
      const compressedEnvelope = original.compress();

      expect(patternMatches(obscured(), compressedEnvelope)).toBe(true);
      expect(patternMatches(compressed(), compressedEnvelope)).toBe(true);
      expect(patternMatches(elided(), compressedEnvelope)).toBe(false);
      expect(patternMatches(encrypted(), compressedEnvelope)).toBe(false);
    });
  });

  describe("Node Pattern", () => {
    it("does not match leaf envelopes", () => {
      const leafEnvelope = Envelope.new("Just a leaf");
      expect(patternMatches(anyNode(), leafEnvelope)).toBe(false);
    });

    it("matches envelopes with assertions (nodes)", () => {
      const singleAssertionEnvelope = Envelope.new("Alice").addAssertion("knows", "Bob");
      expect(patternMatches(anyNode(), singleAssertionEnvelope)).toBe(true);
    });
  });
});
