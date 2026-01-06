/**
 * Tests for the HKDFRng module
 * Ported from bc-components-rust/src/hkdf_rng.rs tests
 */

import { describe, it, expect } from "vitest";
import { HKDFRng, bytesToHex } from "../src/index.js";

describe("HKDFRng", () => {
  const KEY_MATERIAL = new TextEncoder().encode("key_material");
  const SALT = "salt";

  describe("creation", () => {
    it("should create with default page length", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);
      expect(rng.getKeyMaterial()).toEqual(KEY_MATERIAL);
      expect(rng.getSalt()).toBe(SALT);
      expect(rng.getPageLength()).toBe(32);
      expect(rng.getPageIndex()).toBe(0);
    });

    it("should create with custom page length", () => {
      const rng = HKDFRng.newWithPageLength(KEY_MATERIAL, SALT, 64);
      expect(rng.getPageLength()).toBe(64);
    });
  });

  describe("deterministic output", () => {
    it("should produce deterministic next_bytes", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);

      expect(bytesToHex(rng.randomData(16))).toBe("1032ac8ffea232a27c79fe381d7eb7e4");
      expect(bytesToHex(rng.randomData(16))).toBe("aeaaf727d35b6f338218391f9f8fa1f3");
      expect(bytesToHex(rng.randomData(16))).toBe("4348a59427711deb1e7d8a6959c6adb4");
      expect(bytesToHex(rng.randomData(16))).toBe("5d937a42cb5fb090fe1a1ec88f56e32b");
    });

    it("should produce deterministic nextU32", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);
      const num = rng.nextU32();
      // JavaScript bitwise ops use signed 32-bit integers
      // 2410426896 as signed 32-bit is -1884540400
      // We use >>> 0 to convert to unsigned for comparison
      expect(num >>> 0).toBe(2410426896);
    });

    it("should produce deterministic nextU64", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);
      const num = rng.nextU64();
      expect(num).toBe(BigInt("11687583197195678224"));
    });

    it("should produce deterministic fillBytes", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);
      const dest = new Uint8Array(16);
      rng.fillBytes(dest);
      expect(bytesToHex(dest)).toBe("1032ac8ffea232a27c79fe381d7eb7e4");
    });
  });

  describe("reproducibility", () => {
    it("should produce same sequence with same seed and salt", () => {
      const rng1 = HKDFRng.new(KEY_MATERIAL, SALT);
      const rng2 = HKDFRng.new(KEY_MATERIAL, SALT);

      const random1_1 = rng1.nextU32();
      const random1_2 = rng1.nextU32();

      const random2_1 = rng2.nextU32();
      const random2_2 = rng2.nextU32();

      expect(random1_1).toBe(random2_1);
      expect(random1_2).toBe(random2_2);
    });

    it("should produce different sequence with different salt", () => {
      const rng1 = HKDFRng.new(KEY_MATERIAL, "salt1");
      const rng2 = HKDFRng.new(KEY_MATERIAL, "salt2");

      const random1 = rng1.nextU32();
      const random2 = rng2.nextU32();

      expect(random1).not.toBe(random2);
    });

    it("should produce different sequence with different key material", () => {
      const keyMaterial1 = new TextEncoder().encode("key1");
      const keyMaterial2 = new TextEncoder().encode("key2");

      const rng1 = HKDFRng.new(keyMaterial1, SALT);
      const rng2 = HKDFRng.new(keyMaterial2, SALT);

      const random1 = rng1.nextU32();
      const random2 = rng2.nextU32();

      expect(random1).not.toBe(random2);
    });
  });

  describe("buffer management", () => {
    it("should handle requests larger than page length", () => {
      const rng = HKDFRng.newWithPageLength(KEY_MATERIAL, SALT, 16);

      // Request more bytes than page length
      const data = rng.randomData(64);
      expect(data.length).toBe(64);

      // Should have fetched multiple pages
      expect(rng.getPageIndex()).toBeGreaterThan(1);
    });

    it("should handle multiple small requests across page boundaries", () => {
      const rng = HKDFRng.newWithPageLength(KEY_MATERIAL, SALT, 16);

      // Make multiple small requests
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < 10; i++) {
        chunks.push(rng.randomData(8));
      }

      // All chunks should be different (statistically)
      const hexChunks = chunks.map(bytesToHex);
      const uniqueChunks = new Set(hexChunks);
      expect(uniqueChunks.size).toBe(10);
    });
  });

  describe("RandomNumberGenerator interface", () => {
    it("should implement randomData", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);
      const data = rng.randomData(32);
      expect(data.length).toBe(32);
    });

    it("should implement fillBytes", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);
      const dest = new Uint8Array(32);
      rng.fillBytes(dest);

      // Should have data (not all zeros)
      const sum = dest.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    });

    it("should implement tryFillBytes", () => {
      const rng = HKDFRng.new(KEY_MATERIAL, SALT);
      const dest = new Uint8Array(32);
      rng.tryFillBytes(dest);

      // Should have data (not all zeros)
      const sum = dest.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    });
  });

  describe("page index progression", () => {
    it("should increment page index as buffer is consumed", () => {
      const rng = HKDFRng.newWithPageLength(KEY_MATERIAL, SALT, 16);

      expect(rng.getPageIndex()).toBe(0);

      // Consume first page
      rng.randomData(16);
      expect(rng.getPageIndex()).toBe(1);

      // Consume second page
      rng.randomData(16);
      expect(rng.getPageIndex()).toBe(2);
    });
  });
});
