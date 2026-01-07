import {
  serialize2Bytes,
  deserialize2Bytes,
  serialize4Bytes,
  deserialize4Bytes,
  serialize6Bytes,
  deserialize6Bytes,
} from "../src";

// Helper to convert bytes to hex
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper to convert hex to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

describe("date serialization", () => {
  describe("2-byte serialization", () => {
    it("should serialize and deserialize 2023-06-20", () => {
      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const bytes = serialize2Bytes(date);
      expect(bytes.length).toBe(2);

      const restored = deserialize2Bytes(bytes);
      expect(restored.getUTCFullYear()).toBe(2023);
      expect(restored.getUTCMonth()).toBe(5); // June (0-indexed)
      expect(restored.getUTCDate()).toBe(20);
    });

    it("should handle year boundaries", () => {
      const minDate = new Date(Date.UTC(2023, 0, 1, 0, 0, 0, 0));
      const bytes1 = serialize2Bytes(minDate);
      const restored1 = deserialize2Bytes(bytes1);
      expect(restored1.getUTCFullYear()).toBe(2023);

      const maxDate = new Date(Date.UTC(2150, 11, 31, 0, 0, 0, 0));
      const bytes2 = serialize2Bytes(maxDate);
      const restored2 = deserialize2Bytes(bytes2);
      expect(restored2.getUTCFullYear()).toBe(2150);
    });

    it("should throw for year out of range", () => {
      const tooEarly = new Date(Date.UTC(2022, 5, 20, 0, 0, 0, 0));
      expect(() => serialize2Bytes(tooEarly)).toThrow();

      const tooLate = new Date(Date.UTC(2151, 5, 20, 0, 0, 0, 0));
      expect(() => serialize2Bytes(tooLate)).toThrow();
    });
  });

  describe("4-byte serialization", () => {
    it("should serialize and deserialize dates as seconds since 2001-01-01", () => {
      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const bytes = serialize4Bytes(date);
      expect(bytes.length).toBe(4);

      const restored = deserialize4Bytes(bytes);
      // 4-byte serialization has second precision
      expect(restored.getTime()).toBe(date.getTime());
    });

    it("should handle reference date", () => {
      const refDate = new Date(Date.UTC(2001, 0, 1, 0, 0, 0, 0));
      const bytes = serialize4Bytes(refDate);
      expect(bytes).toEqual(new Uint8Array([0, 0, 0, 0]));

      const restored = deserialize4Bytes(bytes);
      expect(restored.getTime()).toBe(refDate.getTime());
    });
  });

  describe("6-byte serialization", () => {
    it("should serialize and deserialize dates with millisecond precision", () => {
      const date = new Date(Date.UTC(2023, 5, 20, 12, 30, 45, 123));
      const bytes = serialize6Bytes(date);
      expect(bytes.length).toBe(6);

      const restored = deserialize6Bytes(bytes);
      expect(restored.getTime()).toBe(date.getTime());
    });

    it("should handle reference date", () => {
      const refDate = new Date(Date.UTC(2001, 0, 1, 0, 0, 0, 0));
      const bytes = serialize6Bytes(refDate);
      expect(bytes).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0]));

      const restored = deserialize6Bytes(bytes);
      expect(restored.getTime()).toBe(refDate.getTime());
    });
  });

  // ===========================================================================
  // Rust Parity Tests (hex verification from date.rs)
  // ===========================================================================

  describe("test_2_byte_dates (Rust parity)", () => {
    it("should serialize 2023-06-20 to '00d4'", () => {
      // Rust: assert_eq!(hex::encode(serialized), "00d4");
      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const serialized = serialize2Bytes(date);
      expect(bytesToHex(serialized)).toBe("00d4");

      // Roundtrip
      const deserialized = deserialize2Bytes(serialized);
      expect(deserialized.getUTCFullYear()).toBe(2023);
      expect(deserialized.getUTCMonth()).toBe(5);
      expect(deserialized.getUTCDate()).toBe(20);
    });

    it("should deserialize minimum date '0021' to 2023-01-01", () => {
      // Rust: let min_serialized = [0x00, 0x21];
      const minSerialized = hexToBytes("0021");
      const minDate = deserialize2Bytes(minSerialized);
      expect(minDate.getUTCFullYear()).toBe(2023);
      expect(minDate.getUTCMonth()).toBe(0); // January
      expect(minDate.getUTCDate()).toBe(1);
    });

    it("should deserialize maximum date 'ff9f' to 2150-12-31", () => {
      // Rust: let max_serialized = [0xff, 0x9f];
      const maxSerialized = hexToBytes("ff9f");
      const maxDate = deserialize2Bytes(maxSerialized);
      expect(maxDate.getUTCFullYear()).toBe(2150);
      expect(maxDate.getUTCMonth()).toBe(11); // December
      expect(maxDate.getUTCDate()).toBe(31);
    });

    it("should fail to deserialize invalid date '005e' (2023-02-30)", () => {
      // Rust: assert!(Date::deserialize_2_bytes(&invalid_serialized).is_err());
      const invalidSerialized = hexToBytes("005e");
      expect(() => deserialize2Bytes(invalidSerialized)).toThrow();
    });
  });

  describe("test_4_byte_dates (Rust parity)", () => {
    it("should serialize 2023-06-20T12:34:56Z to '2a41d470'", () => {
      // Rust: assert_eq!(serialized, hex!("2a41d470"));
      const date = new Date(Date.UTC(2023, 5, 20, 12, 34, 56, 0));
      const serialized = serialize4Bytes(date);
      expect(bytesToHex(serialized)).toBe("2a41d470");

      // Roundtrip
      const deserialized = deserialize4Bytes(serialized);
      expect(deserialized.getTime()).toBe(date.getTime());
    });

    it("should deserialize minimum date '00000000' to 2001-01-01T00:00:00Z", () => {
      // Rust: let min_serialized = hex!("00000000");
      const minSerialized = hexToBytes("00000000");
      const minDate = deserialize4Bytes(minSerialized);
      expect(minDate.getUTCFullYear()).toBe(2001);
      expect(minDate.getUTCMonth()).toBe(0);
      expect(minDate.getUTCDate()).toBe(1);
      expect(minDate.getUTCHours()).toBe(0);
      expect(minDate.getUTCMinutes()).toBe(0);
      expect(minDate.getUTCSeconds()).toBe(0);
    });

    it("should deserialize maximum date 'ffffffff' to 2137-02-07T06:28:15Z", () => {
      // Rust: let max_serialized = hex!("ffffffff");
      const maxSerialized = hexToBytes("ffffffff");
      const maxDate = deserialize4Bytes(maxSerialized);
      expect(maxDate.getUTCFullYear()).toBe(2137);
      expect(maxDate.getUTCMonth()).toBe(1); // February
      expect(maxDate.getUTCDate()).toBe(7);
      expect(maxDate.getUTCHours()).toBe(6);
      expect(maxDate.getUTCMinutes()).toBe(28);
      expect(maxDate.getUTCSeconds()).toBe(15);
    });
  });

  describe("test_6_byte_dates (Rust parity)", () => {
    it("should serialize 2023-06-20T12:34:56.789Z to '00a51125d895'", () => {
      // Rust: assert_eq!(serialized, hex!("00a51125d895"));
      const date = new Date(Date.UTC(2023, 5, 20, 12, 34, 56, 789));
      const serialized = serialize6Bytes(date);
      expect(bytesToHex(serialized)).toBe("00a51125d895");

      // Roundtrip
      const deserialized = deserialize6Bytes(serialized);
      expect(deserialized.getTime()).toBe(date.getTime());
    });

    it("should deserialize minimum date '000000000000' to 2001-01-01T00:00:00.000Z", () => {
      // Rust: let min_serialized = hex!("000000000000");
      const minSerialized = hexToBytes("000000000000");
      const minDate = deserialize6Bytes(minSerialized);
      expect(minDate.getUTCFullYear()).toBe(2001);
      expect(minDate.getUTCMonth()).toBe(0);
      expect(minDate.getUTCDate()).toBe(1);
      expect(minDate.getUTCHours()).toBe(0);
      expect(minDate.getUTCMinutes()).toBe(0);
      expect(minDate.getUTCSeconds()).toBe(0);
      expect(minDate.getUTCMilliseconds()).toBe(0);
    });

    it("should deserialize maximum date 'e5940a78a7ff' to 9999-12-31T23:59:59.999Z", () => {
      // Rust: let max_serialized = hex!("e5940a78a7ff");
      const maxSerialized = hexToBytes("e5940a78a7ff");
      const maxDate = deserialize6Bytes(maxSerialized);
      expect(maxDate.getUTCFullYear()).toBe(9999);
      expect(maxDate.getUTCMonth()).toBe(11); // December
      expect(maxDate.getUTCDate()).toBe(31);
      expect(maxDate.getUTCHours()).toBe(23);
      expect(maxDate.getUTCMinutes()).toBe(59);
      expect(maxDate.getUTCSeconds()).toBe(59);
      expect(maxDate.getUTCMilliseconds()).toBe(999);
    });

    it("should fail to deserialize invalid date 'e5940a78a800'", () => {
      // Rust: assert!(Date::deserialize_6_bytes(&invalid_serialized).is_err());
      const invalidSerialized = hexToBytes("e5940a78a800");
      expect(() => deserialize6Bytes(invalidSerialized)).toThrow();
    });
  });
});
