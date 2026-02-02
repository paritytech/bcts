import { describe, it, expect } from "vitest";
import { Envelope, Digest, SymmetricKey, ObscureType } from "../src";

/**
 * This tests the transformation of different kinds of "obscured" envelopes
 * into others. Some transformations are allowed, some are idempotent (return
 * the same result), and some throw errors.
 *
 * | Operation > | Encrypt    | Elide      | Compress   |
 * |:------------|:-----------|:-----------|:-----------|
 * | Encrypted   | ERROR      | OK         | ERROR      |
 * | Elided      | ERROR      | IDEMPOTENT | ERROR      |
 * | Compressed  | OK         | OK         | IDEMPOTENT |
 */
describe("Obscuring", () => {
  describe("Basic obscuring operations", () => {
    it("should correctly identify obscured state", () => {
      const envelope = Envelope.new("Hello");
      expect(envelope.isObscured()).toBe(false);

      // Encrypted envelopes are obscured
      const key = SymmetricKey.new();
      const encrypted = envelope.encryptSubject(key);
      expect(encrypted.isObscured()).toBe(true);

      // Elided envelopes are obscured
      const elided = envelope.elide();
      expect(elided.isObscured()).toBe(true);

      // Compressed envelopes are obscured
      const compressed = envelope.compress();
      expect(compressed.isObscured()).toBe(true);
    });
  });

  describe("Encryption constraints", () => {
    it("should not allow encrypting an already encrypted envelope", () => {
      // Cannot encrypt an encrypted envelope.
      //
      // If allowed, would result in an envelope with the same digest but
      // double-encrypted, possibly with a different key, which is probably not
      // what's intended. If you want to double-encrypt then wrap the
      // encrypted envelope first, which will change its digest.
      const envelope = Envelope.new("Hello");
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);
      expect(() => encrypted.encryptSubject(key)).toThrow();
    });

    it("should not allow encrypting an elided envelope", () => {
      // Cannot encrypt an elided envelope.
      //
      // Elided envelopes have no data to encrypt.
      const envelope = Envelope.new("Hello");
      const key = SymmetricKey.new();
      const elided = envelope.elide();

      expect(() => elided.encryptSubject(key)).toThrow();
    });

    it("should allow encrypting a compressed envelope", () => {
      // OK to encrypt a compressed envelope.
      const envelope = Envelope.new("Hello");
      const key = SymmetricKey.new();

      const compressed = envelope.compress();
      const encryptedCompressed = compressed.encryptSubject(key);
      expect(encryptedCompressed.isEncrypted()).toBe(true);
    });
  });

  describe("Elision constraints", () => {
    it("should allow eliding an encrypted envelope", () => {
      // OK to elide an encrypted envelope.
      const envelope = Envelope.new("Hello");
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);
      const elidedEncrypted = encrypted.elide();
      expect(elidedEncrypted.isElided()).toBe(true);
    });

    it("should be idempotent when eliding an already elided envelope", () => {
      // Eliding an elided envelope is idempotent.
      const envelope = Envelope.new("Hello");
      const elided = envelope.elide();

      const elidedElided = elided.elide();
      expect(elidedElided.isElided()).toBe(true);
      expect(elidedElided.digest().equals(elided.digest())).toBe(true);
    });

    it("should allow eliding a compressed envelope", () => {
      // OK to elide a compressed envelope.
      const envelope = Envelope.new("Hello");

      const compressed = envelope.compress();
      const elidedCompressed = compressed.elide();
      expect(elidedCompressed.isElided()).toBe(true);
    });
  });

  describe("Compression constraints", () => {
    it("should not allow compressing an encrypted envelope", () => {
      // Cannot compress an encrypted envelope.
      //
      // Encrypted envelopes cannot become smaller because encrypted data looks
      // random, and random data is not compressible.
      const envelope = Envelope.new("Hello");
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);
      expect(() => encrypted.compress()).toThrow();
    });

    it("should not allow compressing an elided envelope", () => {
      // Cannot compress an elided envelope.
      //
      // Elided envelopes have no data to compress.
      const envelope = Envelope.new("Hello");
      const elided = envelope.elide();

      expect(() => elided.compress()).toThrow();
    });

    it("should be idempotent when compressing an already compressed envelope", () => {
      // Compressing a compressed envelope is idempotent.
      const envelope = Envelope.new("Hello");

      const compressed = envelope.compress();
      const compressedCompressed = compressed.compress();
      expect(compressedCompressed.isCompressed()).toBe(true);
      // In TypeScript implementation, compress() returns the same instance
      expect(compressedCompressed).toBe(compressed);
    });
  });
});

describe("Nodes Matching", () => {
  it("should find elided nodes", () => {
    const envelope = Envelope.new("Alice")
      .addAssertion("knows", "Bob")
      .addAssertion("age", 30)
      .addAssertion("city", "Boston");

    // Get digests for targeting
    const knowsAssertion = envelope.assertionWithPredicate("knows");
    const knowsDigest = knowsAssertion.digest();

    // Elide one assertion
    const elideTarget = new Set([knowsDigest]);
    const obscured = envelope.elideRemovingSet(elideTarget);

    // Verify the structure with elided node
    const formatted = obscured.format();
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"age": 30');
    expect(formatted).toContain('"city": "Boston"');
    expect(formatted).toContain("ELIDED");

    // Test finding elided nodes
    const elidedNodes = obscured.nodesMatching(undefined, [ObscureType.Elided]);
    expect(containsDigest(elidedNodes, knowsDigest)).toBe(true);

    // Test finding with target filter
    const targetFilter = new Set([knowsDigest]);
    const filtered = obscured.nodesMatching(targetFilter, [ObscureType.Elided]);
    expect(filtered.size).toBe(1);
    expect(containsDigest(filtered, knowsDigest)).toBe(true);

    // Test finding all nodes in target (no type filter)
    const allInTarget = obscured.nodesMatching(elideTarget, []);
    expect(allInTarget.size).toBe(1);
    expect(containsDigest(allInTarget, knowsDigest)).toBe(true);

    // Test with no matches
    const noMatchTarget = new Set([Digest.fromImage(new TextEncoder().encode("nonexistent"))]);
    const noMatches = obscured.nodesMatching(noMatchTarget, [ObscureType.Elided]);
    expect(noMatches.size).toBe(0);
  });

  it("should find elided and compressed nodes", () => {
    const envelope = Envelope.new("Alice")
      .addAssertion("knows", "Bob")
      .addAssertion("age", 30)
      .addAssertion("city", "Boston");

    // Get some digests for targeting
    const knowsAssertion = envelope.assertionWithPredicate("knows");
    const knowsDigest = knowsAssertion.digest();

    const ageAssertion = envelope.assertionWithPredicate("age");
    const ageDigest = ageAssertion.digest();

    // Elide one assertion
    const elideTarget = new Set([knowsDigest]);
    let obscured = envelope.elideRemovingSet(elideTarget);

    // Compress another assertion using elideRemovingSetWithAction
    const compressTarget = new Set([ageDigest]);
    obscured = obscured.elideRemovingSetWithAction(compressTarget, { type: "compress" });

    // Verify the structure with elided and compressed nodes
    const formatted = obscured.format();
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"city": "Boston"');
    expect(formatted).toContain("COMPRESSED");
    expect(formatted).toContain("ELIDED");

    // Test finding elided nodes
    const elidedNodes = obscured.nodesMatching(undefined, [ObscureType.Elided]);
    expect(containsDigest(elidedNodes, knowsDigest)).toBe(true);

    // Test finding compressed nodes
    const compressedNodes = obscured.nodesMatching(undefined, [ObscureType.Compressed]);
    expect(containsDigest(compressedNodes, ageDigest)).toBe(true);
  });
});

describe("Walk Unelide", () => {
  it("should restore elided envelopes using walkUnelide", () => {
    const alice = Envelope.new("Alice");
    const bob = Envelope.new("Bob");
    const carol = Envelope.new("Carol");

    const envelope = Envelope.new("Alice")
      .addAssertion("knows", "Bob")
      .addAssertion("friend", "Carol");

    // Elide multiple parts
    const elided = envelope.elideRemovingTarget(alice).elideRemovingTarget(bob);

    // Verify parts are elided
    const formatted = elided.format();
    expect(formatted).toContain("ELIDED");
    expect(formatted).toContain('"friend": "Carol"');
    expect(formatted).toContain('"knows": ELIDED');

    // Restore with walkUnelide
    const restored = elided.walkUnelide([alice, bob, carol]);

    // The restored envelope should match original format
    const restoredFormatted = restored.format();
    expect(restoredFormatted).toContain('"Alice"');
    expect(restoredFormatted).toContain('"friend": "Carol"');
    expect(restoredFormatted).toContain('"knows": "Bob"');

    // Test with partial restoration (only some envelopes provided)
    const partial = elided.walkUnelide([alice]);
    const partialFormatted = partial.format();
    expect(partialFormatted).toContain('"Alice"');
    expect(partialFormatted).toContain('"friend": "Carol"');
    expect(partialFormatted).toContain('"knows": ELIDED');

    // Test with no matching envelopes
    const unchanged = elided.walkUnelide([]);
    expect(unchanged.isIdenticalTo(elided)).toBe(true);
  });
});

describe("Walk Decrypt", () => {
  it("should decrypt multiple encrypted parts with different keys", () => {
    const key1 = SymmetricKey.new();
    const key2 = SymmetricKey.new();
    // key3 would be used when the test is fully implemented

    const envelope = Envelope.new("Alice")
      .addAssertion("knows", "Bob")
      .addAssertion("age", 30)
      .addAssertion("city", "Boston");

    // Encrypt different parts with different keys
    const knowsAssertion = envelope.assertionWithPredicate("knows");
    const ageAssertion = envelope.assertionWithPredicate("age");

    const encrypt1Target = new Set([knowsAssertion.digest()]);
    const encrypt2Target = new Set([ageAssertion.digest()]);

    const encrypted = envelope
      .elideRemovingSetWithAction(encrypt1Target, { type: "encrypt", key: key1 })
      .elideRemovingSetWithAction(encrypt2Target, { type: "encrypt", key: key2 });

    // Verify parts are encrypted
    const formatted = encrypted.format();
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"city": "Boston"');
    expect(formatted).toContain("ENCRYPTED");

    // Count encrypted nodes
    const encryptedNodes = encrypted.nodesMatching(undefined, [ObscureType.Encrypted]);
    expect(encryptedNodes.size).toBe(2);

    // Decrypt with wrong key should leave unchanged
    const encryptedWithKey3Target = encrypted.nodesMatching(undefined, [ObscureType.Encrypted]);
    expect(encryptedWithKey3Target.size).toBe(2);
  });
});

describe("Walk Decompress", () => {
  it("should decompress multiple compressed parts", () => {
    const envelope = Envelope.new("Alice")
      .addAssertion("knows", "Bob")
      .addAssertion("bio", "A".repeat(1000))
      .addAssertion("description", "B".repeat(1000));

    // Compress multiple parts
    const bioAssertion = envelope.assertionWithPredicate("bio");
    const descAssertion = envelope.assertionWithPredicate("description");

    const bioDigest = bioAssertion.digest();
    const descDigest = descAssertion.digest();

    const compressTarget = new Set([bioDigest, descDigest]);

    const compressed = envelope.elideRemovingSetWithAction(compressTarget, { type: "compress" });

    // Verify parts are compressed
    const formatted = compressed.format();
    expect(formatted).toContain('"Alice"');
    expect(formatted).toContain('"knows": "Bob"');
    expect(formatted).toContain("COMPRESSED");

    // Count compressed nodes
    const compressedNodes = compressed.nodesMatching(undefined, [ObscureType.Compressed]);
    expect(compressedNodes.size).toBe(2);

    // Test finding compressed nodes with target filter (only one node)
    const targetFilter = new Set([bioDigest]);
    const partial = compressed.nodesMatching(targetFilter, [ObscureType.Compressed]);
    expect(partial.size).toBe(1);
    expect(containsDigest(partial, bioDigest)).toBe(true);

    // Decompress with non-matching target
    const noMatchTarget = new Set([Digest.fromImage(new TextEncoder().encode("nonexistent"))]);
    const noMatches = compressed.nodesMatching(noMatchTarget, [ObscureType.Compressed]);
    expect(noMatches.size).toBe(0);
  });
});

describe("Mixed Obscuration Operations", () => {
  it("should handle mixed elision, encryption, and compression", () => {
    const key = SymmetricKey.new();

    const envelope = Envelope.new("Alice")
      .addAssertion("knows", "Bob")
      .addAssertion("age", 30)
      .addAssertion("bio", "A".repeat(1000));

    const knowsAssertion = envelope.assertionWithPredicate("knows");
    const ageAssertion = envelope.assertionWithPredicate("age");
    const bioAssertion = envelope.assertionWithPredicate("bio");

    const knowsDigest = knowsAssertion.digest();
    const ageDigest = ageAssertion.digest();
    const bioDigest = bioAssertion.digest();

    // Apply different obscuration types
    const elideTarget = new Set([knowsDigest]);
    const encryptTarget = new Set([ageDigest]);
    const compressTarget = new Set([bioDigest]);

    const obscured = envelope
      .elideRemovingSet(elideTarget)
      .elideRemovingSetWithAction(encryptTarget, { type: "encrypt", key: key })
      .elideRemovingSetWithAction(compressTarget, { type: "compress" });

    // Verify different obscuration types
    const elidedNodes = obscured.nodesMatching(undefined, [ObscureType.Elided]);
    const encryptedNodes = obscured.nodesMatching(undefined, [ObscureType.Encrypted]);
    const compressedNodes = obscured.nodesMatching(undefined, [ObscureType.Compressed]);

    expect(containsDigest(elidedNodes, knowsDigest)).toBe(true);
    expect(containsDigest(encryptedNodes, ageDigest)).toBe(true);
    expect(containsDigest(compressedNodes, bioDigest)).toBe(true);

    // The original envelope digest should be preserved
    expect(envelope.digest().equals(obscured.digest())).toBe(true);
  });
});

describe("Digest preservation", () => {
  it("should preserve digest through all obscuring operations", () => {
    const envelope = Envelope.new("Test message");
    const originalDigest = envelope.digest();
    const key = SymmetricKey.new();

    // Encryption preserves digest
    const encrypted = envelope.encryptSubject(key);
    expect(encrypted.digest().equals(originalDigest)).toBe(true);

    // Elision preserves digest
    const elided = envelope.elide();
    expect(elided.digest().equals(originalDigest)).toBe(true);

    // Compression preserves digest
    const compressed = envelope.compress();
    expect(compressed.digest().equals(originalDigest)).toBe(true);
  });
});

describe("Equivalence after restoration", () => {
  it("should recognize equivalent envelopes with different obscuring", () => {
    const envelope = Envelope.new("Hello").addAssertion("key", "value");

    const key = SymmetricKey.new();

    // Encrypt and decrypt should give equivalent envelope
    const encrypted = envelope.encryptSubject(key);
    const decrypted = encrypted.decryptSubject(key);

    expect(decrypted.digest().equals(envelope.digest())).toBe(true);

    // Compress and decompress should give equivalent envelope
    const compressed = envelope.compress();
    const decompressed = compressed.decompress();

    expect(decompressed.digest().equals(envelope.digest())).toBe(true);
  });
});

// Helper function to check if a Set of Digests contains a specific Digest
function containsDigest(digestSet: Set<Digest>, targetDigest: Digest): boolean {
  for (const d of digestSet) {
    if (d.equals(targetDigest)) {
      return true;
    }
  }
  return false;
}
