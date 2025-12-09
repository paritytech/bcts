// Tests ported from bc-sskr-rust/src/lib.rs

import type { RandomNumberGenerator } from "@blockchain-commons/rand";
import { rngNextInClosedRange } from "@blockchain-commons/rand";
import {
  Secret,
  GroupSpec,
  Spec,
  sskrGenerate,
  sskrGenerateUsing,
  sskrCombine,
  METADATA_SIZE_BYTES,
  MIN_SECRET_LEN,
  MAX_SECRET_LEN,
  MAX_GROUPS_COUNT,
  MAX_SHARE_COUNT,
  SSKRError,
} from "../src/index.js";

/**
 * Fake random number generator for deterministic testing.
 * Matches the FakeRandomNumberGenerator in bc-sskr-rust tests.
 */
class FakeRandomNumberGenerator implements RandomNumberGenerator {
  nextU32(): number {
    throw new Error("Not implemented");
  }

  nextU64(): bigint {
    throw new Error("Not implemented");
  }

  fillBytes(dest: Uint8Array): void {
    this.fillRandomData(dest);
  }

  randomData(size: number): Uint8Array {
    const data = new Uint8Array(size);
    this.fillRandomData(data);
    return data;
  }

  fillRandomData(data: Uint8Array): void {
    let b = 0;
    for (let i = 0; i < data.length; i++) {
      data[i] = b;
      b = (b + 17) & 0xff;
    }
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("SSKR", () => {
  describe("split 3/5 single group", () => {
    it("should split and recover a secret with 3 of 5 shares", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = Secret.new(hexToBytes("0ff784df000c4380a5ed683f7e6e3dcf"));
      const group = GroupSpec.new(3, 5);
      const spec = Spec.new(1, [group]);

      const shares = sskrGenerateUsing(spec, secret, rng);
      const flattenedShares = shares.flat();

      expect(flattenedShares.length).toBe(5);
      for (const share of flattenedShares) {
        expect(share.length).toBe(METADATA_SIZE_BYTES + secret.len());
      }

      // Recover with shares 1, 2, 4
      const recoveredShareIndexes = [1, 2, 4];
      const recoveredShares = recoveredShareIndexes.map((i) => flattenedShares[i]);
      const recoveredSecret = sskrCombine(recoveredShares);

      expect(recoveredSecret.equals(secret)).toBe(true);
    });
  });

  describe("split 2/7 single group", () => {
    it("should split and recover a 32-byte secret with 2 of 7 shares", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = Secret.new(
        hexToBytes("204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a")
      );
      const group = GroupSpec.new(2, 7);
      const spec = Spec.new(1, [group]);

      const shares = sskrGenerateUsing(spec, secret, rng);

      expect(shares.length).toBe(1);
      expect(shares[0].length).toBe(7);
      const flattenedShares = shares.flat();
      expect(flattenedShares.length).toBe(7);
      for (const share of flattenedShares) {
        expect(share.length).toBe(METADATA_SIZE_BYTES + secret.len());
      }

      // Recover with shares 3, 4
      const recoveredShareIndexes = [3, 4];
      const recoveredShares = recoveredShareIndexes.map((i) => flattenedShares[i]);
      const recoveredSecret = sskrCombine(recoveredShares);

      expect(recoveredSecret.equals(secret)).toBe(true);
    });
  });

  describe("split 2/3 + 2/3 two groups", () => {
    it("should split and recover with two groups requiring quorum from both", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = Secret.new(
        hexToBytes("204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a")
      );
      const group1 = GroupSpec.new(2, 3);
      const group2 = GroupSpec.new(2, 3);
      const spec = Spec.new(2, [group1, group2]);

      const shares = sskrGenerateUsing(spec, secret, rng);

      expect(shares.length).toBe(2);
      expect(shares[0].length).toBe(3);
      expect(shares[1].length).toBe(3);
      const flattenedShares = shares.flat();
      expect(flattenedShares.length).toBe(6);
      for (const share of flattenedShares) {
        expect(share.length).toBe(METADATA_SIZE_BYTES + secret.len());
      }

      // Recover with shares 0, 1 from group1 and 3, 5 from group2
      const recoveredShareIndexes = [0, 1, 3, 5];
      const recoveredShares = recoveredShareIndexes.map((i) => flattenedShares[i]);
      const recoveredSecret = sskrCombine(recoveredShares);

      expect(recoveredSecret.equals(secret)).toBe(true);
    });
  });

  describe("example from README", () => {
    it("should work with the documentation example", () => {
      const secretString = "my secret belongs to me.";
      const secret = Secret.new(secretString);

      // Split the secret into 2 groups, the first requiring 2 of three shares
      // and the second requiring 3 of 5 shares.
      const group1 = GroupSpec.new(2, 3);
      const group2 = GroupSpec.new(3, 5);
      const spec = Spec.new(2, [group1, group2]);

      const shares = sskrGenerate(spec, secret);

      expect(shares.length).toBe(2);
      expect(shares[0].length).toBe(3);
      expect(shares[1].length).toBe(5);

      // Recover from a quorum of shares from each group
      const recoveredShares = [
        shares[0][0],
        shares[0][2],
        shares[1][0],
        shares[1][1],
        shares[1][4],
      ];

      const recoveredSecret = sskrCombine(recoveredShares);
      expect(recoveredSecret.equals(secret)).toBe(true);
    });
  });

  describe("1-of-N groups", () => {
    it("should work with 1-of-3 group (threshold 1)", () => {
      const text = "my secret belongs to me.";
      const secret = Secret.new(text);
      const spec = Spec.new(1, [GroupSpec.new(1, 3)]);

      const shares = sskrGenerate(spec, secret);
      const flatShares = shares.flat();

      const recoveredSecret = sskrCombine(flatShares);
      expect(new TextDecoder().decode(recoveredSecret.getData())).toBe(text);
    });

    it("should work with 1-of-1 group", () => {
      const text = "my secret belongs to me.";
      const secret = Secret.new(text);
      const spec = Spec.new(1, [GroupSpec.new(1, 1)]);

      const shares = sskrGenerate(spec, secret);
      const flatShares = shares.flat();

      const recoveredSecret = sskrCombine(flatShares);
      expect(new TextDecoder().decode(recoveredSecret.getData())).toBe(text);
    });

    it("should work with 2-of-3 group", () => {
      const text = "my secret belongs to me.";
      const secret = Secret.new(text);
      const spec = Spec.new(1, [GroupSpec.new(2, 3)]);

      const shares = sskrGenerate(spec, secret);
      const flatShares = shares.flat();

      const recoveredSecret = sskrCombine(flatShares);
      expect(new TextDecoder().decode(recoveredSecret.getData())).toBe(text);
    });
  });

  describe("group threshold 1 with extra shares", () => {
    it("should ignore extra group shares when group threshold is 1", () => {
      const text = "my secret belongs to me.";
      const secret = Secret.new(text);
      const spec = Spec.new(1, [GroupSpec.new(2, 3), GroupSpec.new(2, 3)]);

      const groupedShares = sskrGenerate(spec, secret);
      const flattenedShares = groupedShares.flat();

      // The group threshold is 1, but we're providing an additional share
      // from the second group. This was previously causing an error,
      // because the second group could not be decoded. The correct
      // behavior is to ignore any group's shares that cannot be decoded.
      const recoveredShareIndexes = [0, 1, 3];
      const recoveredShares = recoveredShareIndexes.map((i) => flattenedShares[i]);
      const recoveredSecret = sskrCombine(recoveredShares);

      expect(new TextDecoder().decode(recoveredSecret.getData())).toBe(text);
    });
  });

  describe("error handling", () => {
    it("should reject empty shares", () => {
      expect(() => sskrCombine([])).toThrow(SSKRError);
      expect(() => sskrCombine([])).toThrow("SSKR shares were empty");
    });

    it("should reject secrets that are too short", () => {
      expect(() => Secret.new(new Uint8Array(8))).toThrow(SSKRError);
      expect(() => Secret.new(new Uint8Array(8))).toThrow("SSKR secret is too short");
    });

    it("should reject secrets that are too long", () => {
      expect(() => Secret.new(new Uint8Array(64))).toThrow(SSKRError);
      expect(() => Secret.new(new Uint8Array(64))).toThrow("SSKR secret is too long");
    });

    it("should reject secrets with odd length", () => {
      expect(() => Secret.new(new Uint8Array(17))).toThrow(SSKRError);
      expect(() => Secret.new(new Uint8Array(17))).toThrow("SSKR secret is not of even length");
    });

    it("should reject invalid group threshold (threshold > count)", () => {
      expect(() => Spec.new(5, [GroupSpec.new(2, 3)])).toThrow(SSKRError);
      expect(() => Spec.new(5, [GroupSpec.new(2, 3)])).toThrow("group threshold is invalid");
    });

    it("should reject invalid group threshold (threshold = 0)", () => {
      expect(() => Spec.new(0, [GroupSpec.new(2, 3)])).toThrow(SSKRError);
    });

    it("should reject invalid member threshold", () => {
      expect(() => GroupSpec.new(5, 3)).toThrow(SSKRError);
      expect(() => GroupSpec.new(5, 3)).toThrow("member threshold is invalid");
    });

    it("should reject invalid member count (0)", () => {
      expect(() => GroupSpec.new(0, 0)).toThrow(SSKRError);
      expect(() => GroupSpec.new(0, 0)).toThrow("member count is invalid");
    });

    it("should reject invalid member count (too large)", () => {
      expect(() => GroupSpec.new(2, 100)).toThrow(SSKRError);
      expect(() => GroupSpec.new(2, 100)).toThrow("member count is invalid");
    });

    it("should parse group spec from string", () => {
      const spec = GroupSpec.parse("2-of-3");
      expect(spec.memberThreshold()).toBe(2);
      expect(spec.memberCount()).toBe(3);
    });

    it("should reject invalid group spec string", () => {
      expect(() => GroupSpec.parse("invalid")).toThrow(SSKRError);
      expect(() => GroupSpec.parse("2-3")).toThrow(SSKRError);
      expect(() => GroupSpec.parse("2-from-3")).toThrow(SSKRError);
    });
  });
});
