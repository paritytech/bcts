/**
 * Tests for ARID class
 *
 * Ported from bc-components-rust/src/id/arid.rs
 */

import { describe, it, expect } from "@jest/globals";
import { ARID } from "../src/arid.js";

describe("ARID", () => {
  // Test hex string (32 bytes = 64 hex chars)
  const TEST_HEX = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

  describe("creation", () => {
    it("should create a new random ARID", () => {
      const arid = ARID.new();

      expect(arid.data().length).toBe(ARID.ARID_SIZE);
    });

    it("should create unique random ARIDs", () => {
      const arid1 = ARID.new();
      const arid2 = ARID.new();

      // While technically random, it's astronomically unlikely they'd be equal
      expect(arid1.equals(arid2)).toBe(false);
    });

    it("should create an ARID using random (alias)", () => {
      const arid = ARID.random();

      expect(arid.data().length).toBe(ARID.ARID_SIZE);
    });

    it("should create an ARID from raw data", () => {
      const rawData = new Uint8Array(ARID.ARID_SIZE);
      const arid = ARID.fromData(rawData);

      expect(arid.data()).toEqual(rawData);
    });

    it("should create an ARID using fromDataRef", () => {
      const rawData = new Uint8Array(ARID.ARID_SIZE);
      const arid = ARID.fromDataRef(rawData);

      expect(arid.data().length).toBe(ARID.ARID_SIZE);
    });

    it("should throw on wrong size with fromDataRef", () => {
      const wrongSizeData = new Uint8Array(ARID.ARID_SIZE + 1);

      expect(() => ARID.fromDataRef(wrongSizeData)).toThrow();
    });

    it("should create an ARID using from (legacy alias)", () => {
      const rawData = new Uint8Array(ARID.ARID_SIZE);
      const arid = ARID.from(rawData);

      expect(arid.data().length).toBe(ARID.ARID_SIZE);
    });

    it("should create an ARID from hex string", () => {
      const arid = ARID.fromHex(TEST_HEX);

      expect(arid.data().length).toBe(ARID.ARID_SIZE);
      expect(arid.hex()).toBe(TEST_HEX);
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const arid = ARID.new();

      expect(arid.data()).toBeInstanceOf(Uint8Array);
      expect(arid.asBytes()).toBeInstanceOf(Uint8Array);
      expect(arid.toData()).toBeInstanceOf(Uint8Array);
    });

    it("should return hex representation", () => {
      const arid = ARID.new();
      const hex = arid.hex();

      expect(typeof hex).toBe("string");
      expect(hex.length).toBe(ARID.ARID_SIZE * 2);
    });

    it("should return same hex from hex() and toHex()", () => {
      const arid = ARID.new();

      expect(arid.hex()).toBe(arid.toHex());
    });

    it("should return base64 representation", () => {
      const arid = ARID.new();

      expect(typeof arid.toBase64()).toBe("string");
    });

    it("should return short description", () => {
      const arid = ARID.fromHex(TEST_HEX);
      const shortDesc = arid.shortDescription();

      expect(shortDesc.length).toBe(8); // 4 bytes = 8 hex chars
      expect(shortDesc).toBe(TEST_HEX.slice(0, 8));
    });

    it("should return string representation", () => {
      const arid = ARID.new();
      const str = arid.toString();

      expect(str).toContain("ARID");
    });
  });

  describe("comparison", () => {
    it("should compare ARIDs correctly", () => {
      const arid1 = ARID.fromHex("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
      const arid2 = ARID.fromHex("2102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");

      expect(arid1.compare(arid2)).toBe(-1); // arid1 < arid2
      expect(arid2.compare(arid1)).toBe(1);  // arid2 > arid1
      expect(arid1.compare(arid1)).toBe(0);  // equal
    });
  });

  describe("hex roundtrip", () => {
    it("should roundtrip through hex", () => {
      const arid = ARID.new();
      const hex = arid.hex();
      const restored = ARID.fromHex(hex);

      expect(restored.equals(arid)).toBe(true);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const arid = ARID.new();

      expect(arid.equals(arid)).toBe(true);
    });

    it("should be equal to another ARID with the same data", () => {
      const arid1 = ARID.fromHex(TEST_HEX);
      const arid2 = ARID.fromHex(TEST_HEX);

      expect(arid1.equals(arid2)).toBe(true);
    });

    it("should not be equal to an ARID with different data", () => {
      const arid1 = ARID.fromHex(TEST_HEX);
      const arid2 = ARID.fromHex(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );

      expect(arid1.equals(arid2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const arid = ARID.new();
      const tags = arid.cborTags();

      expect(tags.length).toBeGreaterThan(0);
    });

    it("should serialize to untagged CBOR", () => {
      const arid = ARID.new();
      const untagged = arid.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const arid = ARID.new();
      const tagged = arid.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const arid = ARID.new();
      const data = arid.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const arid = ARID.new();
      const data = arid.taggedCborData();
      const restored = ARID.fromTaggedCborData(data);

      expect(restored.equals(arid)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const arid = ARID.new();
      const data = arid.untaggedCbor().toData();
      const restored = ARID.fromUntaggedCborData(data);

      expect(restored.equals(arid)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const arid = ARID.new();
      const ur = arid.ur();

      expect(ur).toBeDefined();
    });

    it("should serialize to UR string", () => {
      const arid = ARID.new();
      const urString = arid.urString();

      expect(urString.startsWith("ur:arid/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const arid = ARID.new();
      const urString = arid.urString();
      const restored = ARID.fromURString(urString);

      expect(restored.equals(arid)).toBe(true);
    });

    it("should throw on invalid UR type", () => {
      const invalidUr = "ur:not_arid/invalid";

      expect(() => ARID.fromURString(invalidUr)).toThrow();
    });
  });
});
