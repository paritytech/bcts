// Tests ported from bc-shamir-rust/src/lib.rs

import type { RandomNumberGenerator } from "@blockchain-commons/rand";
import {
  splitSecret,
  recoverSecret,
  ShamirError,
  ShamirErrorType,
} from "../src/index.js";

/**
 * Fake random number generator for deterministic testing.
 * Matches the FakeRandomNumberGenerator in bc-shamir-rust tests.
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
      b = (b + 17) & 0xff; // wrapping add
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

describe("Shamir Secret Sharing", () => {
  describe("split_secret 3/5", () => {
    it("should split a 16-byte secret into 5 shares with threshold 3", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = hexToBytes("0ff784df000c4380a5ed683f7e6e3dcf");

      const shares = splitSecret(3, 5, secret, rng);

      expect(shares.length).toBe(5);
      expect(bytesToHex(shares[0])).toBe("00112233445566778899aabbccddeeff");
      expect(bytesToHex(shares[1])).toBe("d43099fe444807c46921a4f33a2a798b");
      expect(bytesToHex(shares[2])).toBe("d9ad4e3bec2e1a7485698823abf05d36");
      expect(bytesToHex(shares[3])).toBe("0d8cf5f6ec337bc764d1866b5d07ca42");
      expect(bytesToHex(shares[4])).toBe("1aa7fe3199bc5092ef3816b074cabdf2");

      // Recover with shares 1, 2, 4
      const recoveredShareIndexes = [1, 2, 4];
      const recoveredShares = recoveredShareIndexes.map((i) => shares[i]);
      const recoveredSecret = recoverSecret(recoveredShareIndexes, recoveredShares);

      expect(bytesToHex(recoveredSecret)).toBe(bytesToHex(secret));
    });
  });

  describe("split_secret 2/7", () => {
    it("should split a 32-byte secret into 7 shares with threshold 2", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = hexToBytes(
        "204188bfa6b440a1bdfd6753ff55a8241e07af5c5be943db917e3efabc184b1a"
      );

      const shares = splitSecret(2, 7, secret, rng);

      expect(shares.length).toBe(7);
      expect(bytesToHex(shares[0])).toBe(
        "2dcd14c2252dc8489af3985030e74d5a48e8eff1478ab86e65b43869bf39d556"
      );
      expect(bytesToHex(shares[1])).toBe(
        "a1dfdd798388aada635b9974472b4fc59a32ae520c42c9f6a0af70149b882487"
      );
      expect(bytesToHex(shares[2])).toBe(
        "2ee99daf727c0c7773b89a18de64497ff7476dacd1015a45f482a893f7402cef"
      );
      expect(bytesToHex(shares[3])).toBe(
        "a2fb5414d4d96ee58a109b3ca9a84be0259d2c0f9ac92bdd3199e0eed3f1dd3e"
      );
      expect(bytesToHex(shares[4])).toBe(
        "2b851d188b8f5b3653659cc0f7fa45102dadf04b708767385cd803862fcb3c3f"
      );
      expect(bytesToHex(shares[5])).toBe(
        "a797d4a32d2a39a4aacd9de48036478fff77b1e83b4f16a099c34bfb0b7acdee"
      );
      expect(bytesToHex(shares[6])).toBe(
        "28a19475dcde9f09ba2e9e881979413592027216e60c8513cdee937c67b2c586"
      );

      // Recover with shares 3, 4
      const recoveredShareIndexes = [3, 4];
      const recoveredShares = recoveredShareIndexes.map((i) => shares[i]);
      const recoveredSecret = recoverSecret(recoveredShareIndexes, recoveredShares);

      expect(bytesToHex(recoveredSecret)).toBe(bytesToHex(secret));
    });
  });

  describe("example split", () => {
    it("should work with the README example", () => {
      const threshold = 2;
      const shareCount = 3;
      const secret = new TextEncoder().encode("my secret belongs to me.");
      const rng = new FakeRandomNumberGenerator();

      const shares = splitSecret(threshold, shareCount, secret, rng);

      expect(shares.length).toBe(shareCount);
    });
  });

  describe("example recover", () => {
    it("should work with the README example", () => {
      const indexes = [0, 2];
      const shares = [
        new Uint8Array([
          47, 165, 102, 232, 218, 99, 6, 94, 39, 6, 253, 215, 12, 88, 64, 32,
          105, 40, 222, 146, 93, 197, 48, 129,
        ]),
        new Uint8Array([
          221, 174, 116, 201, 90, 99, 136, 33, 64, 215, 60, 84, 207, 28, 74,
          10, 111, 243, 43, 224, 48, 64, 199, 172,
        ]),
      ];

      const secret = recoverSecret(indexes, shares);

      expect(new TextDecoder().decode(secret)).toBe("my secret belongs to me.");
    });
  });

  describe("threshold 1", () => {
    it("should return copies of the secret when threshold is 1", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = hexToBytes("0102030405060708091011121314151617181920212223242526272829303132");

      const shares = splitSecret(1, 5, secret, rng);

      expect(shares.length).toBe(5);
      for (const share of shares) {
        expect(bytesToHex(share)).toBe(bytesToHex(secret));
      }

      // Recover with any single share
      const recoveredSecret = recoverSecret([2], [shares[2]]);
      expect(bytesToHex(recoveredSecret)).toBe(bytesToHex(secret));
    });
  });

  describe("error handling", () => {
    it("should reject secrets that are too short", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = new Uint8Array(8); // Less than MIN_SECRET_LEN (16)

      expect(() => splitSecret(2, 3, secret, rng)).toThrow(ShamirError);
      expect(() => splitSecret(2, 3, secret, rng)).toThrow("secret is too short");
    });

    it("should reject secrets that are too long", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = new Uint8Array(64); // More than MAX_SECRET_LEN (32)

      expect(() => splitSecret(2, 3, secret, rng)).toThrow(ShamirError);
      expect(() => splitSecret(2, 3, secret, rng)).toThrow("secret is too long");
    });

    it("should reject secrets with odd length", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = new Uint8Array(17); // Odd length

      expect(() => splitSecret(2, 3, secret, rng)).toThrow(ShamirError);
      expect(() => splitSecret(2, 3, secret, rng)).toThrow("secret is not of even length");
    });

    it("should reject too many shares", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = new Uint8Array(16);

      expect(() => splitSecret(2, 20, secret, rng)).toThrow(ShamirError);
      expect(() => splitSecret(2, 20, secret, rng)).toThrow("too many shares");
    });

    it("should reject invalid threshold (threshold > shareCount)", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = new Uint8Array(16);

      expect(() => splitSecret(5, 3, secret, rng)).toThrow(ShamirError);
      expect(() => splitSecret(5, 3, secret, rng)).toThrow("invalid threshold");
    });

    it("should reject invalid threshold (threshold < 1)", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = new Uint8Array(16);

      expect(() => splitSecret(0, 3, secret, rng)).toThrow(ShamirError);
    });

    it("should reject shares with unequal length", () => {
      const shares = [
        new Uint8Array(16),
        new Uint8Array(24),
      ];

      expect(() => recoverSecret([0, 1], shares)).toThrow(ShamirError);
      expect(() => recoverSecret([0, 1], shares)).toThrow("shares have unequal length");
    });

    it("should reject checksum failure (wrong shares)", () => {
      const rng = new FakeRandomNumberGenerator();
      const secret = hexToBytes("0ff784df000c4380a5ed683f7e6e3dcf");

      const shares = splitSecret(3, 5, secret, rng);

      // Try to recover with wrong share combination (not enough)
      // Using only 2 shares when threshold is 3 should give wrong result
      // But we need to use corrupted shares to trigger checksum failure
      const corruptedShares = [
        shares[0],
        shares[1],
        new Uint8Array(shares[2].length), // Zeroed share
      ];

      expect(() => recoverSecret([0, 1, 2], corruptedShares)).toThrow(ShamirError);
      expect(() => recoverSecret([0, 1, 2], corruptedShares)).toThrow("checksum failure");
    });
  });
});
