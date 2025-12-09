/**
 * Tests for URI class
 *
 * Ported from bc-components-rust/src/id/uri.rs
 */

import { describe, it, expect } from "vitest";
import { URI } from "../src/id/uri.js";

describe("URI", () => {
  const TEST_URI = "https://example.com/path/to/resource";
  const TEST_URI_WITH_QUERY = "https://example.com/path?query=value&foo=bar";

  describe("creation", () => {
    it("should create a URI from valid URL string", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.toString()).toBe(TEST_URI);
    });

    it("should throw on invalid URI", () => {
      expect(() => URI.new("not a valid uri")).toThrow();
    });

    it("should create a URI using from (legacy alias)", () => {
      const uri = URI.from(TEST_URI);

      expect(uri.toString()).toBe(TEST_URI);
    });

    it("should create a URI using parse", () => {
      const uri = URI.parse(TEST_URI);

      expect(uri.toString()).toBe(TEST_URI);
    });
  });

  describe("accessors", () => {
    it("should return string representation", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.toString()).toBe(TEST_URI);
      expect(uri.toURI()).toBe(TEST_URI);
      expect(uri.getRaw()).toBe(TEST_URI);
      expect(uri.asRef()).toBe(TEST_URI);
    });

    it("should return scheme", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.scheme()).toBe("https");
    });

    it("should return path", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.path()).toBe("/path/to/resource");
    });

    it("should return length", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.length()).toBe(TEST_URI.length);
    });

    it("should return base64 representation", () => {
      const uri = URI.new(TEST_URI);

      expect(typeof uri.toBase64()).toBe("string");
    });
  });

  describe("URI type checks", () => {
    it("should detect absolute URI", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.isAbsolute()).toBe(true);
      expect(uri.isRelative()).toBe(false);
    });

    it("should check prefix", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.startsWith("https://")).toBe(true);
      expect(uri.startsWith("http://")).toBe(false);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const uri = URI.new(TEST_URI);

      expect(uri.equals(uri)).toBe(true);
    });

    it("should be equal to another URI with the same string", () => {
      const uri1 = URI.new(TEST_URI);
      const uri2 = URI.new(TEST_URI);

      expect(uri1.equals(uri2)).toBe(true);
    });

    it("should not be equal to a URI with different string", () => {
      const uri1 = URI.new(TEST_URI);
      const uri2 = URI.new("https://example.com/different");

      expect(uri1.equals(uri2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const uri = URI.new(TEST_URI);
      const tags = uri.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(32); // Standard URI tag
    });

    it("should serialize to untagged CBOR", () => {
      const uri = URI.new(TEST_URI);
      const untagged = uri.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const uri = URI.new(TEST_URI);
      const tagged = uri.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const uri = URI.new(TEST_URI);
      const data = uri.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const uri = URI.new(TEST_URI);
      const data = uri.taggedCborData();
      const restored = URI.fromTaggedCborData(data);

      expect(restored.equals(uri)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const uri = URI.new(TEST_URI);
      const data = uri.untaggedCbor().toData();
      const restored = URI.fromUntaggedCborData(data);

      expect(restored.equals(uri)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const uri = URI.new(TEST_URI);
      const ur = uri.ur();

      expect(ur).toBeDefined();
    });

    it("should serialize to UR string", () => {
      const uri = URI.new(TEST_URI);
      const urString = uri.urString();

      expect(urString.startsWith("ur:url/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const uri = URI.new(TEST_URI);
      const urString = uri.urString();
      const restored = URI.fromURString(urString);

      expect(restored.equals(uri)).toBe(true);
    });

    it("should roundtrip URI with query parameters", () => {
      const uri = URI.new(TEST_URI_WITH_QUERY);
      const urString = uri.urString();
      const restored = URI.fromURString(urString);

      expect(restored.equals(uri)).toBe(true);
      expect(restored.toString()).toBe(TEST_URI_WITH_QUERY);
    });

    it("should throw on invalid UR type", () => {
      const invalidUr = "ur:not_url/invalid";

      expect(() => URI.fromURString(invalidUr)).toThrow();
    });
  });
});
