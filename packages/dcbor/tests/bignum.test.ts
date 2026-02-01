/**
 * Tests for CBOR bignum (tags 2 and 3) support.
 *
 * This file is a complete 1:1 translation of Rust's tests/num_bigint.rs.
 * All 57 unique test cases from the Rust version are translated here.
 */

import { describe, it, expect } from "vitest";
import {
  biguintToCbor,
  bigintToCbor,
  cborToBiguint,
  cborToBigint,
  registerTags,
  toTaggedValue,
  cbor,
  Cbor,
  CborError,
  bytesToHex,
  diagnosticOpt,
  type DiagFormatOpts,
} from "../src";

// ============================================================================
// RFC 8949 Appendix A test vectors
// These are the exact test vectors from the RFC specification.
// ============================================================================

describe("RFC 8949 Appendix A test vectors", () => {
  // RFC 8949 Appendix A: 18446744073709551616 (2^64) = 0xc249010000000000000000
  it("rfc8949 test vector 2^64", () => {
    const expectedHex = "c249010000000000000000";
    // 2^64 = 18446744073709551616
    const expectedValue = (1n << 64n);

    // Encoding test
    const encoded = biguintToCbor(expectedValue);
    expect(bytesToHex(encoded.toData())).toBe(expectedHex);

    // Decoding test
    const decodedCbor = Cbor.tryFromHex(expectedHex);
    const decoded = cborToBiguint(decodedCbor);
    expect(decoded).toBe(expectedValue);
  });

  // RFC 8949 Appendix A: -18446744073709551617 (-2^64 - 1) = 0xc349010000000000000000
  it("rfc8949 test vector -(2^64+1)", () => {
    const expectedHex = "c349010000000000000000";
    const big2_64 = 1n << 64n;
    const expectedValue = -(big2_64 + 1n);

    // Encoding test
    const encoded = bigintToCbor(expectedValue);
    expect(bytesToHex(encoded.toData())).toBe(expectedHex);

    // Decoding test
    const decodedCbor = Cbor.tryFromHex(expectedHex);
    const decoded = cborToBigint(decodedCbor);
    expect(decoded).toBe(expectedValue);
  });

  // RFC 8949 §3.4.3 example: The number 18446744073709551616 (2^64)
  // "is represented as 0b110_00010 (major type 6, tag number 2), followed by
  // 0b010_01001 (major type 2, length 9), followed by 0x010000000000000000"
  it("rfc8949 example bignum encoding", () => {
    const value = 1n << 64n;
    const encoded = biguintToCbor(value);
    const bytes = encoded.toData();

    // 0xc2 = 0b110_00010 = major type 6 (tag), tag number 2
    expect(bytes[0]).toBe(0xc2);
    // 0x49 = 0b010_01001 = major type 2 (byte string), length 9
    expect(bytes[1]).toBe(0x49);
    // 0x010000000000000000 = 9 bytes of content
    expect(Array.from(bytes.slice(2))).toEqual([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  });
});

// ============================================================================
// Round-trip tests for BigUint
// ============================================================================

describe("BigUint round-trip tests", () => {
  it("biguint roundtrip zero", () => {
    const big = 0n;
    const encoded = biguintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'')");
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(big);
  });

  it("biguint roundtrip one", () => {
    const big = 1n;
    const encoded = biguintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'01')");
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(big);
  });

  it("biguint roundtrip 255", () => {
    const big = 255n;
    const encoded = biguintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'ff')");
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(big);
  });

  it("biguint roundtrip 256", () => {
    const big = 256n;
    const encoded = biguintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'0100')");
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(big);
  });

  it("biguint roundtrip u64 max", () => {
    // u64::MAX = 18446744073709551615
    const big = 18446744073709551615n;
    const encoded = biguintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'ffffffffffffffff')");
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(big);
  });

  it("biguint roundtrip over u64", () => {
    // 2^64 = 18446744073709551616
    const big = 18446744073709551615n + 1n;
    const encoded = biguintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'010000000000000000')");
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(big);
  });

  it("biguint roundtrip large (2^200)", () => {
    const big = 1n << 200n;
    const encoded = biguintToCbor(big);
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(big);
    // Verify it's encoded as tag 2
    expect(diagnosticOpt(encoded, { flat: true }).startsWith("2(h'")).toBe(true);
  });
});

// ============================================================================
// Round-trip tests for BigInt
// ============================================================================

describe("BigInt round-trip tests", () => {
  it("bigint roundtrip zero", () => {
    const big = 0n;
    const encoded = bigintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'')");
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
  });

  it("bigint roundtrip positive one", () => {
    const big = 1n;
    const encoded = bigintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'01')");
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
  });

  it("bigint roundtrip positive 256", () => {
    const big = 256n;
    const encoded = bigintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'0100')");
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
  });

  it("bigint roundtrip negative one", () => {
    const big = -1n;
    const encoded = bigintToCbor(big);
    // -1 -> magnitude = 1, n = 0 -> 0x00
    expect(diagnosticOpt(encoded, { flat: true })).toBe("3(h'00')");
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
  });

  it("bigint roundtrip negative two", () => {
    const big = -2n;
    const encoded = bigintToCbor(big);
    // -2 -> magnitude = 2, n = 1 -> 0x01
    expect(diagnosticOpt(encoded, { flat: true })).toBe("3(h'01')");
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
  });

  it("bigint roundtrip negative 256", () => {
    const big = -256n;
    const encoded = bigintToCbor(big);
    // -256 -> magnitude = 256, n = 255 -> 0xff
    expect(diagnosticOpt(encoded, { flat: true })).toBe("3(h'ff')");
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
  });

  it("bigint roundtrip negative 257", () => {
    const big = -257n;
    const encoded = bigintToCbor(big);
    // -257 -> magnitude = 257, n = 256 -> 0x0100
    expect(diagnosticOpt(encoded, { flat: true })).toBe("3(h'0100')");
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
  });

  it("bigint roundtrip large positive", () => {
    // 2^200
    const big = 1n << 200n;
    const encoded = bigintToCbor(big);
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
    expect(diagnosticOpt(encoded, { flat: true }).startsWith("2(h'")).toBe(true);
  });

  it("bigint roundtrip large negative", () => {
    // -(2^200)
    const big = -(1n << 200n);
    const encoded = bigintToCbor(big);
    const decoded = cborToBigint(encoded);
    expect(decoded).toBe(big);
    expect(diagnosticOpt(encoded, { flat: true }).startsWith("3(h'")).toBe(true);
  });
});

// ============================================================================
// Decoding plain CBOR integers to bignums
// ============================================================================

describe("Decoding plain CBOR integers", () => {
  it("decode plain unsigned to biguint", () => {
    const c = cbor(12345);
    const big = cborToBiguint(c);
    expect(big).toBe(12345n);
  });

  it("decode plain unsigned to bigint", () => {
    const c = cbor(12345);
    const big = cborToBigint(c);
    expect(big).toBe(12345n);
  });

  it("decode plain negative to bigint", () => {
    const c = cbor(-12345);
    const big = cborToBigint(c);
    expect(big).toBe(-12345n);
  });

  it("decode plain max u64 to biguint", () => {
    // u64::MAX = 18446744073709551615
    const c = cbor(18446744073709551615n);
    const big = cborToBiguint(c);
    expect(big).toBe(18446744073709551615n);
  });

  it("decode plain min i64 to bigint", () => {
    // i64::MIN = -9223372036854775808
    const c = cbor(-9223372036854775808n);
    const big = cborToBigint(c);
    expect(big).toBe(-9223372036854775808n);
  });
});

// ============================================================================
// Sign/range checks - negative values to BigUint must fail
// ============================================================================

describe("Sign/range checks", () => {
  it("decode plain negative to biguint fails", () => {
    const c = cbor(-1);
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("decode tag3 to biguint fails", () => {
    const c = bigintToCbor(-1n);
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("decode large negative to biguint fails", () => {
    const big = -(1n << 200n);
    const c = bigintToCbor(big);
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });
});

// ============================================================================
// Float rejection tests
// ============================================================================

describe("Float rejection", () => {
  it("decode float to biguint fails", () => {
    // Use a non-integral float that dCBOR cannot reduce to an integer
    const c = cbor(1.5);
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("decode float to bigint fails", () => {
    // Use a non-integral float that dCBOR cannot reduce to an integer
    const c = cbor(1.5);
    expect(() => cborToBigint(c)).toThrow(CborError);
  });

  it("decode integral float to biguint succeeds", () => {
    // dCBOR reduces integral floats to integers, so this should succeed
    // because 42.0 becomes the integer 42
    const c = cbor(42.0);
    // Verify it was reduced to an integer
    expect(diagnosticOpt(c, { flat: true })).toBe("42");
    const result = cborToBiguint(c);
    expect(result).toBe(42n);
  });

  it("decode integral float to bigint succeeds", () => {
    // dCBOR reduces integral floats to integers, so this should succeed
    const c = cbor(42.0);
    const result = cborToBigint(c);
    expect(result).toBe(42n);
  });

  it("decode negative float to bigint fails", () => {
    const c = cbor(-1.5);
    expect(() => cborToBigint(c)).toThrow(CborError);
  });
});

// ============================================================================
// Wrong type rejection tests
// ============================================================================

describe("Wrong type rejection", () => {
  it("decode string to biguint fails", () => {
    const c = cbor("hello");
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("decode string to bigint fails", () => {
    const c = cbor("hello");
    expect(() => cborToBigint(c)).toThrow(CborError);
  });

  it("decode array to biguint fails", () => {
    const c = cbor([1, 2, 3]);
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("decode raw bytestring to biguint fails", () => {
    // A raw byte string (not tagged) should fail
    const c = cbor(new Uint8Array([1, 2, 3]));
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("decode wrong tag to biguint fails", () => {
    // Tag 42 with a byte string should fail
    const c = toTaggedValue(42, new Uint8Array([1]));
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });
});

// ============================================================================
// Non-canonical encoding rejection tests
// ============================================================================

describe("Non-canonical rejection", () => {
  it("tag2 with leading zero fails", () => {
    // Tag 2 with h'0001' (leading zero) should fail
    // This represents 1, but with a non-canonical encoding
    const c = toTaggedValue(2, new Uint8Array([0, 1]));
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("tag2 with multiple leading zeros fails", () => {
    // Tag 2 with h'000001' (multiple leading zeros) should fail
    const c = toTaggedValue(2, new Uint8Array([0, 0, 1]));
    expect(() => cborToBiguint(c)).toThrow(CborError);
  });

  it("tag3 with leading zero fails", () => {
    // Tag 3 with h'0001' (leading zero) should fail
    // This represents -2 but with a non-canonical encoding
    const c = toTaggedValue(3, new Uint8Array([0, 1]));
    expect(() => cborToBigint(c)).toThrow(CborError);
  });

  it("tag3 empty byte string fails", () => {
    // Tag 3 with empty byte string should fail
    // (tag 2 with empty is valid for zero, but tag 3 needs at least 0x00)
    const c = toTaggedValue(3, new Uint8Array([]));
    expect(() => cborToBigint(c)).toThrow(CborError);
  });

  it("tag2 empty is zero", () => {
    // Tag 2 with empty byte string is canonical zero
    const c = toTaggedValue(2, new Uint8Array([]));
    const big = cborToBiguint(c);
    expect(big).toBe(0n);
    const bigInt = cborToBigint(c);
    expect(bigInt).toBe(0n);
  });

  it("tag3 single zero is negative one", () => {
    // Tag 3 with h'00' represents -1 (n=0, value = -1 - 0 = -1)
    const c = toTaggedValue(3, new Uint8Array([0]));
    const big = cborToBigint(c);
    expect(big).toBe(-1n);
  });
});

// ============================================================================
// Reference conversion tests (From<&BigInt> and From<&BigUint>)
// In TypeScript, we pass by value (bigint is a primitive), but verify
// the encoding matches.
// ============================================================================

describe("Reference conversion", () => {
  it("encode biguint by value", () => {
    const big = 256n;
    const encoded = biguintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'0100')");
  });

  it("encode negative bigint by value", () => {
    const big = -256n;
    const encoded = bigintToCbor(big);
    expect(diagnosticOpt(encoded, { flat: true })).toBe("3(h'ff')");
  });
});

// ============================================================================
// Edge cases around dCBOR integer range
// ============================================================================

describe("Edge cases", () => {
  it("bigint around i64 bounds", () => {
    // Values at i64 boundaries still encode as bignums
    // i64::MAX = 9223372036854775807
    const i64Max = 9223372036854775807n;
    const encodedMax = bigintToCbor(i64Max);
    expect(diagnosticOpt(encodedMax, { flat: true }).startsWith("2(h'")).toBe(true);
    const decodedMax = cborToBigint(encodedMax);
    expect(decodedMax).toBe(i64Max);

    // i64::MIN = -9223372036854775808
    const i64Min = -9223372036854775808n;
    const encodedMin = bigintToCbor(i64Min);
    expect(diagnosticOpt(encodedMin, { flat: true }).startsWith("3(h'")).toBe(true);
    const decodedMin = cborToBigint(encodedMin);
    expect(decodedMin).toBe(i64Min);
  });

  it("biguint around u64 bounds", () => {
    // u64::MAX = 18446744073709551615
    const u64Max = 18446744073709551615n;
    const encoded = biguintToCbor(u64Max);
    expect(diagnosticOpt(encoded, { flat: true }).startsWith("2(h'")).toBe(true);
    const decoded = cborToBiguint(encoded);
    expect(decoded).toBe(u64Max);
  });
});

// ============================================================================
// Additional RFC 8949 compliance tests
// ============================================================================

describe("RFC 8949 compliance", () => {
  // Per RFC 8949 §3.4.3: "The preferred serialization of the byte string is to
  // leave out any leading zeroes (note that this means the preferred
  // serialization for n = 0 is the empty byte string)"
  it("preferred serialization zero", () => {
    const zero = 0n;
    const encoded = biguintToCbor(zero);
    // Should be tag 2 with empty byte string
    expect(diagnosticOpt(encoded, { flat: true })).toBe("2(h'')");
    // Hex should be c240 (tag 2, empty byte string)
    expect(bytesToHex(encoded.toData())).toBe("c240");
  });

  // Per RFC 8949 §3.4.3: dCBOR requires canonical encoding so we reject
  // non-canonical forms.
  it("noncanonical leading zeros rejected", () => {
    // Tag 2 with h'00' should fail (non-canonical zero)
    const cbor1 = Cbor.tryFromHex("c24100"); // tag 2, 1-byte bstr h'00'
    expect(() => cborToBiguint(cbor1)).toThrow(CborError);

    // Tag 2 with h'0001' should fail (non-canonical 1)
    const cbor2 = Cbor.tryFromHex("c2420001"); // tag 2, 2-byte bstr
    expect(() => cborToBiguint(cbor2)).toThrow(CborError);
  });
});

// ============================================================================
// Hex decoding tests
// ============================================================================

describe("Hex decoding", () => {
  it("decode from hex positive bignum", () => {
    // Tag 2 with h'0100' = 256
    const c = Cbor.tryFromHex("c2420100");
    const big = cborToBiguint(c);
    expect(big).toBe(256n);
  });

  it("decode from hex negative bignum", () => {
    // Tag 3 with h'00' = -1 (n=0, value = -1 - 0 = -1)
    const c1 = Cbor.tryFromHex("c34100");
    const big1 = cborToBigint(c1);
    expect(big1).toBe(-1n);

    // Tag 3 with h'ff' = -256 (n=255, value = -1 - 255 = -256)
    const c2 = Cbor.tryFromHex("c341ff");
    const big2 = cborToBigint(c2);
    expect(big2).toBe(-256n);
  });
});

// ============================================================================
// Encoding length efficiency test
// ============================================================================

describe("Encoding length", () => {
  it("encoding length efficiency", () => {
    // Small values still get full bignum encoding (no numeric reduction)
    const one = biguintToCbor(1n);
    // c2 41 01 = tag 2, 1-byte bstr, 0x01
    expect(one.toData().length).toBe(3);

    // 2^64 should be tag + 9-byte length prefix + 9 bytes = 11 bytes
    const big = biguintToCbor(1n << 64n);
    expect(big.toData().length).toBe(11);
  });
});

// ============================================================================
// Tag summarizer tests
// These tests verify that the registered tag summarizers produce correct
// diagnostic output for bignum values.
// ============================================================================

describe("Tag summarizer", () => {
  const summarizerOpts: DiagFormatOpts = {
    summarize: true,
    tags: "global",
    flat: true,
  };

  // Register tags before summarizer tests
  it("summarizer positive bignum", () => {
    registerTags();
    const encoded = biguintToCbor(256n);
    const diag = diagnosticOpt(encoded, summarizerOpts);
    expect(diag).toBe("bignum(256)");
  });

  it("summarizer negative bignum", () => {
    registerTags();
    const encoded = bigintToCbor(-256n);
    const diag = diagnosticOpt(encoded, summarizerOpts);
    expect(diag).toBe("bignum(-256)");
  });

  it("summarizer zero", () => {
    registerTags();
    const encoded = biguintToCbor(0n);
    const diag = diagnosticOpt(encoded, summarizerOpts);
    expect(diag).toBe("bignum(0)");
  });

  it("summarizer negative one", () => {
    registerTags();
    const encoded = bigintToCbor(-1n);
    const diag = diagnosticOpt(encoded, summarizerOpts);
    expect(diag).toBe("bignum(-1)");
  });

  it("summarizer large positive", () => {
    registerTags();
    const encoded = biguintToCbor(1n << 64n);
    const diag = diagnosticOpt(encoded, summarizerOpts);
    expect(diag).toBe("bignum(18446744073709551616)");
  });

  it("summarizer large negative", () => {
    registerTags();
    const big2_64 = 1n << 64n;
    const big = -(big2_64 + 1n);
    const encoded = bigintToCbor(big);
    const diag = diagnosticOpt(encoded, summarizerOpts);
    expect(diag).toBe("bignum(-18446744073709551617)");
  });
});
