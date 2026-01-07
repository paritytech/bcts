/**
 * Tests for XID class
 *
 * Ported from bc-components-rust/src/id/xid.rs
 */

import { describe, it, expect } from "vitest";
import { XID } from "../src/id/xid.js";

describe("XID", () => {
  // Test XID hex string (32 bytes = 64 hex characters)
  const TEST_HEX = "de2853684ae55803a08b36dd7f4e566649970601927330299fd333f33fecc037";

  describe("creation", () => {
    it("should create a random XID", () => {
      const xid = XID.random();

      expect(xid.data().length).toBe(XID.XID_SIZE);
    });

    it("should create unique random XIDs", () => {
      const xid1 = XID.random();
      const xid2 = XID.random();

      expect(xid1.equals(xid2)).toBe(false);
    });

    it("should create an XID from raw data", () => {
      const rawData = new Uint8Array(XID.XID_SIZE);
      const xid = XID.fromData(rawData);

      expect(xid.data()).toEqual(rawData);
    });

    it("should create an XID using fromDataRef", () => {
      const rawData = new Uint8Array(XID.XID_SIZE);
      const xid = XID.fromDataRef(rawData);

      expect(xid.data().length).toBe(XID.XID_SIZE);
    });

    it("should throw on wrong size with fromDataRef", () => {
      const wrongSizeData = new Uint8Array(XID.XID_SIZE + 1);

      expect(() => XID.fromDataRef(wrongSizeData)).toThrow();
    });

    it("should create an XID using from (legacy alias)", () => {
      const rawData = new Uint8Array(XID.XID_SIZE);
      const xid = XID.from(rawData);

      expect(xid.data().length).toBe(XID.XID_SIZE);
    });

    it("should create an XID from hex string", () => {
      const xid = XID.fromHex(TEST_HEX);

      expect(xid.data().length).toBe(XID.XID_SIZE);
      expect(xid.toHex()).toBe(TEST_HEX);
    });

    it("should throw on invalid hex length", () => {
      expect(() => XID.fromHex("abc")).toThrow();
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const xid = XID.random();

      expect(xid.data()).toBeInstanceOf(Uint8Array);
      expect(xid.asBytes()).toBeInstanceOf(Uint8Array);
      expect(xid.toData()).toBeInstanceOf(Uint8Array);
    });

    it("should return hex representation", () => {
      const xid = XID.random();
      const hex = xid.toHex();

      expect(typeof hex).toBe("string");
      expect(hex.length).toBe(XID.XID_SIZE * 2);
    });

    it("should return base64 representation", () => {
      const xid = XID.random();

      expect(typeof xid.toBase64()).toBe("string");
    });

    it("should return short description (first 4 bytes)", () => {
      const xid = XID.fromHex(TEST_HEX);
      const shortDesc = xid.shortDescription();

      expect(shortDesc).toBe("de285368");
      expect(shortDesc.length).toBe(8);
    });

    it("should return same value from shortDescription() and shortReference()", () => {
      const xid = XID.random();

      expect(xid.shortDescription()).toBe(xid.shortReference());
    });

    it("should return string representation", () => {
      const xid = XID.fromHex(TEST_HEX);
      const str = xid.toString();

      expect(str).toBe(`XID(${TEST_HEX})`);
    });
  });

  describe("hex roundtrip", () => {
    it("should roundtrip through hex", () => {
      const xid = XID.random();
      const hex = xid.toHex();
      const restored = XID.fromHex(hex);

      expect(restored.equals(xid)).toBe(true);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const xid = XID.random();

      expect(xid.equals(xid)).toBe(true);
    });

    it("should be equal to another XID with the same data", () => {
      const xid1 = XID.fromHex(TEST_HEX);
      const xid2 = XID.fromHex(TEST_HEX);

      expect(xid1.equals(xid2)).toBe(true);
    });

    it("should not be equal to an XID with different data", () => {
      const xid1 = XID.fromHex(TEST_HEX);
      // Change last nibble
      const xid2 = XID.fromHex("de2853684ae55803a08b36dd7f4e566649970601927330299fd333f33fecc038");

      expect(xid1.equals(xid2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const xid = XID.random();
      const tags = xid.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40024); // XID tag
    });

    it("should serialize to untagged CBOR", () => {
      const xid = XID.random();
      const untagged = xid.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const xid = XID.random();
      const tagged = xid.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const xid = XID.random();
      const data = xid.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const xid = XID.random();
      const data = xid.taggedCborData();
      const restored = XID.fromTaggedCborData(data);

      expect(restored.equals(xid)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const xid = XID.random();
      const data = xid.untaggedCbor().toData();
      const restored = XID.fromUntaggedCborData(data);

      expect(restored.equals(xid)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const xid = XID.random();
      const ur = xid.ur();

      expect(ur).toBeDefined();
    });

    it("should serialize to UR string", () => {
      const xid = XID.random();
      const urString = xid.urString();

      expect(urString.startsWith("ur:xid/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const xid = XID.random();
      const urString = xid.urString();
      const restored = XID.fromURString(urString);

      expect(restored.equals(xid)).toBe(true);
    });

    it("should match known UR string from Rust implementation", () => {
      const xid = XID.fromHex(TEST_HEX);
      const urString = xid.urString();

      // Expected from Rust test: ur:xid/hdcxuedeguisgevwhdaxnbluenutlbglhfiygamsamadmojkdydtneteeowffhwprtemcaatledk
      expect(urString).toBe(
        "ur:xid/hdcxuedeguisgevwhdaxnbluenutlbglhfiygamsamadmojkdydtneteeowffhwprtemcaatledk",
      );
    });

    it("should throw on invalid UR type", () => {
      const invalidUr = "ur:not_xid/invalid";

      expect(() => XID.fromURString(invalidUr)).toThrow();
    });
  });

  describe("Rust test compatibility", () => {
    it("should match Rust test vector", () => {
      const xid = XID.fromHex(TEST_HEX);

      expect(xid.toHex()).toBe(TEST_HEX);
      expect(xid.shortDescription()).toBe("de285368");
      expect(xid.toString()).toBe(`XID(${TEST_HEX})`);
    });
  });

  describe("bytewords and bytemoji identifiers", () => {
    // Uses TEST_HEX from top of file: de2853684ae55803...
    // First 4 bytes: de 28 53 68 -> from bc-components-rust/src/id/xid.rs test

    it("should return bytewords identifier without prefix", () => {
      const xid = XID.fromHex(TEST_HEX);
      const identifier = xid.bytewordsIdentifier(false);

      // First 4 bytes: de 28 53 68 -> uppercase bytewords
      // Matches Rust test: xid.bytewords_identifier(true) == "🅧 URGE DICE GURU IRIS"
      expect(identifier).toBe("URGE DICE GURU IRIS");
    });

    it("should return bytewords identifier with prefix", () => {
      const xid = XID.fromHex(TEST_HEX);
      const identifier = xid.bytewordsIdentifier(true);

      // Matches Rust test: xid.bytewords_identifier(true) == "🅧 URGE DICE GURU IRIS"
      expect(identifier).toBe("🅧 URGE DICE GURU IRIS");
    });

    it("should return bytemoji identifier without prefix", () => {
      const xid = XID.fromHex(TEST_HEX);
      const identifier = xid.bytemojisIdentifier(false);

      // First 4 bytes: de 28 53 68 -> bytemojis
      // Matches Rust test: xid.bytemoji_identifier(true) == "🅧 🐻 😻 🍞 💐"
      expect(identifier).toBe("🐻 😻 🍞 💐");
    });

    it("should return bytemoji identifier with prefix", () => {
      const xid = XID.fromHex(TEST_HEX);
      const identifier = xid.bytemojisIdentifier(true);

      // Matches Rust test: xid.bytemoji_identifier(true) == "🅧 🐻 😻 🍞 💐"
      expect(identifier).toBe("🅧 🐻 😻 🍞 💐");
    });

    it("should default to no prefix", () => {
      const xid = XID.fromHex(TEST_HEX);

      expect(xid.bytewordsIdentifier()).toBe("URGE DICE GURU IRIS");
      expect(xid.bytemojisIdentifier()).toBe("🐻 😻 🍞 💐");
    });
  });
});
