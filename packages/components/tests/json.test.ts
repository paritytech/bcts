/**
 * Tests for the JSON module
 * Ported from bc-components-rust/src/json.rs tests
 */

import { describe, it, expect } from "vitest";
import { JSON } from "../src/index.js";

describe("JSON", () => {
  describe("creation", () => {
    it("should create from string", () => {
      const json = JSON.fromString('{"key": "value"}');
      expect(json.asStr()).toBe('{"key": "value"}');
      expect(json.len()).toBe(16);
      expect(json.isEmpty()).toBe(false);
    });

    it("should create from bytes", () => {
      const data = new TextEncoder().encode("[1, 2, 3]");
      const json = JSON.fromData(data);
      expect(json.asBytes()).toEqual(data);
      expect(json.asStr()).toBe("[1, 2, 3]");
    });

    it("should handle empty JSON", () => {
      const json = JSON.fromString("");
      expect(json.isEmpty()).toBe(true);
      expect(json.len()).toBe(0);
    });
  });

  describe("hex encoding", () => {
    it("should convert to and from hex", () => {
      const json = JSON.fromString("test");
      const hex = json.hex();
      const json2 = JSON.fromHex(hex);
      expect(json.equals(json2)).toBe(true);
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through tagged CBOR", () => {
      const json = JSON.fromString('{"name":"Alice","age":30}');
      const cborData = json.taggedCborData();
      const json2 = JSON.fromTaggedCborData(cborData);
      expect(json.equals(json2)).toBe(true);
      expect(json2.asStr()).toBe('{"name":"Alice","age":30}');
    });

    it("should roundtrip through untagged CBOR", () => {
      const json = JSON.fromString('["array", "data"]');
      const cborData = json.untaggedCbor().toData();
      const json2 = JSON.fromUntaggedCborData(cborData);
      expect(json.equals(json2)).toBe(true);
    });
  });

  describe("equality", () => {
    it("should compare equal JSON objects", () => {
      const json1 = JSON.fromString('{"test": true}');
      const json2 = JSON.fromString('{"test": true}');
      expect(json1.equals(json2)).toBe(true);
    });

    it("should detect different JSON objects", () => {
      const json1 = JSON.fromString('{"test": true}');
      const json2 = JSON.fromString('{"test": false}');
      expect(json1.equals(json2)).toBe(false);
    });
  });

  describe("string representation", () => {
    it("should produce readable toString output", () => {
      const json = JSON.fromString('{"test":true}');
      const str = json.toString();
      expect(str).toBe('JSON({"test":true})');
    });
  });

  describe("data access", () => {
    it("should return copy of data", () => {
      const json = JSON.fromString("data");
      const bytes1 = json.toData();
      const bytes2 = json.toData();

      // Should be equal but different arrays
      expect(bytes1).toEqual(bytes2);
      expect(bytes1).not.toBe(bytes2);
    });
  });

  describe("complex JSON", () => {
    it("should handle nested objects", () => {
      const complex = JSON.fromString('{"outer":{"inner":"value","array":[1,2,3]}}');
      expect(complex.asStr()).toBe('{"outer":{"inner":"value","array":[1,2,3]}}');

      // Roundtrip through CBOR
      const cborData = complex.taggedCborData();
      const recovered = JSON.fromTaggedCborData(cborData);
      expect(recovered.equals(complex)).toBe(true);
    });

    it("should handle unicode", () => {
      const unicode = JSON.fromString('{"emoji":"🎉","japanese":"日本語"}');
      expect(unicode.asStr()).toBe('{"emoji":"🎉","japanese":"日本語"}');

      // Roundtrip through CBOR
      const cborData = unicode.taggedCborData();
      const recovered = JSON.fromTaggedCborData(cborData);
      expect(recovered.asStr()).toBe('{"emoji":"🎉","japanese":"日本語"}');
    });
  });
});
