/**
 * Tests for Seed class
 *
 * Ported from bc-components-rust/src/seed.rs
 */

import { describe, it, expect } from "vitest";
import { Seed } from "../src/seed.js";

describe("Seed", () => {
  // Test seed data (16 bytes minimum)
  const TEST_HEX = "59f2293a5bce7d4de59e71b4207ac5d2";

  describe("creation", () => {
    it("should create a random seed with default size", () => {
      const seed = Seed.random();

      expect(seed.size()).toBeGreaterThanOrEqual(16);
    });

    it("should create a random seed with specified size", () => {
      const seed = Seed.random(32);

      expect(seed.size()).toBe(32);
    });

    it("should throw on seed size less than minimum", () => {
      expect(() => Seed.random(8)).toThrow();
    });

    it("should create a seed from raw data", () => {
      const rawData = new Uint8Array(16).fill(0xab);
      const seed = Seed.from(rawData);

      expect(seed.size()).toBe(16);
    });

    it("should create a seed from hex string", () => {
      const seed = Seed.fromHex(TEST_HEX);

      expect(seed.size()).toBe(16);
      expect(seed.toHex()).toBe(TEST_HEX);
    });

    it("should create a seed with metadata", () => {
      const seed = Seed.random(16, {
        name: "Test Seed",
        note: "A test note",
        createdAt: new Date("2023-06-15T10:30:00Z"),
      });

      expect(seed.name()).toBe("Test Seed");
      expect(seed.note()).toBe("A test note");
      expect(seed.createdAt()?.toISOString()).toBe("2023-06-15T10:30:00.000Z");
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const seed = Seed.random(16);

      expect(seed.toData()).toBeInstanceOf(Uint8Array);
      expect(seed.toData().length).toBe(16);
    });

    it("should return hex representation", () => {
      const seed = Seed.random(16);
      const hex = seed.toHex();

      expect(typeof hex).toBe("string");
      expect(hex.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it("should return base64 representation", () => {
      const seed = Seed.random(16);

      expect(typeof seed.toBase64()).toBe("string");
    });

    it("should return string representation", () => {
      const seed = Seed.random(16);
      const str = seed.toString();

      expect(str).toContain("Seed");
      expect(str).toContain("bytes");
    });
  });

  describe("metadata", () => {
    it("should get and set name", () => {
      const seed = Seed.random(16);

      // Rust API: name() returns empty string when not set
      expect(seed.name()).toBe("");

      seed.setName("My Seed");
      expect(seed.name()).toBe("My Seed");
    });

    it("should get and set note", () => {
      const seed = Seed.random(16);

      // Rust API: note() returns empty string when not set
      expect(seed.note()).toBe("");

      seed.setNote("My Note");
      expect(seed.note()).toBe("My Note");
    });

    it("should get and set creation date", () => {
      const seed = Seed.random(16);
      const date = new Date("2023-06-15T10:30:00Z");

      expect(seed.createdAt()).toBeUndefined();

      seed.setCreatedAt(date);
      expect(seed.createdAt()?.toISOString()).toBe("2023-06-15T10:30:00.000Z");
    });

    it("should return a copy of metadata", () => {
      const seed = Seed.random(16, {
        name: "Test",
        note: "Note",
        createdAt: new Date(),
      });

      const metadata = seed.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe("Test");
      expect(metadata?.note).toBe("Note");
      expect(metadata?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const seed = Seed.random(16);

      expect(seed.equals(seed)).toBe(true);
    });

    it("should be equal to another seed with the same data", () => {
      const seed1 = Seed.fromHex(TEST_HEX);
      const seed2 = Seed.fromHex(TEST_HEX);

      expect(seed1.equals(seed2)).toBe(true);
    });

    it("should not be equal to a seed with different data", () => {
      const seed1 = Seed.fromHex(TEST_HEX);
      const seed2 = Seed.fromHex("59f2293a5bce7d4de59e71b4207ac5d3"); // last byte different

      expect(seed1.equals(seed2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const seed = Seed.random(16);
      const tags = seed.cborTags();

      expect(tags.length).toBe(2); // TAG_SEED and TAG_SEED_V1
      expect(tags[0].value).toBe(40300); // TAG_SEED
      expect(tags[1].value).toBe(300); // TAG_SEED_V1
    });

    it("should serialize to untagged CBOR", () => {
      const seed = Seed.random(16);
      const untagged = seed.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const seed = Seed.random(16);
      const tagged = seed.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const seed = Seed.random(16);
      const data = seed.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const seed = Seed.random(16);
      const data = seed.taggedCborData();
      const restored = Seed.fromTaggedCborData(data);

      expect(restored.equals(seed)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const seed = Seed.random(16);
      const data = seed.untaggedCbor().toData();
      const restored = Seed.fromUntaggedCborData(data);

      expect(restored.equals(seed)).toBe(true);
    });

    it("should roundtrip with metadata through tagged CBOR", () => {
      const date = new Date("2023-06-15T10:30:00.000Z");
      const seed = Seed.random(16, {
        name: "Test Seed",
        note: "A test note",
        createdAt: date,
      });
      const data = seed.taggedCborData();
      const restored = Seed.fromTaggedCborData(data);

      expect(restored.equals(seed)).toBe(true);
      expect(restored.name()).toBe("Test Seed");
      expect(restored.note()).toBe("A test note");
      expect(restored.createdAt()?.toISOString()).toBe("2023-06-15T10:30:00.000Z");
    });

    it("should roundtrip with partial metadata", () => {
      const seed = Seed.random(16, {
        name: "Test Seed",
        // note omitted
        // createdAt omitted
      });
      const data = seed.taggedCborData();
      const restored = Seed.fromTaggedCborData(data);

      expect(restored.equals(seed)).toBe(true);
      expect(restored.name()).toBe("Test Seed");
      // Rust API: note() returns empty string when not set
      expect(restored.note()).toBe("");
      expect(restored.creationDate()).toBeUndefined();
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const seed = Seed.random(16);
      const ur = seed.ur();

      expect(ur).toBeDefined();
    });

    it("should serialize to UR string", () => {
      const seed = Seed.random(16);
      const urString = seed.urString();

      expect(urString.startsWith("ur:seed/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const seed = Seed.random(16);
      const urString = seed.urString();
      const restored = Seed.fromURString(urString);

      expect(restored.equals(seed)).toBe(true);
    });

    it("should roundtrip with metadata through UR string", () => {
      const date = new Date("2023-06-15T10:30:00.000Z");
      const seed = Seed.random(16, {
        name: "Test Seed",
        note: "A test note",
        createdAt: date,
      });
      const urString = seed.urString();
      const restored = Seed.fromURString(urString);

      expect(restored.equals(seed)).toBe(true);
      expect(restored.name()).toBe("Test Seed");
      expect(restored.note()).toBe("A test note");
      expect(restored.createdAt()?.toISOString()).toBe("2023-06-15T10:30:00.000Z");
    });

    it("should throw on invalid UR type", () => {
      const invalidUr = "ur:not_seed/invalid";

      expect(() => Seed.fromURString(invalidUr)).toThrow();
    });
  });

  describe("Rust API parity", () => {
    it("should have MIN_SEED_LENGTH constant", () => {
      expect(Seed.MIN_SEED_LENGTH).toBe(16);
    });

    it("should create seed with Seed.new()", () => {
      const seed = Seed.new();
      expect(seed.size()).toBe(16); // Default size
    });

    it("should create seed with Seed.newWithLen()", () => {
      const seed = Seed.newWithLen(32);
      expect(seed.size()).toBe(32);
    });

    it("should throw on newWithLen with size < 16", () => {
      expect(() => Seed.newWithLen(8)).toThrow();
    });

    it("should create seed with Seed.newWithLenUsing()", () => {
      // Simple deterministic RNG for testing
      let counter = 0;
      const rng = {
        randomData: (size: number) => {
          const data = new Uint8Array(size);
          for (let i = 0; i < size; i++) {
            data[i] = counter++;
          }
          return data;
        },
      };

      const seed = Seed.newWithLenUsing(16, rng);
      expect(seed.size()).toBe(16);
      expect(seed.asBytes()[0]).toBe(0);
      expect(seed.asBytes()[15]).toBe(15);
    });

    it("should create seed with Seed.newOpt()", () => {
      const data = new Uint8Array(16).fill(0xab);
      const date = new Date("2023-06-15T10:30:00Z");

      const seed = Seed.newOpt(data, "Test Name", "Test Note", date);

      expect(seed.name()).toBe("Test Name");
      expect(seed.note()).toBe("Test Note");
      expect(seed.creationDate()?.toISOString()).toBe("2023-06-15T10:30:00.000Z");
    });

    it("should create seed with newOpt and undefined metadata", () => {
      const data = new Uint8Array(16).fill(0xab);
      const seed = Seed.newOpt(data, undefined, undefined, undefined);

      expect(seed.name()).toBe("");
      expect(seed.note()).toBe("");
      expect(seed.creationDate()).toBeUndefined();
    });

    it("should return bytes with asBytes()", () => {
      const seed = Seed.new();
      const bytes = seed.asBytes();

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(16);
      // asBytes returns reference to internal data
      expect(bytes).toBe(seed.asBytes());
    });

    it("should have creationDate() as alias for createdAt()", () => {
      const date = new Date("2023-06-15T10:30:00Z");
      const seed = Seed.newOpt(new Uint8Array(16).fill(0), undefined, undefined, date);

      expect(seed.creationDate()).toBe(seed.createdAt());
    });

    it("should have setCreationDate() as alias for setCreatedAt()", () => {
      const seed = Seed.new();
      const date = new Date("2023-06-15T10:30:00Z");

      seed.setCreationDate(date);
      expect(seed.creationDate()?.toISOString()).toBe("2023-06-15T10:30:00.000Z");

      seed.setCreationDate(undefined);
      expect(seed.creationDate()).toBeUndefined();
    });
  });
});
