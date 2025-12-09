/**
 * Tests for Salt class
 *
 * Ported from bc-components-rust/src/salt.rs
 */

import { describe, it, expect } from "vitest";
import { Salt } from "../src/salt.js";

describe("Salt", () => {
  const MIN_SALT_SIZE = 8;

  describe("creation", () => {
    it("should create a salt with specific length", () => {
      const salt = Salt.newWithLen(16);

      expect(salt.len()).toBe(16);
    });

    it("should throw when length is less than minimum", () => {
      expect(() => Salt.newWithLen(4)).toThrow();
    });

    it("should create a salt from raw data", () => {
      const rawData = new Uint8Array(16);
      const salt = Salt.fromData(rawData);

      expect(salt.len()).toBe(16);
    });

    it("should create a salt using from (legacy alias)", () => {
      const rawData = new Uint8Array(16);
      const salt = Salt.from(rawData);

      expect(salt.len()).toBe(16);
    });

    it("should create a salt from hex string", () => {
      // 16 bytes = 32 hex chars
      const hex = "0102030405060708090a0b0c0d0e0f10";
      const salt = Salt.fromHex(hex);

      expect(salt.len()).toBe(16);
      expect(salt.hex()).toBe(hex);
    });

    it("should create a salt using random (legacy alias)", () => {
      const salt = Salt.random();

      expect(salt.len()).toBe(16); // Default size
    });

    it("should create a salt using random with custom size", () => {
      const salt = Salt.random(32);

      expect(salt.len()).toBe(32);
    });

    it("should create a salt using proportional (legacy alias)", () => {
      const salt = Salt.proportional(100);

      expect(salt.len()).toBeGreaterThanOrEqual(MIN_SALT_SIZE);
    });
  });

  describe("newInRange", () => {
    it("should create a salt within specified range", () => {
      const salt = Salt.newInRange(16, 32);

      expect(salt.len()).toBeGreaterThanOrEqual(16);
      expect(salt.len()).toBeLessThanOrEqual(32);
    });

    it("should throw when minimum is less than 8", () => {
      expect(() => Salt.newInRange(4, 32)).toThrow();
    });
  });

  describe("newForSize", () => {
    it("should create proportional salt for small size", () => {
      const salt = Salt.newForSize(100);

      expect(salt.len()).toBeGreaterThanOrEqual(MIN_SALT_SIZE);
    });

    it("should create proportional salt for large size", () => {
      const salt = Salt.newForSize(1000);

      expect(salt.len()).toBeGreaterThanOrEqual(MIN_SALT_SIZE);
    });

    it("should create larger salt for larger data", () => {
      // Multiple samples to get reasonable averages
      let smallTotal = 0;
      let largeTotal = 0;
      const samples = 10;

      for (let i = 0; i < samples; i++) {
        smallTotal += Salt.newForSize(100).len();
        largeTotal += Salt.newForSize(1000).len();
      }

      // Large should generally be bigger on average
      expect(largeTotal / samples).toBeGreaterThan(smallTotal / samples);
    });
  });

  describe("accessors", () => {
    it("should return correct length via len()", () => {
      const salt = Salt.newWithLen(20);

      expect(salt.len()).toBe(20);
    });

    it("should return correct length via size()", () => {
      const salt = Salt.newWithLen(20);

      expect(salt.size()).toBe(20);
    });

    it("should return isEmpty correctly", () => {
      const salt = Salt.newWithLen(16);

      expect(salt.isEmpty()).toBe(false);
    });

    it("should return data as bytes", () => {
      const salt = Salt.newWithLen(16);

      expect(salt.asBytes()).toBeInstanceOf(Uint8Array);
      expect(salt.toData()).toBeInstanceOf(Uint8Array);
    });

    it("should return hex representation", () => {
      const salt = Salt.newWithLen(16);
      const hex = salt.hex();

      expect(typeof hex).toBe("string");
      expect(hex.length).toBe(32); // 16 bytes * 2
    });

    it("should return same hex from hex() and toHex()", () => {
      const salt = Salt.newWithLen(16);

      expect(salt.hex()).toBe(salt.toHex());
    });

    it("should return base64 representation", () => {
      const salt = Salt.newWithLen(16);

      expect(typeof salt.toBase64()).toBe("string");
    });

    it("should return string representation", () => {
      const salt = Salt.newWithLen(16);
      const str = salt.toString();

      expect(str).toContain("Salt");
      expect(str).toContain("16");
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const salt = Salt.newWithLen(16);

      expect(salt.equals(salt)).toBe(true);
    });

    it("should be equal to another salt with the same data", () => {
      const hex = "0102030405060708090a0b0c0d0e0f10";
      const salt1 = Salt.fromHex(hex);
      const salt2 = Salt.fromHex(hex);

      expect(salt1.equals(salt2)).toBe(true);
    });

    it("should not be equal to a salt with different data", () => {
      const salt1 = Salt.fromHex("0102030405060708090a0b0c0d0e0f10");
      const salt2 = Salt.fromHex("100f0e0d0c0b0a090807060504030201");

      expect(salt1.equals(salt2)).toBe(false);
    });

    it("should not be equal to salts of different length", () => {
      const salt1 = Salt.newWithLen(16);
      const salt2 = Salt.newWithLen(32);

      expect(salt1.equals(salt2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const salt = Salt.newWithLen(16);
      const tags = salt.cborTags();

      expect(tags.length).toBeGreaterThan(0);
    });

    it("should serialize to untagged CBOR", () => {
      const salt = Salt.newWithLen(16);
      const untagged = salt.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const salt = Salt.newWithLen(16);
      const tagged = salt.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const salt = Salt.newWithLen(16);
      const data = salt.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const salt = Salt.newWithLen(16);
      const data = salt.taggedCborData();
      const restored = Salt.fromTaggedCborData(data);

      expect(restored.equals(salt)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const salt = Salt.newWithLen(16);
      const data = salt.untaggedCbor().toData();
      const restored = Salt.fromUntaggedCborData(data);

      expect(restored.equals(salt)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const salt = Salt.newWithLen(16);
      const ur = salt.ur();

      expect(ur).toBeDefined();
    });

    it("should serialize to UR string", () => {
      const salt = Salt.newWithLen(16);
      const urString = salt.urString();

      expect(urString.startsWith("ur:salt/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const salt = Salt.newWithLen(16);
      const urString = salt.urString();
      const restored = Salt.fromURString(urString);

      expect(restored.equals(salt)).toBe(true);
    });

    it("should throw on invalid UR type", () => {
      const invalidUr = "ur:not_salt/invalid";

      expect(() => Salt.fromURString(invalidUr)).toThrow();
    });
  });
});
