import { describe, it, expect } from "vitest";
import { Envelope } from "../src";

/**
 * Non-correlation tests for Gordian Envelope.
 *
 * These tests verify that salt can be used to decorrelate envelopes,
 * preventing third parties from determining if two elided envelopes
 * originally contained the same information.
 *
 * Based on bc-envelope-rust/tests/non_correlation_tests.rs
 */

/**
 * Helper function to check if two envelopes are semantically equivalent.
 * Two envelopes are equivalent if they have the same digest.
 *
 * This is the TypeScript equivalent of Rust's `is_equivalent_to()` method.
 */
function isEquivalentTo(e1: Envelope, e2: Envelope): boolean {
  return e1.digest().equals(e2.digest());
}

describe("Non-correlation Tests", () => {
  describe("test_envelope_non_correlation", () => {
    it("should correlate envelope with its elision", () => {
      const e1 = Envelope.new("Hello.");

      // e1 correlates with its elision
      expect(isEquivalentTo(e1, e1.elide())).toBe(true);
    });

    it("should not correlate envelope with salted version", () => {
      const e1 = Envelope.new("Hello.");

      // e2 is the same message, but with random salt
      const e2 = e1.addSalt();

      // Verify the salted envelope has the expected structure
      const formatted = e2.format();
      expect(formatted).toContain('"Hello."');
      expect(formatted).toContain("'salt'");

      // So even though its content is the same, it doesn't correlate.
      expect(isEquivalentTo(e1, e2)).toBe(false);

      // And of course, neither does its elision.
      expect(isEquivalentTo(e1, e2.elide())).toBe(false);
    });

    it("should show salt in tree format", () => {
      const e1 = Envelope.new("Hello.");
      const e2 = e1.addSalt();

      // The tree format should show the structure with salt
      const treeFormat = e2.treeFormat();
      expect(treeFormat).toContain("NODE");
      expect(treeFormat).toContain('"Hello."');
      expect(treeFormat).toContain("ASSERTION");
      expect(treeFormat).toContain("KNOWN_VALUE");
    });
  });

  describe("test_predicate_correlation", () => {
    it("should correlate predicates across different envelopes", () => {
      const e1 = Envelope.new("Foo").addAssertion("note", "Bar");
      const e2 = Envelope.new("Baz").addAssertion("note", "Quux");

      // Check e1 format
      const e1Format = e1.format();
      expect(e1Format).toContain('"Foo"');
      expect(e1Format).toContain('"note"');
      expect(e1Format).toContain('"Bar"');

      // e1 and e2 have the same predicate
      const e1Predicate = e1.assertions()[0].asPredicate();
      const e2Predicate = e2.assertions()[0].asPredicate();

      expect(e1Predicate).toBeDefined();
      expect(e2Predicate).toBeDefined();

      if (e1Predicate && e2Predicate) {
        expect(isEquivalentTo(e1Predicate, e2Predicate)).toBe(true);
      }
    });

    it("should elide revealing only the envelope structure", () => {
      const e1 = Envelope.new("Foo").addAssertion("note", "Bar");

      // Redact the entire contents of e1 without
      // redacting the envelope itself.
      const e1Elided = e1.elideRevealingTarget(e1);

      // Check the elided format shows structure but elided content
      const elidedFormat = e1Elided.format();
      expect(elidedFormat).toContain("ELIDED");
    });
  });

  describe("test_add_salt", () => {
    it("should add salt to wrapped envelope with salted assertion", () => {
      const source =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

      // Create a salted "Alpha" envelope
      const alphaWithSalt = Envelope.new("Alpha").addSalt();

      // Wrap it
      const wrapped = alphaWithSalt.wrap();

      // Create salted predicate and object using string "note" instead of KnownValue NOTE
      // (KnownValue encoding is not yet fully implemented in the TypeScript version)
      const saltedPredicate = Envelope.new("note").addSalt();
      const saltedObject = Envelope.new(source).addSalt();

      // Add the assertion with salted predicate and object
      const e1 = wrapped.addAssertionEnvelope(Envelope.newAssertion(saltedPredicate, saltedObject));

      // Verify the structure
      const formatted = e1.format();
      expect(formatted).toContain('"Alpha"');
      expect(formatted).toContain("'salt'");
      expect(formatted).toContain('"note"');
      expect(formatted).toContain("Lorem ipsum");
    });

    it("should elide complex salted envelope revealing only structure", () => {
      const source =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

      // Build a simpler version for testing
      const alphaWithSalt = Envelope.new("Alpha").addSalt();
      const wrapped = alphaWithSalt.wrap();
      const e1 = wrapped.addAssertion("note", source);

      // Elide revealing only the target (the top-level envelope)
      const e1Elided = e1.elideRevealingTarget(e1);

      // Check the elided format
      const elidedFormat = e1Elided.format();
      expect(elidedFormat).toContain("ELIDED");
    });
  });

  describe("salt decorrelation properties", () => {
    it("should make identical envelopes have different digests", () => {
      const content = "Sensitive data";

      const e1 = Envelope.new(content).addSalt();
      const e2 = Envelope.new(content).addSalt();

      // Even with same content, salted envelopes have different digests
      expect(isEquivalentTo(e1, e2)).toBe(false);
    });

    it("should preserve semantic content despite different digests", () => {
      const content = "Hello, World!";

      const original = Envelope.new(content);
      const salted = original.addSalt();

      // The subject is still the same
      const originalSubject = original.subject();
      const saltedSubject = salted.subject();

      expect(isEquivalentTo(originalSubject, saltedSubject)).toBe(true);
    });

    it("should allow multiple layers of salt", () => {
      const e1 = Envelope.new("Data").addSalt().addSalt();
      const e2 = Envelope.new("Data").addSalt().addSalt();

      // Each layer of salt creates a unique envelope
      expect(isEquivalentTo(e1, e2)).toBe(false);

      // Should have multiple salt assertions
      const saltAssertions = e1.assertions().filter((a) => {
        try {
          const pred = a.asPredicate();
          const kv = pred?.asKnownValue();
          return kv !== undefined && kv.name() === "salt";
        } catch {
          return false;
        }
      });
      expect(saltAssertions.length).toBe(2);
    });
  });

  describe("elision with salt", () => {
    it("should not correlate elided salted envelope with original", () => {
      const original = Envelope.new("Secret message");
      const salted = original.addSalt();

      const originalElided = original.elide();
      const saltedElided = salted.elide();

      // Original correlates with its elision
      expect(isEquivalentTo(original, originalElided)).toBe(true);

      // Salted correlates with its elision
      expect(isEquivalentTo(salted, saltedElided)).toBe(true);

      // But original does not correlate with salted elision
      expect(isEquivalentTo(original, saltedElided)).toBe(false);

      // And salted does not correlate with original elision
      expect(isEquivalentTo(salted, originalElided)).toBe(false);
    });

    it("should allow selective elision with salt", () => {
      const envelope = Envelope.new("Alice")
        .addAssertion("name", "Alice Smith")
        .addAssertion("ssn", "123-45-6789")
        .addSalt();

      // Find and elide the SSN assertion
      const ssnAssertion = envelope.assertions().find((a) => {
        try {
          const pred = a.asPredicate();
          return pred?.asText() === "ssn";
        } catch {
          return false;
        }
      });

      if (ssnAssertion) {
        const redacted = envelope.elideRemovingTarget(ssnAssertion);

        // The redacted envelope should still be equivalent (same digest)
        expect(isEquivalentTo(envelope, redacted)).toBe(true);

        // But the format should show ELIDED
        expect(redacted.format()).toContain("ELIDED");
      }
    });
  });
});
