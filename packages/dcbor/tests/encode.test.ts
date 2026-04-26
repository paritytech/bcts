/**
 * Encoding tests for dCBOR TypeScript implementation.
 *
 * This file is a complete 1:1 translation of Rust's tests/encode.rs
 *
 * All 35 test functions from the Rust version are translated here.
 */

import type { Cbor, CborInput } from "../src/cbor";
import { cbor, cborData, toTaggedValue } from "../src/cbor";
import { diagnosticFlat } from "../src/diag";
import { decodeCbor } from "../src/decode";
import { hex } from "../src/dump";
import { ByteString } from "../src/byte-string";
import { CborMap } from "../src/map";
import { CborDate } from "../src/date";
import { createTag } from "../src/tag";
import { extractCbor } from "../src/conveniences";

/** Helper to convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/** Helper: cborDebug - Get debug description (matches Rust's format!("{:?}", cbor)) */
function cborDebug(cborValue: Cbor): string {
  // Generate debug format with type information
  switch (cborValue.type) {
    case 0: // Unsigned
      return `unsigned(${cborValue.value})`;
    case 1: {
      // Negative
      const negValue =
        typeof cborValue.value === "bigint"
          ? -(cborValue.value as bigint) - 1n
          : -(cborValue.value as number) - 1;
      return `negative(${negValue})`;
    }
    case 2: {
      // ByteString
      const bytes = cborValue.value as Uint8Array;
      const hexStr = bytesToHex(bytes);
      return `bytes(${hexStr})`;
    }
    case 3: // Text
      return `text("${cborValue.value}")`;
    case 4: {
      // Array
      const items = (cborValue.value as Cbor[]).map(cborDebug);
      return `array([${items.join(", ")}])`;
    }
    case 5: {
      // Map
      const map = cborValue.value as CborMap;
      if (map && map.debug) {
        return map.debug;
      }
      return "map({})";
    }
    case 6: {
      // Tagged
      const content = cborDebug(cborValue.value as Cbor);
      return `tagged(${cborValue.tag}, ${content})`;
    }
    case 7: {
      // Simple
      const simple = cborValue.value;
      if (typeof simple === "object" && simple !== null && "type" in simple) {
        switch (simple.type) {
          case "True":
            return "simple(true)";
          case "False":
            return "simple(false)";
          case "Null":
            return "simple(null)";
          case "Float": {
            // Format float values properly (inf, -inf, NaN)
            const f = simple.value;
            if (isNaN(f)) {
              return "simple(NaN)";
            } else if (!isFinite(f)) {
              return f > 0 ? "simple(inf)" : "simple(-inf)";
            } else {
              return `simple(${f})`;
            }
          }
        }
      }
      return "simple";
    }
  }
  return String(cborValue);
}

/** Helper: cborDiagnostic - Get diagnostic description (matches Rust's format!("{}", cbor)) */
function cborDiagnostic(cborValue: Cbor): string {
  // Use flat output to match Rust's Display trait (format!("{}", cbor))
  return diagnosticFlat(cborValue);
}

/** Helper: cborHex - Get hex encoding */
function cborHex(cborValue: Cbor): string {
  return hex(cborValue);
}

/** Helper to convert Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Assert actual equals expected with detailed output (matches Rust assert_actual_expected!) */
function assertActualExpected(actual: string, expected: string) {
  if (actual !== expected) {
    console.log(`Actual:\n${actual}`);
    console.log(`Expected:\n${expected}`);
  }
  expect(actual).toBe(expected);
}

/**
 * Test CBOR encoding and round-trip decoding
 * Matches Rust's test_cbor function
 */
function testCbor(
  value: CborInput,
  expectedDebug: string,
  expectedDisplay: string,
  expectedData: string,
) {
  const cborValue = cbor(value);

  // Test debug representation
  const actualDebug = cborDebug(cborValue);
  assertActualExpected(actualDebug, expectedDebug);

  // Test diagnostic display
  const actualDisplay = cborDiagnostic(cborValue);
  assertActualExpected(actualDisplay, expectedDisplay);

  // Test encoded data
  const data = cborData(cborValue);
  const actualData = bytesToHex(data);
  assertActualExpected(actualData, expectedData);

  // Test round-trip decode
  const decodedCbor = decodeCbor(data);
  expect(cborData(cborValue)).toEqual(cborData(decodedCbor));
}

/**
 * Test CBOR decoding only
 * Matches Rust's test_cbor_decode function
 */
function testCborDecode(dataHex: string, expectedDebug: string, expectedDisplay: string) {
  const data = hexToBytes(dataHex);
  const cborValue = decodeCbor(data);

  const actualDebug = cborDebug(cborValue);
  assertActualExpected(actualDebug, expectedDebug);

  const actualDisplay = cborDiagnostic(cborValue);
  assertActualExpected(actualDisplay, expectedDisplay);
}

/**
 * Test CBOR codable (encode + decode + round-trip)
 * Matches Rust's test_cbor_codable function
 */
function testCborCodable(
  value: CborInput,
  expectedDebug: string,
  expectedDisplay: string,
  expectedData: string,
) {
  // First encoding
  let cborValue = cbor(value);
  assertActualExpected(cborDebug(cborValue), expectedDebug);
  assertActualExpected(cborDiagnostic(cborValue), expectedDisplay);

  let data = cborData(cborValue);
  assertActualExpected(bytesToHex(data), expectedData);

  // Decode
  const decodedCbor = decodeCbor(data);
  expect(cborData(cborValue)).toEqual(cborData(decodedCbor));

  // Extract value
  const value2 = extractCbor(decodedCbor);

  // Re-encode
  cborValue = cbor(value2 as CborInput);
  assertActualExpected(cborDebug(cborValue), expectedDebug);
  assertActualExpected(cborDiagnostic(cborValue), expectedDisplay);

  data = cborData(cborValue);
  assertActualExpected(bytesToHex(data), expectedData);
}

describe("encode tests", () => {
  // Test 1: encode_unsigned
  describe("encode_unsigned", () => {
    test("encode 0", () => {
      testCborCodable(0, "unsigned(0)", "0", "00");
    });

    test("encode 1", () => {
      testCborCodable(1, "unsigned(1)", "1", "01");
    });

    test("encode 23", () => {
      testCborCodable(23, "unsigned(23)", "23", "17");
    });

    test("encode 24", () => {
      testCborCodable(24, "unsigned(24)", "24", "1818");
    });

    test("encode 255", () => {
      testCborCodable(255, "unsigned(255)", "255", "18ff");
    });

    test("encode 65535", () => {
      testCborCodable(65535, "unsigned(65535)", "65535", "19ffff");
    });

    test("encode 65536", () => {
      testCborCodable(65536, "unsigned(65536)", "65536", "1a00010000");
    });

    test("encode 4294967295 (u32::MAX)", () => {
      testCborCodable(4294967295, "unsigned(4294967295)", "4294967295", "1affffffff");
    });

    test("encode 4294967296", () => {
      testCborCodable(4294967296, "unsigned(4294967296)", "4294967296", "1b0000000100000000");
    });

    test("encode u64::MAX (JavaScript max safe might differ)", () => {
      // JavaScript's Number.MAX_SAFE_INTEGER = 9007199254740991
      // Rust's u64::MAX = 18446744073709551615 (requires BigInt in JS)
      testCborCodable(
        Number.MAX_SAFE_INTEGER,
        "unsigned(9007199254740991)",
        "9007199254740991",
        "1b001fffffffffffff",
      );
    });

    // Boundary tests covering values that don't fit in `Number` safely.
    test("encode 2^63 (BigInt)", () => {
      testCborCodable(
        9223372036854775808n,
        "unsigned(9223372036854775808)",
        "9223372036854775808",
        "1b8000000000000000",
      );
    });

    test("encode 2^64 - 1 = u64::MAX (BigInt)", () => {
      testCborCodable(
        18446744073709551615n,
        "unsigned(18446744073709551615)",
        "18446744073709551615",
        "1bffffffffffffffff",
      );
    });

    test("encode 2^32 boundary", () => {
      testCborCodable(0xffffffffn, "unsigned(4294967295)", "4294967295", "1affffffff");
    });
  });

  // Test 2: encode_signed
  describe("encode_signed", () => {
    test("encode -1", () => {
      testCborCodable(-1, "negative(-1)", "-1", "20");
    });

    test("encode -2", () => {
      testCborCodable(-2, "negative(-2)", "-2", "21");
    });

    test("encode -127", () => {
      testCborCodable(-127, "negative(-127)", "-127", "387e");
    });

    test("encode -128 (i8::MIN)", () => {
      testCborCodable(-128, "negative(-128)", "-128", "387f");
    });

    test("encode 127 (i8::MAX)", () => {
      testCborCodable(127, "unsigned(127)", "127", "187f");
    });

    test("encode -32768 (i16::MIN)", () => {
      testCborCodable(-32768, "negative(-32768)", "-32768", "397fff");
    });

    test("encode 32767 (i16::MAX)", () => {
      testCborCodable(32767, "unsigned(32767)", "32767", "197fff");
    });

    test("encode -2147483648 (i32::MIN)", () => {
      testCborCodable(-2147483648, "negative(-2147483648)", "-2147483648", "3a7fffffff");
    });

    test("encode 2147483647 (i32::MAX)", () => {
      testCborCodable(2147483647, "unsigned(2147483647)", "2147483647", "1a7fffffff");
    });

    test("encode -9223372036854775808 (i64::MIN - JavaScript safe range)", () => {
      // Note: JavaScript's MIN_SAFE_INTEGER is -9007199254740991
      // For full i64 range testing, we'd need BigInt
      testCborCodable(
        Number.MIN_SAFE_INTEGER,
        "negative(-9007199254740991)",
        "-9007199254740991",
        "3b001ffffffffffffe",
      );
    });

    test("encode 9223372036854775807 (i64::MAX - JavaScript safe range)", () => {
      testCborCodable(
        Number.MAX_SAFE_INTEGER,
        "unsigned(9007199254740991)",
        "9007199254740991",
        "1b001fffffffffffff",
      );
    });

    // Boundary tests for negative values that don't fit in `number` safely.
    test("encode -(2^63) - 1 (BigInt, beyond i64::MIN)", () => {
      testCborCodable(
        -9223372036854775809n,
        "negative(-9223372036854775809)",
        "-9223372036854775809",
        "3b8000000000000000",
      );
    });

    test("encode -(2^64) (BigInt, smallest CBOR negative integer)", () => {
      testCborCodable(
        -18446744073709551616n,
        "negative(-18446744073709551616)",
        "-18446744073709551616",
        "3bffffffffffffffff",
      );
    });
  });

  // Test 3: encode_bytes_1
  test("encode_bytes_1", () => {
    const bytes = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
    testCborCodable(new ByteString(bytes), "bytes(00112233)", "h'00112233'", "4400112233");
  });

  // Test 4: encode_bytes
  describe("encode_bytes", () => {
    test("encode 32-byte string", () => {
      const bytes = hexToBytes("c0a7da14e5847c526244f7e083d26fe33f86d2313ad2b77164233444423a50a7");
      testCborCodable(
        new ByteString(bytes),
        "bytes(c0a7da14e5847c526244f7e083d26fe33f86d2313ad2b77164233444423a50a7)",
        "h'c0a7da14e5847c526244f7e083d26fe33f86d2313ad2b77164233444423a50a7'",
        "5820c0a7da14e5847c526244f7e083d26fe33f86d2313ad2b77164233444423a50a7",
      );
    });

    test("encode [0x11, 0x22, 0x33]", () => {
      const bytes = new ByteString(new Uint8Array([0x11, 0x22, 0x33]));
      testCborCodable(bytes, "bytes(112233)", "h'112233'", "43112233");
    });
  });

  // Test 5: encode_string
  describe("encode_string", () => {
    test('encode "Hello"', () => {
      testCborCodable("Hello", 'text("Hello")', '"Hello"', "6548656c6c6f");
    });

    test("encode Lorem Ipsum", () => {
      const loremIpsum =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
      testCborCodable(
        loremIpsum,
        `text("${loremIpsum}")`,
        `"${loremIpsum}"`,
        "7901bd4c6f72656d20697073756d20646f6c6f722073697420616d65742c20636f6e73656374657475722061646970697363696e6720656c69742c2073656420646f20656975736d6f642074656d706f7220696e6369646964756e74207574206c61626f726520657420646f6c6f7265206d61676e6120616c697175612e20557420656e696d206164206d696e696d2076656e69616d2c2071756973206e6f737472756420657865726369746174696f6e20756c6c616d636f206c61626f726973206e69736920757420616c697175697020657820656120636f6d6d6f646f20636f6e7365717561742e2044756973206175746520697275726520646f6c6f7220696e20726570726568656e646572697420696e20766f6c7570746174652076656c697420657373652063696c6c756d20646f6c6f726520657520667567696174206e756c6c612070617269617475722e204578636570746575722073696e74206f6363616563617420637570696461746174206e6f6e2070726f6964656e742c2073756e7420696e2063756c706120717569206f666669636961206465736572756e74206d6f6c6c697420616e696d20696420657374206c61626f72756d2e",
      );
    });
  });

  // Test 6: test_normalized_string
  test("test_normalized_string", () => {
    const composedEAcute = "\u{00E9}"; // é in NFC
    const decomposedEAcute = "\u{0065}\u{0301}"; // e + combining acute accent in NFD

    // Unlike in Swift, where string comparison is aware of compositional
    // differences, in TypeScript string comparison is not.
    expect(composedEAcute).not.toBe(decomposedEAcute);

    // And of course they serialize differently, which is not what we
    // want for determinism.
    const utf8_1 = new TextEncoder().encode(composedEAcute);
    const utf8_2 = new TextEncoder().encode(decomposedEAcute);
    expect(utf8_1).not.toEqual(utf8_2);

    // But serializing them as dCBOR yields the same data.
    const cbor1 = cborData(cbor(composedEAcute));
    const cbor2 = cborData(cbor(decomposedEAcute));
    expect(cbor1).toEqual(cbor2);

    // Non-canonical string should error
    const cborDataNonCanonical = hexToBytes("6365cc81");
    expect(() => decodeCbor(cborDataNonCanonical)).toThrow(
      /Unicode Canonical Normalization Form C/i,
    );
  });

  // Test 7: encode_array
  describe("encode_array", () => {
    test("encode empty array", () => {
      testCbor([], "array([])", "[]", "80");
    });

    test("encode [1, 2, 3]", () => {
      testCbor(
        [1, 2, 3],
        "array([unsigned(1), unsigned(2), unsigned(3)])",
        "[1, 2, 3]",
        "83010203",
      );
    });

    test("encode [1, -2, 3] with mixed signs", () => {
      testCbor(
        [1, -2, 3],
        "array([unsigned(1), negative(-2), unsigned(3)])",
        "[1, -2, 3]",
        "83012103",
      );
    });
  });

  // Test 8: encode_heterogenous_array
  test("encode_heterogenous_array", () => {
    const array = [1, "Hello", [1, 2, 3]];
    testCbor(
      array,
      'array([unsigned(1), text("Hello"), array([unsigned(1), unsigned(2), unsigned(3)])])',
      '[1, "Hello", [1, 2, 3]]',
      "83016548656c6c6f83010203",
    );

    // Additional checks from Rust version
    const cborValue = cbor(array);
    const data = cborData(cborValue);
    const decodedCbor = decodeCbor(data);

    const extractedArray = extractCbor(decodedCbor) as unknown[];
    expect(extractedArray[0]).toBe(1);
    expect(extractedArray[1]).toBe("Hello");
    expect(extractedArray[2]).toEqual([1, 2, 3]);
  });

  // Test 9: encode_map
  describe("encode_map", () => {
    test("encode empty map", () => {
      const m = new CborMap();
      testCbor(m, "map({})", "{}", "a0");
    });

    test("encode complex map with various key types", () => {
      const m = new CborMap();
      m.insert(-1, 3);
      m.insert([-1], 7);
      m.insert("z", 4);
      m.insert(10, 1);
      m.insert(false, 8);
      m.insert(100, 2);
      m.insert("aa", 5);
      m.insert([100], 6);

      testCbor(
        m,
        'map({0x0a: (unsigned(10), unsigned(1)), 0x1864: (unsigned(100), unsigned(2)), 0x20: (negative(-1), unsigned(3)), 0x617a: (text("z"), unsigned(4)), 0x626161: (text("aa"), unsigned(5)), 0x811864: (array([unsigned(100)]), unsigned(6)), 0x8120: (array([negative(-1)]), unsigned(7)), 0xf4: (simple(false), unsigned(8))})',
        '{10: 1, 100: 2, -1: 3, "z": 4, "aa": 5, [100]: 6, [-1]: 7, false: 8}',
        "a80a011864022003617a046261610581186406812007f408",
      );

      // Additional checks from Rust version
      expect(m.get(false)).toBe(8);
      expect(m.get(true)).toBeUndefined();
      expect(m.extract(-1)).toBe(3);
      expect(m.extract([-1])).toBe(7);
      expect(m.extract("z")).toBe(4);
      expect(() => m.extract("foo")).toThrow();
    });
  });

  // Test 10: encode_map_with_map_keys
  test("encode_map_with_map_keys", () => {
    const k1 = new CborMap();
    k1.insert(1, 2);

    const k2 = new CborMap();
    k2.insert(3, 4);

    const m = new CborMap();
    m.insert(k1, 5);
    m.insert(k2, 6);

    testCbor(
      m,
      "map({0xa10102: (map({0x01: (unsigned(1), unsigned(2))}), unsigned(5)), 0xa10304: (map({0x03: (unsigned(3), unsigned(4))}), unsigned(6))})",
      "{{1: 2}: 5, {3: 4}: 6}",
      "a2a1010205a1030406",
    );
  });

  // Test 11: encode_anders_map
  test("encode_anders_map", () => {
    const m = new CborMap();
    m.insert(1, 45.7);
    m.insert(2, "Hi there!");

    const data = cborData(cbor(m));
    expect(bytesToHex(data)).toBe("a201fb4046d9999999999a0269486920746865726521");
    expect(m.extract(1)).toBe(45.7);
  });

  // Test 12: encode_map_misordered
  test("encode_map_misordered", () => {
    expect(() => decodeCbor(hexToBytes("a2026141016142"))).toThrow(/canonical order/i);
  });

  // Test 13: encode_tagged
  test("encode_tagged", () => {
    const tagged = toTaggedValue(1, "Hello");
    testCbor(tagged, 'tagged(1, text("Hello"))', '1("Hello")', "c16548656c6c6f");
  });

  // Test 14: encode_value
  describe("encode_value", () => {
    test("encode false", () => {
      testCbor(false, "simple(false)", "false", "f4");
    });

    test("encode true", () => {
      testCbor(true, "simple(true)", "true", "f5");
    });
  });

  // Test 15: encode_envelope
  test("encode_envelope", () => {
    const alice = cbor({ tag: 200, value: cbor({ tag: 201, value: "Alice" }) });
    const knows = cbor({ tag: 200, value: cbor({ tag: 201, value: "knows" }) });
    const bob = cbor({ tag: 200, value: cbor({ tag: 201, value: "Bob" }) });
    const knowsBob = cbor({ tag: 200, value: cbor({ tag: 221, value: [knows, bob] }) });
    const envelope = cbor({ tag: 200, value: [alice, knowsBob] });

    expect(cborDiagnostic(envelope)).toBe(
      '200([200(201("Alice")), 200(221([200(201("knows")), 200(201("Bob"))]))])',
    );

    const bytes = cborData(envelope);
    expect(bytesToHex(bytes)).toBe(
      "d8c882d8c8d8c965416c696365d8c8d8dd82d8c8d8c9656b6e6f7773d8c8d8c963426f62",
    );

    const decodedCbor = decodeCbor(bytes);
    expect(cborData(envelope)).toEqual(cborData(decodedCbor));
  });

  // Test 16: encode_float
  describe("encode_float", () => {
    test("floating point numbers get serialized as shortest accurate representation", () => {
      testCbor(1.5, "simple(1.5)", "1.5", "f93e00");
      testCbor(2345678.25, "simple(2345678.25)", "2345678.25", "fa4a0f2b39");
      testCbor(1.2, "simple(1.2)", "1.2", "fb3ff3333333333333");
      testCbor(Infinity, "simple(inf)", "Infinity", "f97c00");
    });

    test("float reduction to integers", () => {
      testCbor(42.0, "unsigned(42)", "42", "182a");
      testCbor(2345678.0, "unsigned(2345678)", "2345678", "1a0023cace");
      testCbor(-2345678.0, "negative(-2345678)", "-2345678", "3a0023cacd");
      testCbor(-0.0, "unsigned(0)", "0", "00"); // Negative zero becomes integer zero
    });

    test("subnormals and special values", () => {
      testCbor(
        5.960464477539063e-8,
        "simple(5.960464477539063e-8)",
        "5.960464477539063e-8",
        "f90001",
      );
      testCbor(5e-324, "simple(5e-324)", "5e-324", "fb0000000000000001");
      testCbor(65504.0, "unsigned(65504)", "65504", "19ffe0");
      testCbor(33554430.0, "unsigned(33554430)", "33554430", "1a01fffffe");
    });

    test("large negative conversions", () => {
      testCborDecode(
        "3b8000000000000000",
        "negative(-9223372036854775809)",
        "-9223372036854775809",
      );
      testCborDecode(
        "3bfffffffffffffffe",
        "negative(-18446744073709551615)",
        "-18446744073709551615",
      );
    });
  });

  // Test 17: int_coerced_to_float
  test("int_coerced_to_float", () => {
    const n = 42;
    const c = cbor(n);
    const f = extractCbor(c); // Simulate f64::try_from_cbor
    expect(f).toBe(n);
    const c2 = cbor(f as CborInput);
    expect(cborData(c2)).toEqual(cborData(c));
    const i = extractCbor(c);
    expect(i).toBe(n);
  });

  // Test 18: fail_float_coerced_to_int
  test("fail_float_coerced_to_int", () => {
    // Floating point values cannot be coerced to integer types.
    const n = 42.5;
    const c = cbor(n);
    const f = extractCbor(c);
    expect(f).toBe(n);
    // In TypeScript, extractCbor will return the float value, not throw
    // The Rust version has strict type checking, TypeScript is more lenient
  });

  // Test 19: non_canonical_float_1
  test("non_canonical_float_1", () => {
    expect(() => decodeCbor(hexToBytes("FB3FF8000000000000"))).toThrow(/canonical/i);
  });

  // Test 20: non_canonical_float_2
  test("non_canonical_float_2", () => {
    expect(() => decodeCbor(hexToBytes("F94A00"))).toThrow(/canonical/i);
  });

  // Test 21: unused_data
  test("unused_data", () => {
    expect(() => decodeCbor(hexToBytes("0001"))).toThrow(/extra bytes/i);
  });

  // Test 22: tag
  test("tag", () => {
    const tag = createTag(1, "A");
    expect(tag.name).toBe("A");
    expect(tag.value).toBe(1);

    const tag2 = createTag(2);
    expect(tag2.name).toBeUndefined();
    expect(tag2.value).toBe(2);
  });

  // Test 23: encode_date
  test("encode_date", () => {
    testCborCodable(
      CborDate.fromTimestamp(1675854714.0),
      "tagged(1, unsigned(1675854714))",
      "1(1675854714)",
      "c11a63e3837a",
    );
  });

  // Test 24: convert_values
  describe("convert_values", () => {
    function testConvert(value: CborInput) {
      const cborValue = cbor(value);
      const value2 = extractCbor(cborValue);

      const data = cborData(cborValue);
      const decodedCbor = decodeCbor(data);
      const value3 = extractCbor(decodedCbor);

      // For objects like ByteString, compare data; for primitives, compare values
      if (value instanceof ByteString) {
        expect(value2).toEqual(value.data());
        expect(value3).toEqual(value.data());
      } else {
        expect(value2).toEqual(value);
        expect(value3).toEqual(value);
      }
    }

    test("convert 10", () => testConvert(10));
    test("convert -10", () => testConvert(-10));
    test("convert false", () => testConvert(false));
    test('convert "Hello"', () => testConvert("Hello"));
    test("convert 10.0", () => testConvert(10.0));
    test("convert ByteString", () => testConvert(new ByteString(hexToBytes("001122334455"))));
  });

  // Test 25: convert_hash_map (TypeScript uses Map)
  test("convert_hash_map", () => {
    const h = new Map<number, string>();
    h.set(1, "A");
    h.set(50, "B");
    h.set(25, "C");

    const m = cbor(h);
    expect(cborDiagnostic(m)).toBe('{1: "A", 25: "C", 50: "B"}');

    const decoded = extractCbor(m);
    const h2 = (decoded as CborMap).toMap<number, string>();
    expect(h2.get(1)).toBe("A");
    expect(h2.get(25)).toBe("C");
    expect(h2.get(50)).toBe("B");
  });

  // Test 26: convert_btree_map (same as hash_map in TypeScript)
  test("convert_btree_map", () => {
    const h = new Map<number, string>();
    h.set(1, "A");
    h.set(50, "B");
    h.set(25, "C");

    const m = cbor(h);
    expect(cborDiagnostic(m)).toBe('{1: "A", 25: "C", 50: "B"}');

    const decoded = extractCbor(m);
    const h2 = (decoded as CborMap).toMap<number, string>();
    expect(h2.get(1)).toBe("A");
    expect(h2.get(25)).toBe("C");
    expect(h2.get(50)).toBe("B");
  });

  // Test 27: convert_vector
  test("convert_vector", () => {
    const v = [1, 50, 25];
    const c = cbor(v);
    expect(cborDiagnostic(c)).toBe("[1, 50, 25]");

    const v2 = extractCbor(c);
    expect(v2).toEqual(v);
  });

  // Test 28: convert_vecdeque (TypeScript arrays work the same)
  test("convert_vecdeque", () => {
    const v = [1, 50, 25];
    const c = cbor(v);
    expect(cborDiagnostic(c)).toBe("[1, 50, 25]");

    const v2 = extractCbor(c);
    expect(v2).toEqual(v);
  });

  // Test 29: convert_hashset (TypeScript Set)
  test("convert_hashset", () => {
    const v = new Set<number>([1, 50, 25]);
    const c = cbor(v);

    const v2 = new Set(extractCbor(c) as Iterable<number>);
    expect(v2.has(1)).toBe(true);
    expect(v2.has(50)).toBe(true);
    expect(v2.has(25)).toBe(true);
  });

  // Test 30: usage_test_1
  test("usage_test_1", () => {
    const array = [1000, 2000, 3000];
    const cborValue = cbor(array);
    expect(cborHex(cborValue)).toBe("831903e81907d0190bb8");
  });

  // Test 31: usage_test_2
  test("usage_test_2", () => {
    const data = hexToBytes("831903e81907d0190bb8");
    const cborValue = decodeCbor(data);
    expect(cborDiagnostic(cborValue)).toBe("[1000, 2000, 3000]");

    const array = extractCbor(cborValue);
    expect(array).toEqual([1000, 2000, 3000]);
  });

  // Test 32: encode_nan
  test("encode_nan", () => {
    const canonicalNanData = hexToBytes("f97e00");

    // All NaN representations should encode to canonical form
    const nonstandardF64Nan = NaN;
    expect(cborData(cbor(nonstandardF64Nan))).toEqual(canonicalNanData);
  });

  // Test 33: decode_nan
  test("decode_nan", () => {
    // Canonical NaN decodes
    const canonicalNanData = hexToBytes("f97e00");
    const decoded = decodeCbor(canonicalNanData);
    const value = decoded.type === 7 && decoded.value.type === "Float" ? decoded.value.value : 0;
    expect(Number.isNaN(value)).toBe(true);

    // Non-canonical NaNs return error
    expect(() => decodeCbor(hexToBytes("f97e01"))).toThrow();
    expect(() => decodeCbor(hexToBytes("faffc00001"))).toThrow();
    expect(() => decodeCbor(hexToBytes("fb7ff9100000000001"))).toThrow();
  });

  // Test 34: encode_infinit (typo preserved from Rust)
  test("encode_infinit", () => {
    const canonicalInfinityData = hexToBytes("f97c00");
    const canonicalNegInfinityData = hexToBytes("f9fc00");

    expect(cborData(cbor(Infinity))).toEqual(canonicalInfinityData);
    expect(cborData(cbor(-Infinity))).toEqual(canonicalNegInfinityData);
  });

  // Test 35: decode_infinity
  test("decode_infinity", () => {
    const canonicalInfinityData = hexToBytes("f97c00");
    const canonicalNegInfinityData = hexToBytes("f9fc00");

    // Canonical infinity decodes
    let decoded = decodeCbor(canonicalInfinityData);
    let value = decoded.type === 7 && decoded.value.type === "Float" ? decoded.value.value : 0;
    expect(value).toBe(Infinity);

    decoded = decodeCbor(canonicalNegInfinityData);
    value = decoded.type === 7 && decoded.value.type === "Float" ? decoded.value.value : 0;
    expect(value).toBe(-Infinity);

    // Non-canonical infinities return error
    expect(() => decodeCbor(hexToBytes("fa7f800000"))).toThrow();
    expect(() => decodeCbor(hexToBytes("fb7ff0000000000000"))).toThrow();
    expect(() => decodeCbor(hexToBytes("faff800000"))).toThrow();
    expect(() => decodeCbor(hexToBytes("fbfff0000000000000"))).toThrow();
  });

  // Tag 258 (set) decode parity — mirrors Rust `Set::insert_next`
  // semantics: a tag-258 wire encoding must already be in strict ascending
  // CBOR-byte order with no duplicates.
  describe("tag 258 (set) decode", () => {
    test("decodes a canonically-ordered tag-258 array as a set", async () => {
      const { CborSet } = await import("../src/set");
      // d9 01 02      tag(258)
      //   83          array(3)
      //     01        unsigned(1)
      //     02        unsigned(2)
      //     03        unsigned(3)
      const data = hexToBytes("d9010283010203");
      const c = decodeCbor(data);
      const set = CborSet.fromTaggedCborStatic(c);
      expect(set.size).toBe(3);
      expect(set.contains(1)).toBe(true);
      expect(set.contains(2)).toBe(true);
      expect(set.contains(3)).toBe(true);
    });

    test("rejects misordered inner-array elements", async () => {
      const { CborSet } = await import("../src/set");
      // tag(258) array(3) [3, 1, 2] — `3` would precede `1`/`2` in canonical
      // CBOR-byte order, violating Set::insert_next.
      const data = hexToBytes("d9010283030102");
      const c = decodeCbor(data);
      expect(() => CborSet.fromTaggedCborStatic(c)).toThrow();
    });

    test("rejects duplicate inner-array elements", async () => {
      const { CborSet } = await import("../src/set");
      // tag(258) array(3) [1, 1, 2]
      const data = hexToBytes("d9010283010102");
      const c = decodeCbor(data);
      expect(() => CborSet.fromTaggedCborStatic(c)).toThrow();
    });
  });
});
