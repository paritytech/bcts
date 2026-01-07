// Tests ported from bc-sskr-rust/src/lib.rs

import type { RandomNumberGenerator } from "@bcts/rand";
import {
  rngNextInClosedRange,
  rngNextInClosedRangeI32,
  makeFakeRandomNumberGenerator,
} from "@bcts/rand";
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

// Utility kept for debugging - uncomment when needed
// function bytesToHex(bytes: Uint8Array): string {
//   return Array.from(bytes)
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
// }

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
        hexToBytes("204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a"),
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
        hexToBytes("204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a"),
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

  describe("shuffle", () => {
    /**
     * Fisher-Yates shuffle implementation.
     * Matches the Rust implementation in bc-sskr-rust tests.
     * Uses 64-bit arithmetic (bigint) to match Rust's usize.
     */
    function fisherYatesShuffle<T>(slice: T[], rng: RandomNumberGenerator): void {
      let i = slice.length;
      while (i > 1) {
        i -= 1;
        const j = Number(rngNextInClosedRange(rng, 0n, BigInt(i)));
        [slice[i], slice[j]] = [slice[j], slice[i]];
      }
    }

    it("should match Rust shuffle output with same seed", () => {
      const rng = makeFakeRandomNumberGenerator();
      const v: number[] = [];
      for (let i = 0; i < 100; i++) {
        v.push(i);
      }

      fisherYatesShuffle(v, rng);

      expect(v.length).toBe(100);
      expect(v).toEqual([
        79, 70, 40, 53, 25, 30, 31, 88, 10, 1, 45, 54, 81, 58, 55, 59, 69, 78, 65, 47, 75, 61, 0,
        72, 20, 9, 80, 13, 73, 11, 60, 56, 19, 42, 33, 12, 36, 38, 6, 35, 68, 77, 50, 18, 97, 49,
        98, 85, 89, 91, 15, 71, 99, 67, 84, 23, 64, 14, 57, 48, 62, 29, 28, 94, 44, 8, 66, 34, 43,
        21, 63, 16, 92, 95, 27, 51, 26, 86, 22, 41, 93, 82, 7, 87, 74, 37, 46, 3, 96, 24, 90, 39,
        32, 17, 76, 4, 83, 2, 52, 5,
      ]);
    });
  });

  describe("fuzz test", () => {
    /**
     * Fisher-Yates shuffle implementation for fuzz testing.
     * Uses 64-bit arithmetic (bigint) to match Rust's usize.
     */
    function fisherYatesShuffle<T>(slice: T[], rng: RandomNumberGenerator): void {
      let i = slice.length;
      while (i > 1) {
        i -= 1;
        const j = Number(rngNextInClosedRange(rng, 0n, BigInt(i)));
        [slice[i], slice[j]] = [slice[j], slice[i]];
      }
    }

    /**
     * Helper class for organizing recovery specifications.
     * Matches RecoverSpec in Rust tests.
     */
    class RecoverSpec {
      readonly secret: Secret;
      readonly spec: Spec;
      readonly shares: Uint8Array[][];
      readonly recoveredGroupIndexes: number[];
      readonly recoveredMemberIndexes: number[][];
      readonly recoveredShares: Uint8Array[];

      constructor(secret: Secret, spec: Spec, shares: Uint8Array[][], rng: RandomNumberGenerator) {
        this.secret = secret;
        this.spec = spec;
        this.shares = shares;

        // Shuffle and select group indexes
        const groupIndexes: number[] = [];
        for (let i = 0; i < spec.groupCount(); i++) {
          groupIndexes.push(i);
        }
        fisherYatesShuffle(groupIndexes, rng);
        this.recoveredGroupIndexes = groupIndexes.slice(0, spec.groupThreshold());

        // Select member indexes for each recovered group
        this.recoveredMemberIndexes = [];
        for (const groupIndex of this.recoveredGroupIndexes) {
          const group = spec.groups()[groupIndex];
          const memberIndexes: number[] = [];
          for (let i = 0; i < group.memberCount(); i++) {
            memberIndexes.push(i);
          }
          fisherYatesShuffle(memberIndexes, rng);
          this.recoveredMemberIndexes.push(memberIndexes.slice(0, group.memberThreshold()));
        }

        // Collect recovered shares
        this.recoveredShares = [];
        for (let i = 0; i < this.recoveredGroupIndexes.length; i++) {
          const groupShares = shares[this.recoveredGroupIndexes[i]];
          for (const memberIndex of this.recoveredMemberIndexes[i]) {
            this.recoveredShares.push(groupShares[memberIndex]);
          }
        }
        fisherYatesShuffle(this.recoveredShares, rng);
      }

      recover(): boolean {
        try {
          const recoveredSecret = sskrCombine(this.recoveredShares);
          return recoveredSecret.equals(this.secret);
        } catch {
          return false;
        }
      }
    }

    /**
     * Single fuzz test iteration.
     * Matches one_fuzz_test in Rust tests.
     */
    function oneFuzzTest(rng: RandomNumberGenerator): void {
      // Generate random secret length (even, between MIN and MAX)
      const secretLen = rngNextInClosedRangeI32(rng, MIN_SECRET_LEN, MAX_SECRET_LEN) & ~1;
      const secret = Secret.new(rng.randomData(secretLen));

      // Generate random group specifications
      const groupCount = rngNextInClosedRangeI32(rng, 1, MAX_GROUPS_COUNT);
      const groupSpecs: GroupSpec[] = [];
      for (let i = 0; i < groupCount; i++) {
        const memberCount = rngNextInClosedRangeI32(rng, 1, MAX_SHARE_COUNT);
        const memberThreshold = rngNextInClosedRangeI32(rng, 1, memberCount);
        groupSpecs.push(GroupSpec.new(memberThreshold, memberCount));
      }

      const groupThreshold = rngNextInClosedRangeI32(rng, 1, groupCount);
      const spec = Spec.new(groupThreshold, groupSpecs);
      const shares = sskrGenerateUsing(spec, secret, rng);

      const recoverSpec = new RecoverSpec(secret, spec, shares, rng);
      const success = recoverSpec.recover();

      if (!success) {
        throw new Error("Fuzz test failed to recover secret");
      }
    }

    it("should pass 100 random split/recover iterations", () => {
      const rng = makeFakeRandomNumberGenerator();
      for (let i = 0; i < 100; i++) {
        oneFuzzTest(rng);
      }
    });
  });
});
