/**
 * Tests for UUID class
 *
 * Ported from bc-components-rust/src/id/uuid.rs
 */

import { describe, it, expect } from "@jest/globals";
import { UUID } from "../src/id/uuid.js";

describe("UUID", () => {
  // Test UUID string (standard format with dashes)
  const TEST_UUID_STRING = "550e8400-e29b-41d4-a716-446655440000";
  // Test hex string (32 hex chars, no dashes)
  const TEST_HEX = "550e8400e29b41d4a716446655440000";

  describe("creation", () => {
    it("should create a new random UUID", () => {
      const uuid = UUID.new();

      expect(uuid.data().length).toBe(UUID.UUID_SIZE);
    });

    it("should create unique random UUIDs", () => {
      const uuid1 = UUID.new();
      const uuid2 = UUID.new();

      expect(uuid1.equals(uuid2)).toBe(false);
    });

    it("should create a UUID using random (alias)", () => {
      const uuid = UUID.random();

      expect(uuid.data().length).toBe(UUID.UUID_SIZE);
    });

    it("should create a UUID from raw data", () => {
      const rawData = new Uint8Array(UUID.UUID_SIZE);
      const uuid = UUID.fromData(rawData);

      expect(uuid.data()).toEqual(rawData);
    });

    it("should create a UUID using fromDataRef", () => {
      const rawData = new Uint8Array(UUID.UUID_SIZE);
      const uuid = UUID.fromDataRef(rawData);

      expect(uuid.data().length).toBe(UUID.UUID_SIZE);
    });

    it("should throw on wrong size with fromDataRef", () => {
      const wrongSizeData = new Uint8Array(UUID.UUID_SIZE + 1);

      expect(() => UUID.fromDataRef(wrongSizeData)).toThrow();
    });

    it("should create a UUID using from (legacy alias)", () => {
      const rawData = new Uint8Array(UUID.UUID_SIZE);
      const uuid = UUID.from(rawData);

      expect(uuid.data().length).toBe(UUID.UUID_SIZE);
    });

    it("should create a UUID from hex string", () => {
      const uuid = UUID.fromHex(TEST_HEX);

      expect(uuid.data().length).toBe(UUID.UUID_SIZE);
      expect(uuid.hex()).toBe(TEST_HEX);
    });

    it("should create a UUID from string representation", () => {
      const uuid = UUID.fromString(TEST_UUID_STRING);

      expect(uuid.toString()).toBe(TEST_UUID_STRING);
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const uuid = UUID.new();

      expect(uuid.data()).toBeInstanceOf(Uint8Array);
      expect(uuid.asBytes()).toBeInstanceOf(Uint8Array);
      expect(uuid.toData()).toBeInstanceOf(Uint8Array);
    });

    it("should return hex representation", () => {
      const uuid = UUID.new();
      const hex = uuid.hex();

      expect(typeof hex).toBe("string");
      expect(hex.length).toBe(UUID.UUID_SIZE * 2);
    });

    it("should return same hex from hex() and toHex()", () => {
      const uuid = UUID.new();

      expect(uuid.hex()).toBe(uuid.toHex());
    });

    it("should return base64 representation", () => {
      const uuid = UUID.new();

      expect(typeof uuid.toBase64()).toBe("string");
    });

    it("should return standard UUID string representation", () => {
      const uuid = UUID.fromString(TEST_UUID_STRING);
      const str = uuid.toString();

      expect(str).toBe(TEST_UUID_STRING);
      // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(str).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe("UUID v4 format", () => {
    it("should generate v4 UUID with correct version and variant", () => {
      const uuid = UUID.random();
      const hex = uuid.toHex();

      // Version 4: bits 48-51 should be 0100 (4)
      const versionNibble = parseInt(hex.charAt(12), 16);
      expect(versionNibble).toBe(4);

      // Variant: bits 64-65 should be 10 (RFC 4122)
      const variantNibble = parseInt(hex.charAt(16), 16);
      expect(variantNibble & 0xc).toBe(0x8); // Check top 2 bits
    });
  });

  describe("hex roundtrip", () => {
    it("should roundtrip through hex", () => {
      const uuid = UUID.new();
      const hex = uuid.hex();
      const restored = UUID.fromHex(hex);

      expect(restored.equals(uuid)).toBe(true);
    });
  });

  describe("string roundtrip", () => {
    it("should roundtrip through string", () => {
      const uuid = UUID.new();
      const str = uuid.toString();
      const restored = UUID.fromString(str);

      expect(restored.equals(uuid)).toBe(true);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const uuid = UUID.new();

      expect(uuid.equals(uuid)).toBe(true);
    });

    it("should be equal to another UUID with the same data", () => {
      const uuid1 = UUID.fromHex(TEST_HEX);
      const uuid2 = UUID.fromHex(TEST_HEX);

      expect(uuid1.equals(uuid2)).toBe(true);
    });

    it("should not be equal to a UUID with different data", () => {
      const uuid1 = UUID.fromHex(TEST_HEX);
      const uuid2 = UUID.fromHex("550e8400e29b41d4a716446655440001"); // last byte different

      expect(uuid1.equals(uuid2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const uuid = UUID.new();
      const tags = uuid.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(37); // Standard UUID tag
    });

    it("should serialize to untagged CBOR", () => {
      const uuid = UUID.new();
      const untagged = uuid.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const uuid = UUID.new();
      const tagged = uuid.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const uuid = UUID.new();
      const data = uuid.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const uuid = UUID.new();
      const data = uuid.taggedCborData();
      const restored = UUID.fromTaggedCborData(data);

      expect(restored.equals(uuid)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const uuid = UUID.new();
      const data = uuid.untaggedCbor().toData();
      const restored = UUID.fromUntaggedCborData(data);

      expect(restored.equals(uuid)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const uuid = UUID.new();
      const ur = uuid.ur();

      expect(ur).toBeDefined();
    });

    it("should serialize to UR string", () => {
      const uuid = UUID.new();
      const urString = uuid.urString();

      expect(urString.startsWith("ur:uuid/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const uuid = UUID.new();
      const urString = uuid.urString();
      const restored = UUID.fromURString(urString);

      expect(restored.equals(uuid)).toBe(true);
    });

    it("should throw on invalid UR type", () => {
      const invalidUr = "ur:not_uuid/invalid";

      expect(() => UUID.fromURString(invalidUr)).toThrow();
    });
  });
});
