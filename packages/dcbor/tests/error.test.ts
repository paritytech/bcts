/**
 * Error handling tests for dCBOR TypeScript implementation.
 *
 * Tests the CborError class and all error types defined in the Error union.
 */

import {
  CborError,
  type Error as CborErrorType,
  errorToString,
  errorMsg,
  Ok,
  Err,
  type Result,
} from "../src/error";
import { cbor, cborData } from "../src/cbor";
import { decodeCbor } from "../src/decode";
import { createTag } from "../src/tag";
import { CborMap } from "../src/map";

/** Helper to convert a hex string to a Uint8Array. */
function hexToBytes(hexStr: string): Uint8Array {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
  }
  return bytes;
}

describe("CborError", () => {
  describe("CborError class", () => {
    test("creates error with Custom type", () => {
      const error = new CborError({ type: "Custom", message: "Test error" });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CborError);
      expect(error.name).toBe("CborError");
      expect(error.message).toBe("Test error");
      expect(error.errorType.type).toBe("Custom");
    });

    test("creates error with default message from errorToString", () => {
      const error = new CborError({ type: "Underrun" });

      expect(error.message).toBe("early end of CBOR data");
      expect(error.errorType.type).toBe("Underrun");
    });

    test("has stack trace", () => {
      const error = new CborError({ type: "Custom", message: "Stack test" });

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("CborError");
    });

    test("isCborError type guard works", () => {
      const cborError = new CborError({ type: "Custom", message: "CBOR error" });
      const regularError = new Error("Regular error");

      expect(CborError.isCborError(cborError)).toBe(true);
      expect(CborError.isCborError(regularError)).toBe(false);
      expect(CborError.isCborError(null)).toBe(false);
      expect(CborError.isCborError(undefined)).toBe(false);
      expect(CborError.isCborError("not an error")).toBe(false);
    });
  });

  describe("Error types and messages", () => {
    test("Underrun error", () => {
      const error: CborErrorType = { type: "Underrun" };
      expect(errorToString(error)).toBe("early end of CBOR data");
    });

    test("UnsupportedHeaderValue error", () => {
      const error: CborErrorType = { type: "UnsupportedHeaderValue", value: 0xff };
      expect(errorToString(error)).toBe("unsupported value in CBOR header");
    });

    test("NonCanonicalNumeric error", () => {
      const error: CborErrorType = { type: "NonCanonicalNumeric" };
      expect(errorToString(error)).toBe("a CBOR numeric value was encoded in non-canonical form");
    });

    test("InvalidSimpleValue error", () => {
      const error: CborErrorType = { type: "InvalidSimpleValue" };
      expect(errorToString(error)).toBe("an invalid CBOR simple value was encountered");
    });

    test("InvalidString error", () => {
      const error: CborErrorType = { type: "InvalidString", message: "bad UTF-8" };
      expect(errorToString(error)).toBe(
        "an invalidly-encoded UTF-8 string was encountered in the CBOR (bad UTF-8)",
      );
    });

    test("NonCanonicalString error", () => {
      const error: CborErrorType = { type: "NonCanonicalString" };
      expect(errorToString(error)).toBe(
        "a CBOR string was not encoded in Unicode Canonical Normalization Form C",
      );
    });

    test("UnusedData error", () => {
      const error: CborErrorType = { type: "UnusedData", count: 5 };
      expect(errorToString(error)).toBe("the decoded CBOR had 5 extra bytes at the end");
    });

    test("MisorderedMapKey error", () => {
      const error: CborErrorType = { type: "MisorderedMapKey" };
      expect(errorToString(error)).toBe(
        "the decoded CBOR map has keys that are not in canonical order",
      );
    });

    test("DuplicateMapKey error", () => {
      const error: CborErrorType = { type: "DuplicateMapKey" };
      expect(errorToString(error)).toBe("the decoded CBOR map has a duplicate key");
    });

    test("MissingMapKey error", () => {
      const error: CborErrorType = { type: "MissingMapKey" };
      expect(errorToString(error)).toBe("missing CBOR map key");
    });

    test("OutOfRange error", () => {
      const error: CborErrorType = { type: "OutOfRange" };
      expect(errorToString(error)).toBe(
        "the CBOR numeric value could not be represented in the specified numeric type",
      );
    });

    test("WrongType error", () => {
      const error: CborErrorType = { type: "WrongType" };
      expect(errorToString(error)).toBe("the decoded CBOR value was not the expected type");
    });

    test("WrongTag error", () => {
      const tag1 = createTag(1, "tag1");
      const tag2 = createTag(2, "tag2");
      const error: CborErrorType = { type: "WrongTag", expected: tag1, actual: tag2 };
      expect(errorToString(error)).toContain("expected CBOR tag");
      expect(errorToString(error)).toContain("but got");
    });

    test("InvalidUtf8 error", () => {
      const error: CborErrorType = { type: "InvalidUtf8", message: "invalid byte sequence" };
      expect(errorToString(error)).toBe("invalid UTF‑8 string: invalid byte sequence");
    });

    test("InvalidDate error", () => {
      const error: CborErrorType = { type: "InvalidDate", message: "not a valid ISO 8601 date" };
      expect(errorToString(error)).toBe("invalid ISO 8601 date string: not a valid ISO 8601 date");
    });

    test("Custom error", () => {
      const error: CborErrorType = { type: "Custom", message: "Something went wrong" };
      expect(errorToString(error)).toBe("Something went wrong");
    });
  });

  describe("errorMsg helper", () => {
    test("creates Custom error with message", () => {
      const error = errorMsg("Test message");

      expect(error.type).toBe("Custom");
      if (error.type === "Custom") {
        expect(error.message).toBe("Test message");
      }
    });
  });

  describe("Result type", () => {
    test("Ok creates successful result", () => {
      const result: Result<number> = Ok(42);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    test("Err creates failed result", () => {
      const error: CborErrorType = { type: "Custom", message: "Failed" };
      const result: Result<number> = Err(error);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("Custom");
        if (result.error.type === "Custom") {
          expect(result.error.message).toBe("Failed");
        }
      }
    });
  });

  describe("Error handling in encoding", () => {
    test("throws CborError for unsupported type", () => {
      // Symbol is not supported by CborInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unsupported = Symbol("test") as any;

      expect(() => {
        cbor(unsupported);
      }).toThrow(CborError);

      try {
        cbor(unsupported);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("Custom");
          expect(e.message).toContain("Unsupported type");
        }
      }
    });

    test("throws CborError for functions", () => {
      const func = () => "test";

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cbor(func as any);
      }).toThrow(CborError);
    });
  });

  describe("Error handling in decoding", () => {
    test("throws CborError for truncated data (Underrun)", () => {
      // CBOR byte string header indicating 10 bytes, but only providing 2
      const truncated = new Uint8Array([0x4a, 0x01, 0x02]); // byte string of length 10, but only 2 bytes

      expect(() => {
        decodeCbor(truncated);
      }).toThrow(CborError);
    });

    test("throws CborError for extra data after CBOR (UnusedData)", () => {
      // Valid CBOR (integer 0) followed by extra bytes
      const withExtra = new Uint8Array([0x00, 0xff, 0xff]);

      expect(() => {
        decodeCbor(withExtra);
      }).toThrow(CborError);

      try {
        decodeCbor(withExtra);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("UnusedData");
        }
      }
    });

    test("throws CborError for non-canonical numeric encoding", () => {
      // Integer 23 encoded in 2 bytes instead of 1 (non-canonical)
      const nonCanonical = new Uint8Array([0x18, 0x17]); // Should be just 0x17

      expect(() => {
        decodeCbor(nonCanonical);
      }).toThrow(CborError);

      try {
        decodeCbor(nonCanonical);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("NonCanonicalNumeric");
        }
      }
    });

    // Regression for C3: a text string with invalid UTF-8 must be rejected
    // (Rust `str::from_utf8(buf)?`), not silently decoded to U+FFFD.
    test("throws InvalidUtf8 for invalid UTF-8 text strings (C3)", () => {
      // 0x62 = text(2), bytes 0xc3 0x28 are not valid UTF-8.
      const badUtf8 = new Uint8Array([0x62, 0xc3, 0x28]);
      expect(() => decodeCbor(badUtf8)).toThrow(CborError);
      try {
        decodeCbor(badUtf8);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("InvalidUtf8");
        }
      }
      // 0x61 = text(1), byte 0xff is invalid UTF-8.
      expect(() => decodeCbor(new Uint8Array([0x61, 0xff]))).toThrow(CborError);
    });

    test("accepts valid UTF-8 (incl. multibyte) text strings", () => {
      // "é" (U+00E9) NFC = 0xc3 0xa9; text(2).
      const ok = new Uint8Array([0x62, 0xc3, 0xa9]);
      const c = decodeCbor(ok);
      expect(c.type).toBe(3);
      expect(c.value).toBe("é");
    });

    // Regression for C4: a map whose keys are interleaved-misordered (a key
    // landing BETWEEN two existing keys) must be rejected. The earlier
    // single-prior-key setNext test masked this because SortedMap.max()
    // degenerated to the smallest key.
    test("throws MisorderedMapKey for interleaved-misordered map keys (C4)", () => {
      // a3  map(3)  01 01 (1:1)  03 03 (3:3)  02 02 (2:2)
      // The `2` key arrives after `3`, so it is out of canonical order.
      const interleaved = hexToBytes("a3010103030202");
      expect(() => decodeCbor(interleaved)).toThrow(CborError);
      try {
        decodeCbor(interleaved);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("MisorderedMapKey");
        }
      }
    });

    test("accepts a canonically-ordered 3-key map (C4 control)", () => {
      const ordered = hexToBytes("a3010102020303");
      const c = decodeCbor(ordered);
      expect(c.type).toBe(5);
    });

    // Regression for M3: a truncated inner item must surface as Underrun even
    // when the input is a sub-array of a larger ArrayBuffer (the decode
    // sub-view is now length-clamped, so it can't read into the trailing bytes
    // of the backing buffer).
    test("does not read past the logical end of a sub-array input (M3)", () => {
      // Backing buffer: 82 01 (array(2) missing its 2nd item) then junk ffff.
      const backing = hexToBytes("8201ffff");
      const logical = backing.subarray(0, 2); // only `82 01`
      expect(() => decodeCbor(logical)).toThrow(CborError);
      try {
        decodeCbor(logical);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("Underrun");
        }
      }
    });

    test("decodes a valid item that is a sub-array of a larger buffer (M3 control)", () => {
      const backing = hexToBytes("820102ffff"); // array(2)=[1,2] then junk
      const logical = backing.subarray(0, 3); // `82 01 02`
      const c = decodeCbor(logical);
      expect(c.type).toBe(4); // Array
    });
  });

  describe("Error handling in map operations", () => {
    test("throws CborError for missing map key", () => {
      const map = new CborMap();
      map.set("key1", "value1");

      expect(() => {
        map.extract("nonexistent");
      }).toThrow(CborError);

      try {
        map.extract("nonexistent");
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("MissingMapKey");
        }
      }
    });

    test("throws CborError for misordered map keys during decoding", () => {
      const map = new CborMap();
      map.set("aaa", 1);

      // Try to insert a key that's not in ascending order
      expect(() => {
        map.setNext("aaa", 2); // Duplicate
      }).toThrow(CborError);

      try {
        map.setNext("aaa", 2);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("DuplicateMapKey");
        }
      }
    });

    test("throws CborError for keys not in ascending order", () => {
      const map = new CborMap();
      map.set("bbb", 1);

      // Try to insert a key that comes before the last key
      expect(() => {
        map.setNext("aaa", 2); // Should come after 'bbb'
      }).toThrow(CborError);

      try {
        map.setNext("aaa", 2);
      } catch (e) {
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("MisorderedMapKey");
        }
      }
    });
  });

  describe("Error context preservation", () => {
    test("error retains original information when caught", () => {
      const originalMessage = "Original error context";
      const error = new CborError({ type: "Custom", message: originalMessage });

      try {
        throw error;
      } catch (e) {
        expect(CborError.isCborError(e)).toBe(true);
        if (CborError.isCborError(e)) {
          expect(e.message).toBe(originalMessage);
          expect(e.errorType.type).toBe("Custom");
          expect(e.stack).toBeDefined();
        }
      }
    });

    test("error provides useful debugging information", () => {
      const error = new CborError({
        type: "WrongTag",
        expected: createTag(1, "expected"),
        actual: createTag(2, "actual"),
      });

      expect(error.message).toContain("expected");
      expect(error.message).toContain("actual");
      expect(error.errorType.type).toBe("WrongTag");
    });
  });

  describe("Integration: error propagation", () => {
    test("encoding errors propagate correctly", () => {
      // Test with a function which is not supported
      const invalidValue = { fn: () => "test" };

      expect(() => {
        cbor(invalidValue);
      }).toThrow(CborError);

      try {
        cbor(invalidValue);
      } catch (e) {
        expect(CborError.isCborError(e)).toBe(true);
        if (CborError.isCborError(e)) {
          expect(e.errorType.type).toBe("Custom");
        }
      }
    });

    test("decoding errors preserve error information", () => {
      const invalidCbor = new Uint8Array([0xff]); // Invalid header

      expect(() => {
        decodeCbor(invalidCbor);
      }).toThrow(CborError);

      try {
        decodeCbor(invalidCbor);
      } catch (e) {
        expect(CborError.isCborError(e)).toBe(true);
        if (CborError.isCborError(e)) {
          // Should be UnsupportedHeaderValue or similar
          expect(e.errorType.type).toBeTruthy();
          expect(e.message).toBeTruthy();
        }
      }
    });
  });

  describe("Real-world error scenarios", () => {
    test("handles malformed CBOR gracefully", () => {
      const testCases = [
        { data: new Uint8Array([0x1f]), desc: "reserved additional info" },
        { data: new Uint8Array([0x5f]), desc: "indefinite length byte string" },
        { data: new Uint8Array([0x7f]), desc: "indefinite length text string" },
        { data: new Uint8Array([0x9f]), desc: "indefinite length array" },
        { data: new Uint8Array([0xbf]), desc: "indefinite length map" },
      ];

      for (const { data } of testCases) {
        expect(() => {
          decodeCbor(data);
        }).toThrow(CborError);
      }
    });

    test("provides clear error messages for common mistakes", () => {
      // undefined should work (converts to null)
      const encoded = cborData(undefined);
      expect(encoded).toBeDefined();

      // Symbol should fail (not a valid CBOR type)
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cbor(Symbol("test") as any);
      }).toThrow(CborError);

      // Function should fail
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cbor((() => {}) as any);
      }).toThrow(CborError);

      // Object with function property should fail when encoding the function
      expect(() => {
        cbor({ fn: () => "test" });
      }).toThrow(CborError);
    });
  });
});
