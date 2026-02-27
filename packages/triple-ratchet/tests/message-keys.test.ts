import { describe, it, expect } from "vitest";
import { deriveMessageKeys } from "../src/message-keys.js";
import { MessageKeys } from "@bcts/double-ratchet";

/**
 * Helper: create a deterministic Uint8Array of `len` bytes filled with `fill`.
 */
function filledBytes(len: number, fill: number): Uint8Array {
  return new Uint8Array(len).fill(fill);
}

describe("deriveMessageKeys", () => {
  const chainKeySeed = filledBytes(32, 0x01);
  const pqRatchetKey = filledBytes(32, 0xaa);

  // -----------------------------------------------------------------------
  // 1. Output has correct lengths
  // -----------------------------------------------------------------------
  describe("output structure", () => {
    it("should produce a cipherKey of 32 bytes", () => {
      const mk = deriveMessageKeys(chainKeySeed, pqRatchetKey, 0);
      expect(mk.cipherKey).toBeInstanceOf(Uint8Array);
      expect(mk.cipherKey.length).toBe(32);
    });

    it("should produce a macKey of 32 bytes", () => {
      const mk = deriveMessageKeys(chainKeySeed, pqRatchetKey, 0);
      expect(mk.macKey).toBeInstanceOf(Uint8Array);
      expect(mk.macKey.length).toBe(32);
    });

    it("should produce an iv of 16 bytes", () => {
      const mk = deriveMessageKeys(chainKeySeed, pqRatchetKey, 0);
      expect(mk.iv).toBeInstanceOf(Uint8Array);
      expect(mk.iv.length).toBe(16);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Counter is preserved
  // -----------------------------------------------------------------------
  describe("counter preservation", () => {
    it("should preserve counter = 0", () => {
      const mk = deriveMessageKeys(chainKeySeed, pqRatchetKey, 0);
      expect(mk.counter).toBe(0);
    });

    it("should preserve counter = 42", () => {
      const mk = deriveMessageKeys(chainKeySeed, pqRatchetKey, 42);
      expect(mk.counter).toBe(42);
    });

    it("should preserve a large counter value", () => {
      const mk = deriveMessageKeys(chainKeySeed, pqRatchetKey, 999_999);
      expect(mk.counter).toBe(999_999);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Deterministic: same inputs produce same outputs
  // -----------------------------------------------------------------------
  describe("determinism", () => {
    it("should produce identical output for identical inputs", () => {
      const a = deriveMessageKeys(chainKeySeed, pqRatchetKey, 5);
      const b = deriveMessageKeys(chainKeySeed, pqRatchetKey, 5);

      expect(a.cipherKey).toEqual(b.cipherKey);
      expect(a.macKey).toEqual(b.macKey);
      expect(a.iv).toEqual(b.iv);
      expect(a.counter).toBe(b.counter);
    });

    it("should produce identical output when using separate but equal byte arrays", () => {
      const seed1 = Uint8Array.from(chainKeySeed);
      const seed2 = Uint8Array.from(chainKeySeed);
      const pq1 = Uint8Array.from(pqRatchetKey);
      const pq2 = Uint8Array.from(pqRatchetKey);

      const a = deriveMessageKeys(seed1, pq1, 7);
      const b = deriveMessageKeys(seed2, pq2, 7);

      expect(a.cipherKey).toEqual(b.cipherKey);
      expect(a.macKey).toEqual(b.macKey);
      expect(a.iv).toEqual(b.iv);
    });
  });

  // -----------------------------------------------------------------------
  // 4. pqRatchetKey=null matches double-ratchet's MessageKeys.deriveFrom
  // -----------------------------------------------------------------------
  describe("null pqRatchetKey compatibility", () => {
    it("should match MessageKeys.deriveFrom when pqRatchetKey is null", () => {
      const tripleResult = deriveMessageKeys(chainKeySeed, null, 10);
      const doubleResult = MessageKeys.deriveFrom(chainKeySeed, 10);

      expect(tripleResult.cipherKey).toEqual(doubleResult.cipherKey);
      expect(tripleResult.macKey).toEqual(doubleResult.macKey);
      expect(tripleResult.iv).toEqual(doubleResult.iv);
      expect(tripleResult.counter).toBe(doubleResult.counter);
    });

    it("should match MessageKeys.deriveFrom for various seeds when pqRatchetKey is null", () => {
      for (const fill of [0x00, 0x42, 0xff]) {
        const seed = filledBytes(32, fill);
        const counter = fill;

        const tripleResult = deriveMessageKeys(seed, null, counter);
        const doubleResult = MessageKeys.deriveFrom(seed, counter);

        expect(tripleResult.cipherKey).toEqual(doubleResult.cipherKey);
        expect(tripleResult.macKey).toEqual(doubleResult.macKey);
        expect(tripleResult.iv).toEqual(doubleResult.iv);
        expect(tripleResult.counter).toBe(doubleResult.counter);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 5. Non-null pqRatchetKey produces different output from null case
  // -----------------------------------------------------------------------
  describe("pqRatchetKey salt effect", () => {
    it("should produce different keys when pqRatchetKey is non-null vs null", () => {
      const withPq = deriveMessageKeys(chainKeySeed, pqRatchetKey, 0);
      const withoutPq = deriveMessageKeys(chainKeySeed, null, 0);

      // At least one of the derived fields must differ (in practice all will)
      const cipherSame = buffersEqual(withPq.cipherKey, withoutPq.cipherKey);
      const macSame = buffersEqual(withPq.macKey, withoutPq.macKey);
      const ivSame = buffersEqual(withPq.iv, withoutPq.iv);

      expect(cipherSame && macSame && ivSame).toBe(false);
    });

    it("should produce different cipherKey when pqRatchetKey is provided", () => {
      const withPq = deriveMessageKeys(chainKeySeed, pqRatchetKey, 3);
      const withoutPq = deriveMessageKeys(chainKeySeed, null, 3);

      expect(withPq.cipherKey).not.toEqual(withoutPq.cipherKey);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Different pqRatchetKeys produce different outputs
  // -----------------------------------------------------------------------
  describe("different pqRatchetKeys", () => {
    it("should produce different keys for different pqRatchetKey values", () => {
      const pq1 = filledBytes(32, 0xaa);
      const pq2 = filledBytes(32, 0xbb);

      const mk1 = deriveMessageKeys(chainKeySeed, pq1, 0);
      const mk2 = deriveMessageKeys(chainKeySeed, pq2, 0);

      expect(mk1.cipherKey).not.toEqual(mk2.cipherKey);
      expect(mk1.macKey).not.toEqual(mk2.macKey);
      expect(mk1.iv).not.toEqual(mk2.iv);
    });

    it("should produce different keys even when pqRatchetKeys differ by a single byte", () => {
      const pqA = filledBytes(32, 0x00);
      const pqB = filledBytes(32, 0x00);
      pqB[31] = 0x01; // flip only the last byte

      const mkA = deriveMessageKeys(chainKeySeed, pqA, 0);
      const mkB = deriveMessageKeys(chainKeySeed, pqB, 0);

      expect(mkA.cipherKey).not.toEqual(mkB.cipherKey);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Different chainKeySeeds produce different outputs
  // -----------------------------------------------------------------------
  describe("different chainKeySeeds", () => {
    it("should produce different keys for different chainKeySeed values", () => {
      const seed1 = filledBytes(32, 0x01);
      const seed2 = filledBytes(32, 0x02);

      const mk1 = deriveMessageKeys(seed1, pqRatchetKey, 0);
      const mk2 = deriveMessageKeys(seed2, pqRatchetKey, 0);

      expect(mk1.cipherKey).not.toEqual(mk2.cipherKey);
      expect(mk1.macKey).not.toEqual(mk2.macKey);
      expect(mk1.iv).not.toEqual(mk2.iv);
    });

    it("should produce different keys for different seeds even with null pqRatchetKey", () => {
      const seed1 = filledBytes(32, 0x10);
      const seed2 = filledBytes(32, 0x20);

      const mk1 = deriveMessageKeys(seed1, null, 5);
      const mk2 = deriveMessageKeys(seed2, null, 5);

      expect(mk1.cipherKey).not.toEqual(mk2.cipherKey);
    });

    it("should produce different keys when seeds differ by a single byte", () => {
      const seedA = filledBytes(32, 0x00);
      const seedB = filledBytes(32, 0x00);
      seedB[0] = 0x01; // flip only the first byte

      const mkA = deriveMessageKeys(seedA, pqRatchetKey, 0);
      const mkB = deriveMessageKeys(seedB, pqRatchetKey, 0);

      expect(mkA.cipherKey).not.toEqual(mkB.cipherKey);
    });
  });
});

/**
 * Compare two Uint8Arrays for byte-level equality.
 */
function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
