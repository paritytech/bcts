import { Envelope, SymmetricKey } from "../src";
import { SSKRSpec, SSKRGroupSpec } from "@bcts/components";
import { SeededRandomNumberGenerator } from "@bcts/rand";

describe("SSKR Extension", () => {
  // Simple 2-of-3 scheme: 2 shares required out of 3 total
  const simpleSpec = SSKRSpec.new(1, [SSKRGroupSpec.new(2, 3)]);

  // Multi-group scheme: 2 groups, each 2-of-3, any 1 group sufficient
  const multiGroupSpec = SSKRSpec.new(1, [SSKRGroupSpec.new(2, 3), SSKRGroupSpec.new(2, 3)]);

  describe("sskrSplit()", () => {
    it("should split envelope into shares", () => {
      const envelope = Envelope.new("Secret data");
      const contentKey = SymmetricKey.new();

      // Encrypt first
      const encrypted = envelope.encryptSubject(contentKey);

      // Split into shares
      const shares = encrypted.sskrSplit(simpleSpec, contentKey);

      // Should have 1 group with 3 shares
      expect(shares.length).toBe(1);
      expect(shares[0].length).toBe(3);

      // Each share should be an envelope with hasSSKRShare assertion
      for (const share of shares[0]) {
        expect(share.assertions().length).toBe(1);
      }
    });

    it("should create unique shares", () => {
      const envelope = Envelope.new("Secret data");
      const contentKey = SymmetricKey.new();
      const encrypted = envelope.encryptSubject(contentKey);

      const shares = encrypted.sskrSplit(simpleSpec, contentKey);

      // Each share should have different digest
      const digests = shares[0].map((s) => s.digest().hex());
      const uniqueDigests = new Set(digests);
      expect(uniqueDigests.size).toBe(3);
    });

    it("should handle multi-group spec", () => {
      const envelope = Envelope.new("Multi-group secret");
      const contentKey = SymmetricKey.new();
      const encrypted = envelope.encryptSubject(contentKey);

      const shares = encrypted.sskrSplit(multiGroupSpec, contentKey);

      // Should have 2 groups
      expect(shares.length).toBe(2);
      // Each group should have 3 shares
      expect(shares[0].length).toBe(3);
      expect(shares[1].length).toBe(3);
    });
  });

  describe("sskrSplitFlattened()", () => {
    it("should return flat array of all shares", () => {
      const envelope = Envelope.new("Secret data");
      const contentKey = SymmetricKey.new();
      const encrypted = envelope.encryptSubject(contentKey);

      const shares = encrypted.sskrSplitFlattened(simpleSpec, contentKey);

      // Should be a flat array of 3 shares
      expect(shares.length).toBe(3);
    });

    it("should flatten multi-group shares", () => {
      const envelope = Envelope.new("Secret data");
      const contentKey = SymmetricKey.new();
      const encrypted = envelope.encryptSubject(contentKey);

      const shares = encrypted.sskrSplitFlattened(multiGroupSpec, contentKey);

      // Should have 6 total shares (3 + 3)
      expect(shares.length).toBe(6);
    });
  });

  describe("Envelope.sskrJoin()", () => {
    it("should reconstruct with threshold shares", () => {
      const original = Envelope.new("Secret to recover");
      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      // Split into shares
      const shares = encrypted.sskrSplitFlattened(simpleSpec, contentKey);

      // Take only 2 shares (threshold)
      const subset = shares.slice(0, 2);

      // Join should recover the original
      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        subset,
      );

      expect(recovered.asText()).toBe("Secret to recover");
    });

    it("should fail with insufficient shares", () => {
      const original = Envelope.new("Secret to recover");
      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const shares = encrypted.sskrSplitFlattened(simpleSpec, contentKey);

      // Take only 1 share (below threshold)
      const insufficient = shares.slice(0, 1);

      // Join should fail
      expect(() =>
        (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(insufficient),
      ).toThrow();
    });

    it("should fail with empty array", () => {
      expect(() =>
        (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin([]),
      ).toThrow();
    });

    it("should work with any threshold combination", () => {
      const original = Envelope.new("Testing all combinations");
      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const shares = encrypted.sskrSplitFlattened(simpleSpec, contentKey);

      // All possible 2-combinations from 3 shares should work
      const combinations = [
        [shares[0], shares[1]],
        [shares[0], shares[2]],
        [shares[1], shares[2]],
      ];

      for (const combo of combinations) {
        const recovered = (
          Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }
        ).sskrJoin(combo);
        expect(recovered.asText()).toBe("Testing all combinations");
      }
    });

    it("should work with all 3 shares", () => {
      const original = Envelope.new("Full recovery");
      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const shares = encrypted.sskrSplitFlattened(simpleSpec, contentKey);

      // Using all 3 should also work
      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        shares,
      );

      expect(recovered.asText()).toBe("Full recovery");
    });
  });

  describe("Multi-group recovery", () => {
    it("should recover with shares from one group", () => {
      const original = Envelope.new("Multi-group secret");
      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const shares = encrypted.sskrSplit(multiGroupSpec, contentKey);

      // Use 2 shares from first group only
      const groupOneShares = shares[0].slice(0, 2);

      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        groupOneShares,
      );

      expect(recovered.asText()).toBe("Multi-group secret");
    });

    it("should recover with shares from second group", () => {
      const original = Envelope.new("Multi-group secret");
      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const shares = encrypted.sskrSplit(multiGroupSpec, contentKey);

      // Use 2 shares from second group only
      const groupTwoShares = shares[1].slice(0, 2);

      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        groupTwoShares,
      );

      expect(recovered.asText()).toBe("Multi-group secret");
    });
  });

  describe("Complex content", () => {
    it("should handle envelope with assertions", () => {
      const original = Envelope.new("Alice").addAssertion("knows", "Bob").addAssertion("age", 30);

      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const shares = encrypted.sskrSplitFlattened(simpleSpec, contentKey);
      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        shares.slice(0, 2),
      );

      // Should recover the subject with its assertions
      expect(recovered.subject().asText()).toBe("Alice");
    });

    it("should handle binary content", () => {
      const binaryData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const original = Envelope.new(binaryData);

      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const shares = encrypted.sskrSplitFlattened(simpleSpec, contentKey);
      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        shares.slice(0, 2),
      );

      const recoveredBytes = recovered.extractBytes();
      expect(recoveredBytes).toBeDefined();
      expect(new Uint8Array(recoveredBytes)).toEqual(binaryData);
    });
  });

  describe("sskrSplitUsing()", () => {
    // SeededRandomNumberGenerator takes a seed as [bigint, bigint, bigint, bigint]
    const makeSeed = (n: number): [bigint, bigint, bigint, bigint] => [
      BigInt(n),
      BigInt(n + 1),
      BigInt(n + 2),
      BigInt(n + 3),
    ];

    it("should produce deterministic shares with same RNG seed", () => {
      const envelope = Envelope.new("Deterministic test");
      const contentKey = SymmetricKey.new();
      const encrypted = envelope.encryptSubject(contentKey);

      // Use same seed for both RNGs
      const seed = makeSeed(42);

      const rng1 = new SeededRandomNumberGenerator(seed);
      const rng2 = new SeededRandomNumberGenerator(seed);

      const shares1 = encrypted.sskrSplitUsing(simpleSpec, contentKey, rng1);
      const shares2 = encrypted.sskrSplitUsing(simpleSpec, contentKey, rng2);

      // Should produce same shares with same seed
      expect(shares1.length).toBe(shares2.length);
      expect(shares1[0].length).toBe(shares2[0].length);

      // Compare digests of shares
      for (let i = 0; i < shares1[0].length; i++) {
        expect(shares1[0][i].digest().hex()).toBe(shares2[0][i].digest().hex());
      }
    });

    it("should produce different shares with different RNG seeds", () => {
      const envelope = Envelope.new("Different seeds test");
      const contentKey = SymmetricKey.new();
      const encrypted = envelope.encryptSubject(contentKey);

      const seed1 = makeSeed(100);
      const seed2 = makeSeed(200);

      const rng1 = new SeededRandomNumberGenerator(seed1);
      const rng2 = new SeededRandomNumberGenerator(seed2);

      const shares1 = encrypted.sskrSplitUsing(simpleSpec, contentKey, rng1);
      const shares2 = encrypted.sskrSplitUsing(simpleSpec, contentKey, rng2);

      // Should produce different shares with different seeds
      // (very unlikely all 3 shares have same digest)
      const allSame = shares1[0].every((s, i) => s.digest().hex() === shares2[0][i].digest().hex());
      expect(allSame).toBe(false);
    });

    it("should still allow recovery from deterministic shares", () => {
      const original = Envelope.new("Recoverable deterministic");
      const contentKey = SymmetricKey.new();
      const encrypted = original.encryptSubject(contentKey);

      const seed = makeSeed(99);
      const rng = new SeededRandomNumberGenerator(seed);

      const shares = encrypted.sskrSplitUsing(simpleSpec, contentKey, rng);

      // Take 2 shares and recover
      const subset = shares[0].slice(0, 2);
      const recovered = (Envelope as unknown as { sskrJoin: (e: Envelope[]) => Envelope }).sskrJoin(
        subset,
      );

      expect(recovered.asText()).toBe("Recoverable deterministic");
    });
  });
});
