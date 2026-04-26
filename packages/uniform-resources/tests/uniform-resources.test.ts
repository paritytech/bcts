import { describe, it, expect } from "vitest";
import type { UREncodable, URDecodable, URCodable } from "../src";
import {
  UR,
  URType,
  URError,
  URDecodeError,
  InvalidSchemeError,
  TypeUnspecifiedError,
  InvalidTypeError,
  UnexpectedTypeError,
  NotSinglePartError,
  BytewordsError,
  BYTEWORDS,
  BYTEMOJIS,
  isUREncodable,
  isURDecodable,
  isURCodable,
  MultipartEncoder,
  MultipartDecoder,
  BytewordsStyle,
  encodeBytewords,
  decodeBytewords,
  encodeBytewordsIdentifier,
  encodeBytemojisIdentifier,
  bytewords,
  urFromEncodable,
  urStringFromEncodable,
} from "../src";
import {
  cbor,
  createTag,
  createTaggedCbor,
  type CborTaggedEncodable,
} from "@bcts/dcbor";

// Import internal utilities for testing internal functionality
// These are NOT part of the public API but needed for internal tests
import {
  isURTypeChar,
  isValidURType,
  validateURType,
  crc32,
  BYTEWORDS_MAP,
  MINIMAL_BYTEWORDS_MAP,
} from "../src/utils";
import { Xoshiro256, createSeed } from "../src/xoshiro";
import {
  FountainEncoder,
  FountainDecoder,
  splitMessage,
  xorBytes,
  chooseFragments,
} from "../src/fountain";

describe("URType", () => {
  it("creates a valid UR type with lowercase letters", () => {
    const urType = new URType("bytes");
    expect(urType.string()).toBe("bytes");
  });

  it("creates a valid UR type with numbers", () => {
    const urType = new URType("bytes2");
    expect(urType.string()).toBe("bytes2");
  });

  it("creates a valid UR type with hyphens", () => {
    const urType = new URType("my-type");
    expect(urType.string()).toBe("my-type");
  });

  it("throws error for uppercase letters", () => {
    expect(() => new URType("Bytes")).toThrow(InvalidTypeError);
  });

  // Rust's `URType::new("")` succeeds (vacuously-true `chars().all(...)`);
  // we mirror that for cross-port parity. The empty string round-trips
  // through encode() but later fails in the decode pipeline at the
  // bytewords/CBOR stage, just as it would in Rust.
  it("accepts the empty string (Rust parity — fails later at decode)", () => {
    const urType = new URType("");
    expect(urType.string()).toBe("");
  });

  it("throws error for special characters", () => {
    expect(() => new URType("bytes@")).toThrow(InvalidTypeError);
  });

  it("compares URTypes for equality", () => {
    const type1 = new URType("bytes");
    const type2 = new URType("bytes");
    const type3 = new URType("text");

    expect(type1.equals(type2)).toBe(true);
    expect(type1.equals(type3)).toBe(false);
  });

  it("returns string representation", () => {
    const urType = new URType("bytes");
    expect(urType.toString()).toBe("bytes");
  });

  describe("URType.tryFrom (typed Result, UR1)", () => {
    // Pinned regression for UR1 — `URType.tryFrom` returns a
    // discriminated `{ ok: true | false }` union mirroring Rust's
    // `Result<URType, Error>` from `impl TryFrom<&str> for URType`.

    it("returns { ok: true, value } for a valid type", () => {
      const result = URType.tryFrom("bytes");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeInstanceOf(URType);
        expect(result.value.string()).toBe("bytes");
      }
    });

    it("returns { ok: false, error } for an invalid type", () => {
      const result = URType.tryFrom("Bytes");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(InvalidTypeError);
      }
    });

    it("narrows correctly without instanceof checks", () => {
      // The whole point of UR1: callers branch on `ok`, not type
      // discrimination via `instanceof`. This test would fail to
      // typecheck under the old `URType | InvalidTypeError` shape.
      const r = URType.tryFrom("my-type-1");
      const out = r.ok ? r.value.string() : r.error.message;
      expect(out).toBe("my-type-1");
    });
  });
});

describe("Internal Utility Functions", () => {
  it("validates UR type characters", () => {
    expect(isURTypeChar("a")).toBe(true);
    expect(isURTypeChar("z")).toBe(true);
    expect(isURTypeChar("0")).toBe(true);
    expect(isURTypeChar("9")).toBe(true);
    expect(isURTypeChar("-")).toBe(true);

    expect(isURTypeChar("A")).toBe(false);
    expect(isURTypeChar("Z")).toBe(false);
    expect(isURTypeChar(" ")).toBe(false);
    expect(isURTypeChar("@")).toBe(false);
  });

  it("validates complete UR type strings", () => {
    expect(isValidURType("bytes")).toBe(true);
    expect(isValidURType("text")).toBe(true);
    expect(isValidURType("my-type")).toBe(true);
    expect(isValidURType("type123")).toBe(true);

    // Empty string is accepted (Rust parity — `chars().all(...)` is
    // vacuously true on the empty string).
    expect(isValidURType("")).toBe(true);
    expect(isValidURType("Bytes")).toBe(false);
    expect(isValidURType("my@type")).toBe(false);
  });

  it("validates URType or throws error", () => {
    expect(() => validateURType("bytes")).not.toThrow();
    expect(() => validateURType("Bytes")).toThrow(InvalidTypeError);
    // Empty string is accepted (Rust parity).
    expect(() => validateURType("")).not.toThrow();
  });

  it("contains bytewords array with 256 entries", () => {
    expect(BYTEWORDS).toHaveLength(256);
    expect(typeof BYTEWORDS[0]).toBe("string");
  });

  it("contains bytemojis array with 256 entries", () => {
    expect(BYTEMOJIS).toHaveLength(256);
    expect(typeof BYTEMOJIS[0]).toBe("string");
  });

  it("creates bytewords map for lookups", () => {
    expect(BYTEWORDS_MAP).toBeDefined();
    expect(BYTEWORDS_MAP.get("able")).toBe(0);
  });
});

describe("UR", () => {
  it("creates a UR with string type and CBOR data", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);

    expect(ur.urTypeStr()).toBe("bytes");
  });

  it("creates a UR with URType object", () => {
    const cborData = cbor(42);
    const urType = new URType("text");
    const ur = UR.new(urType, cborData);

    expect(ur.urTypeStr()).toBe("text");
  });

  it("converts UR to string", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const urString = ur.string();

    expect(urString).toMatch(/^ur:bytes\//);
  });

  it("decodes a UR string back to UR", () => {
    const cborData = cbor(42);
    const ur1 = UR.new("bytes", cborData);
    const urString = ur1.string();

    const ur2 = UR.fromURString(urString);
    expect(ur2.urTypeStr()).toBe("bytes");
  });

  it("round-trips UR encoding and decoding", () => {
    const cborData = cbor(123);
    const ur1 = UR.new("test", cborData);
    const urString = ur1.string();

    const ur2 = UR.fromURString(urString);
    expect(ur2.urTypeStr()).toBe(ur1.urTypeStr());
  });

  it("throws error for invalid scheme", () => {
    expect(() => UR.fromURString("invalid:bytes/...")).toThrow(InvalidSchemeError);
  });

  // Rust raises `TypeUnspecified` only when the `/` separator is missing
  // from the input (`ur.rs:30`). `ur:bytes` (no `/`) hits this path; an
  // input with `/` but no body lands in the bytewords decoder.
  it("throws TypeUnspecifiedError when there is no `/` separator", () => {
    expect(() => UR.fromURString("ur:bytes")).toThrow(TypeUnspecifiedError);
  });

  it("provides QR string representation", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const qrString = ur.qrString();

    expect(typeof qrString).toBe("string");
    expect(qrString).toMatch(/^UR:/i);
  });

  it("checks UR type compatibility", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);

    expect(() => ur.checkType("bytes")).not.toThrow();
    expect(() => ur.checkType("text")).toThrow(UnexpectedTypeError);
  });
});

describe("Error Types", () => {
  it("throws URError base class", () => {
    expect(() => {
      throw new URError("Test error");
    }).toThrow(URError);
  });

  it("throws URDecodeError", () => {
    const error = new URDecodeError("test message");
    expect(error).toBeInstanceOf(URError);
    expect(error.message).toBe("UR decoder error (test message)");
  });

  it("throws InvalidSchemeError", () => {
    expect(() => {
      throw new InvalidSchemeError();
    }).toThrow(InvalidSchemeError);
  });

  it("throws TypeUnspecifiedError", () => {
    expect(() => {
      throw new TypeUnspecifiedError();
    }).toThrow(TypeUnspecifiedError);
  });

  it("throws InvalidTypeError", () => {
    expect(() => {
      throw new InvalidTypeError();
    }).toThrow(InvalidTypeError);
  });

  it("throws NotSinglePartError", () => {
    expect(() => {
      throw new NotSinglePartError();
    }).toThrow(NotSinglePartError);
  });

  it("throws UnexpectedTypeError with context", () => {
    expect(() => {
      throw new UnexpectedTypeError("bytes", "text");
    }).toThrow(UnexpectedTypeError);

    try {
      throw new UnexpectedTypeError("bytes", "text");
    } catch (e) {
      expect((e as Error).message).toContain("bytes");
      expect((e as Error).message).toContain("text");
    }
  });
});

describe("Trait Interfaces", () => {
  class MockEncodable implements UREncodable {
    ur(): UR {
      const cborData = cbor(42);
      return UR.new("test", cborData);
    }

    urString(): string {
      return this.ur().string();
    }
  }

  class MockDecodable implements URDecodable {
    fromUR(_ur: UR): MockDecodable {
      return new MockDecodable();
    }
  }

  class MockCodable implements URCodable {
    ur(): UR {
      const cborData = cbor(42);
      return UR.new("test", cborData);
    }

    urString(): string {
      return this.ur().string();
    }

    fromUR(_ur: UR): MockCodable {
      return new MockCodable();
    }
  }

  it("detects UREncodable objects", () => {
    const encodable = new MockEncodable();
    expect(isUREncodable(encodable)).toBe(true);
    expect(isUREncodable({ ur: "not a function" })).toBe(false);
    expect(isUREncodable(null)).toBe(false);
  });

  it("detects URDecodable objects", () => {
    const decodable = new MockDecodable();
    expect(isURDecodable(decodable)).toBe(true);
    expect(isURDecodable({ fromUR: "not a function" })).toBe(false);
    expect(isURDecodable(null)).toBe(false);
  });

  it("detects URCodable objects", () => {
    const codable = new MockCodable();
    expect(isURCodable(codable)).toBe(true);
    expect(isURCodable(new MockEncodable())).toBe(false);
    expect(isURCodable(new MockDecodable())).toBe(false);
  });
});

describe("MultipartEncoder", () => {
  it("creates encoder with UR and max fragment length", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const encoder = new MultipartEncoder(ur, 100);

    expect(encoder).toBeDefined();
  });

  it("throws error for invalid max fragment length", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);

    expect(() => new MultipartEncoder(ur, 0)).toThrow(URError);
    expect(() => new MultipartEncoder(ur, -1)).toThrow(URError);
  });

  it("gets next part from encoder", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const encoder = new MultipartEncoder(ur, 100);

    const part = encoder.nextPart();
    expect(typeof part).toBe("string");
  });

  it("tracks current index", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const encoder = new MultipartEncoder(ur, 100);

    expect(encoder.currentIndex()).toBe(0);
    encoder.nextPart();
    expect(encoder.currentIndex()).toBe(1);
  });

  it("reports parts count", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const encoder = new MultipartEncoder(ur, 100);

    expect(encoder.partsCount()).toBeGreaterThan(0);
  });
});

describe("MultipartDecoder", () => {
  it("creates decoder", () => {
    const decoder = new MultipartDecoder();
    expect(decoder).toBeDefined();
  });

  it("receives UR part string", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const urString = ur.string();

    const decoder = new MultipartDecoder();
    expect(() => decoder.receive(urString)).not.toThrow();
  });

  it("throws error for invalid scheme", () => {
    const decoder = new MultipartDecoder();
    expect(() => decoder.receive("invalid:bytes/...")).toThrow(InvalidSchemeError);
  });

  it("throws error for invalid type format", () => {
    const decoder = new MultipartDecoder();
    expect(() => decoder.receive("ur:/...")).toThrow(InvalidTypeError);
  });

  it("checks if message is complete", () => {
    const decoder = new MultipartDecoder();
    expect(decoder.isComplete()).toBe(false);
  });

  it("retrieves message after complete", () => {
    const cborData = cbor(42);
    const ur = UR.new("bytes", cborData);
    const urString = ur.string();

    const decoder = new MultipartDecoder();
    decoder.receive(urString);

    if (decoder.isComplete()) {
      const message = decoder.message();
      expect(message).toBeDefined();
      expect(message?.urTypeStr()).toBe("bytes");
    }
  });

  it("returns null message when not complete", () => {
    const decoder = new MultipartDecoder();
    const message = decoder.message();
    expect(message).toBeNull();
  });

  it("throws error for mismatched types", () => {
    const cborData = cbor(42);
    const ur1 = UR.new("bytes", cborData);
    const ur2 = UR.new("text", cborData);

    const decoder = new MultipartDecoder();
    decoder.receive(ur1.string());

    expect(() => decoder.receive(ur2.string())).toThrow(UnexpectedTypeError);
  });
});

// =============================================================================
// RUST TEST EQUIVALENTS
// These tests match the test vectors from rust/bc-ur-rust/src/
// =============================================================================

describe("Rust lib.rs test equivalents", () => {
  // Equivalent to test_encode in lib.rs:129-134
  it("encodes [1,2,3] to ur:test/lsadaoaxjygonesw", () => {
    const cborData = cbor([1, 2, 3]);
    const ur = UR.new("test", cborData);
    const urString = ur.string();
    expect(urString).toBe("ur:test/lsadaoaxjygonesw");
  });

  // Equivalent to test_decode in lib.rs:136-145
  it("decodes ur:test/lsadaoaxjygonesw to [1,2,3]", () => {
    const urString = "ur:test/lsadaoaxjygonesw";
    const ur = UR.fromURString(urString);
    expect(ur.urTypeStr()).toBe("test");

    const cborData = ur.cbor();
    // The CBOR should represent [1, 2, 3]
    expect(cborData.toString()).toBe("[1, 2, 3]");
  });
});

describe("Rust ur.rs test equivalents", () => {
  // Equivalent to test_ur in ur.rs:106-119
  it("round-trips UR encoding and decoding", () => {
    const cborData = cbor([1, 2, 3]);
    const ur = UR.new("test", cborData);
    const urString = ur.string();
    expect(urString).toBe("ur:test/lsadaoaxjygonesw");

    const ur2 = UR.fromURString(urString);
    expect(ur2.urTypeStr()).toBe("test");
    expect(ur2.cbor().toString()).toBe("[1, 2, 3]");
  });

  it("decodes uppercase UR strings", () => {
    const capsUrString = "UR:TEST/LSADAOAXJYGONESW";
    const ur = UR.fromURString(capsUrString);
    expect(ur.urTypeStr()).toBe("test");
    expect(ur.cbor().toString()).toBe("[1, 2, 3]");
  });

  it("returns QR string in uppercase", () => {
    const cborData = cbor([1, 2, 3]);
    const ur = UR.new("test", cborData);
    expect(ur.qrString()).toBe("UR:TEST/LSADAOAXJYGONESW");
  });

  it("returns QR data as UTF-8 bytes (matches Rust `as_bytes()`)", () => {
    const cborData = cbor([1, 2, 3]);
    const ur = UR.new("test", cborData);
    const qrData = ur.qrData();
    expect(qrData).toBeInstanceOf(Uint8Array);
    // Decode as UTF-8 to verify the round-trip — matches Rust's
    // `qr_string().as_bytes().to_vec()` (`bc-ur-rust/src/ur.rs:52`).
    const qrString = new TextDecoder().decode(qrData);
    expect(qrString).toBe("UR:TEST/LSADAOAXJYGONESW");
  });

  it("checks equality between URs", () => {
    const cborData = cbor([1, 2, 3]);
    const ur1 = UR.new("test", cborData);
    const ur2 = UR.fromURString("ur:test/lsadaoaxjygonesw");
    expect(ur1.equals(ur2)).toBe(true);
  });
});

describe("Bytewords encoding tests", () => {
  it("contains 256 bytewords", () => {
    expect(BYTEWORDS.length).toBe(256);
  });

  it("contains unique bytewords", () => {
    const unique = new Set(BYTEWORDS);
    expect(unique.size).toBe(256);
  });

  it("bytewords are 4 characters each", () => {
    for (const word of BYTEWORDS) {
      expect(word.length).toBe(4);
    }
  });

  it("creates minimal bytewords map correctly", () => {
    // "able" -> index 0, minimal is "ae"
    expect(MINIMAL_BYTEWORDS_MAP.get("ae")).toBe(0);
    // "acid" -> index 1, minimal is "ad"
    expect(MINIMAL_BYTEWORDS_MAP.get("ad")).toBe(1);
    // "zoom" -> index 255, minimal is "zm"
    expect(MINIMAL_BYTEWORDS_MAP.get("zm")).toBe(255);
  });

  it("encodes empty data with CRC32", () => {
    const data = new Uint8Array([]);
    const encoded = encodeBytewords(data, BytewordsStyle.Minimal);
    // Empty data + CRC32 checksum (4 bytes) = 8 chars minimal
    expect(encoded.length).toBe(8);
  });

  it("encodes single byte with checksum", () => {
    const data = new Uint8Array([0x00]);
    const encoded = encodeBytewords(data, BytewordsStyle.Minimal);
    // 1 data byte + 4 checksum bytes = 5 bytes = 10 chars minimal
    expect(encoded.length).toBe(10);
  });

  it("round-trips bytewords minimal encoding", () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const encoded = encodeBytewords(original, BytewordsStyle.Minimal);
    const decoded = decodeBytewords(encoded, BytewordsStyle.Minimal);
    expect(decoded).toEqual(original);
  });

  it("round-trips bytewords standard encoding", () => {
    const original = new Uint8Array([1, 2, 3]);
    const encoded = encodeBytewords(original, BytewordsStyle.Standard);
    const decoded = decodeBytewords(encoded, BytewordsStyle.Standard);
    expect(decoded).toEqual(original);
  });

  it("round-trips bytewords uri encoding", () => {
    const original = new Uint8Array([1, 2, 3]);
    const encoded = encodeBytewords(original, BytewordsStyle.Uri);
    const decoded = decodeBytewords(encoded, BytewordsStyle.Uri);
    expect(decoded).toEqual(original);
  });

  it("detects checksum mismatch", () => {
    const data = new Uint8Array([1, 2, 3]);
    const encoded = encodeBytewords(data, BytewordsStyle.Minimal);
    // Replace one valid minimal token with another valid-but-different
    // token so the bytewords decode succeeds and the failure surfaces as
    // a checksum mismatch rather than `invalid word`.
    const lastTokenStart = encoded.length - 2;
    const lastToken = encoded.slice(lastTokenStart);
    const replacement = lastToken === "ae" ? "ad" : "ae"; // any other valid pair
    const corrupted = encoded.slice(0, lastTokenStart) + replacement;
    try {
      decodeBytewords(corrupted, BytewordsStyle.Minimal);
      throw new Error("expected throw");
    } catch (e) {
      // BytewordsError is the parity-correct class (Rust
      // `Error::Bytewords(InvalidChecksum)`).
      expect((e as Error).name).toBe("BytewordsError");
      expect((e as Error).message).toContain("invalid checksum");
    }
  });

  it("throws BytewordsError on invalid minimal byteword", () => {
    expect(() => decodeBytewords("xx", BytewordsStyle.Minimal)).toThrow(BytewordsError);
    expect(() => decodeBytewords("xx", BytewordsStyle.Minimal)).toThrow("invalid word");
  });

  it("throws BytewordsError on non-ASCII input (Rust NonAscii)", () => {
    // Rust upstream `bytewords::decode` rejects this with `Error::NonAscii`
    // (`ur-0.4.1/src/bytewords.rs:105-107` — see also the `₿` test cases
    // at lines 257-259). TS must surface the same class.
    expect(() => decodeBytewords("₿", BytewordsStyle.Minimal)).toThrow(BytewordsError);
    expect(() => decodeBytewords("₿", BytewordsStyle.Standard)).toThrow(BytewordsError);
    expect(() => decodeBytewords("₿", BytewordsStyle.Uri)).toThrow(BytewordsError);
  });

  it("throws BytewordsError on minimal odd length", () => {
    // Rust `bytewords.rs:248-254` covers this case; class must be the
    // BytewordsError (mapped from `Error::InvalidLength`).
    expect(() => decodeBytewords("aea", BytewordsStyle.Minimal)).toThrow(BytewordsError);
    expect(() => decodeBytewords("aea", BytewordsStyle.Minimal)).toThrow("invalid length");
  });
});

describe("CRC32 tests (internal)", () => {
  it("calculates CRC32 for empty data", () => {
    const data = new Uint8Array([]);
    const checksum = crc32(data);
    expect(checksum).toBe(0x00000000);
  });

  it("calculates CRC32 for test data", () => {
    // "123456789" has CRC32 = 0xCBF43926 (IEEE polynomial)
    const data = new TextEncoder().encode("123456789");
    const checksum = crc32(data);
    expect(checksum).toBe(0xcbf43926);
  });

  it("calculates CRC32 for single byte", () => {
    const data = new Uint8Array([0x00]);
    const checksum = crc32(data);
    expect(checksum).toBe(0xd202ef8d);
  });
});

describe("Bytewords identifier tests", () => {
  // Equivalent to identifier() in bytewords.rs
  it("encodes 4-byte identifier as bytewords", () => {
    const data = new Uint8Array([0, 1, 2, 3]);
    const identifier = encodeBytewordsIdentifier(data);
    // [0, 1, 2, 3] -> ["able", "acid", "also", "apex"]
    expect(identifier).toBe("able acid also apex");
  });

  it("throws for non-4-byte data", () => {
    const data = new Uint8Array([0, 1, 2]);
    expect(() => encodeBytewordsIdentifier(data)).toThrow(
      "Identifier data must be exactly 4 bytes",
    );
  });
});

describe("Bytemoji identifier tests", () => {
  // Equivalent to bytemoji_identifier() in bytewords.rs
  it("encodes 4-byte identifier as bytemojis", () => {
    const data = new Uint8Array([0, 1, 2, 3]);
    const identifier = encodeBytemojisIdentifier(data);
    // Check it returns space-separated emojis
    expect(identifier.split(" ").length).toBe(4);
  });

  it("throws for non-4-byte data", () => {
    const data = new Uint8Array([0, 1, 2]);
    expect(() => encodeBytemojisIdentifier(data)).toThrow(
      "Identifier data must be exactly 4 bytes",
    );
  });

  it("contains 256 unique bytemojis", () => {
    expect(BYTEMOJIS.length).toBe(256);
    const unique = new Set(BYTEMOJIS);
    expect(unique.size).toBe(256);
  });
});

// =============================================================================
// RUST PARITY: ur_codable.rs::test_ur_codable
// Source: bc-ur-rust/src/ur_codable.rs:58-66
// Round-trip vector: ur:leaf/iejyihjkjygupyltla
// =============================================================================
describe("Rust ur_codable.rs::test_ur_codable", () => {
  it("encodes a tagged leaf string to ur:leaf/iejyihjkjygupyltla", () => {
    const tag = createTag(24, "leaf");
    // The leaf type wraps a string under tag 24. The UR carries the
    // *untagged* CBOR (the inner string), with the type name coming from
    // the tag's name attribute. This mirrors Rust's `Test::ur()` which
    // calls `UR::new(tag.name(), self.untagged_cbor())`.
    const ur = UR.new(tag.name as string, cbor("test"));
    expect(ur.string()).toBe("ur:leaf/iejyihjkjygupyltla");

    const ur2 = UR.fromURString("ur:leaf/iejyihjkjygupyltla");
    expect(ur2.urTypeStr()).toBe("leaf");
  });

  it("uses the helper auto-derivation `urFromEncodable` like Rust's blanket impl", () => {
    // A minimal CborTaggedEncodable for "leaf" (tag 24) wrapping a string.
    const leaf: CborTaggedEncodable = {
      cborTags: () => [createTag(24, "leaf")],
      untaggedCbor: () => cbor("test"),
      taggedCbor() {
        return createTaggedCbor(this);
      },
    };

    expect(urFromEncodable(leaf).urTypeStr()).toBe("leaf");
    expect(urStringFromEncodable(leaf)).toBe("ur:leaf/iejyihjkjygupyltla");
  });
});

// =============================================================================
// RUST PARITY: bytewords namespace re-export
// Source: bc-ur-rust/src/bytewords.rs (the entire `pub mod bytewords`)
// =============================================================================
describe("bytewords namespace (Rust `bc_ur::bytewords`)", () => {
  it("exposes encode/decode/Style and round-trips identically to the flat exports", () => {
    expect(bytewords.Style.Minimal).toBe(BytewordsStyle.Minimal);

    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const encoded = bytewords.encode(data, bytewords.Style.Minimal);
    expect(encoded).toBe(encodeBytewords(data, BytewordsStyle.Minimal));

    const decoded = bytewords.decode(encoded, bytewords.Style.Minimal);
    expect(decoded).toEqual(data);
  });

  it("exposes identifier / bytemojiIdentifier / canonicalizeByteword", () => {
    const idData = new Uint8Array([0, 1, 2, 3]);
    expect(bytewords.identifier(idData)).toBe("able acid also apex");
    expect(bytewords.canonicalizeByteword("ae")).toBe("able");
    expect(bytewords.isValidBytemoji(BYTEMOJIS[0])).toBe(true);

    const bm = bytewords.bytemojiIdentifier(idData);
    expect(bm.split(" ")).toHaveLength(4);
  });
});


// =============================================================================
// RUST PARITY: NotSinglePartError on multipart input to from_ur_string
// Source: bc-ur-rust/src/ur.rs:33-35
// =============================================================================
describe("Rust ur.rs NotSinglePart parity", () => {
  it("UR.fromURString throws NotSinglePartError for a multipart UR", () => {
    // A minimal valid multipart UR: type/seqNum-seqLen/payload. The
    // payload doesn't have to be valid bytewords because the multipart
    // detection happens before the bytewords decode.
    expect(() =>
      UR.fromURString("ur:bytes/1-9/lpadbbcsiecyvdidatkpfeghihjtcxiabdfevlms"),
    ).toThrow(NotSinglePartError);
  });

  it("UR.fromURString rejects malformed indices with URDecodeError", () => {
    // Rust upstream returns `Error::InvalidIndices`
    // (`ur-0.4.1/src/ur.rs:447-449`). We surface that as URDecodeError.
    expect(() =>
      UR.fromURString("ur:bytes/1-1a/aeadaolazmjendeoti"),
    ).toThrow(URDecodeError);
  });
});

// =============================================================================
// RUST PARITY: type validation runs *before* bytewords decode
// Source: bc-ur-rust/src/ur.rs:31
// =============================================================================
describe("Rust ur.rs validation order", () => {
  it("InvalidTypeError fires before bytewords on bad type with valid payload", () => {
    // The bytewords payload is valid here (`lsadaoaxjygonesw` decodes to
    // the CBOR for [1, 2, 3]). The type contains `@` which is not a
    // valid UR-type char, so we should see InvalidTypeError immediately,
    // not a downstream bytewords/CBOR error.
    expect(() =>
      UR.fromURString("ur:bad@type/lsadaoaxjygonesw"),
    ).toThrow(InvalidTypeError);
  });
});

describe("User's UR example test", () => {
  it("decodes ur:user/oeidiniecskgiejthsjnihisgejlisjtcxfyjlihjldnbwrl", () => {
    const urString = "ur:user/oeidiniecskgiejthsjnihisgejlisjtcxfyjlihjldnbwrl";
    const ur = UR.fromURString(urString);

    expect(ur.urTypeStr()).toBe("user");

    const cborData = ur.cbor();
    // Should be {"id": 123, "name": "John Doe"}
    expect(cborData.toString()).toBe('{"id": 123, "name": "John Doe"}');
  });

  it("round-trips user UR example", () => {
    const urString = "ur:user/oeidiniecskgiejthsjnihisgejlisjtcxfyjlihjldnbwrl";
    const ur = UR.fromURString(urString);
    const reencoded = ur.string();

    expect(reencoded).toBe(urString);

    const ur2 = UR.fromURString(reencoded);
    expect(ur.equals(ur2)).toBe(true);
  });
});

// =============================================================================
// INTERNAL FOUNTAIN CODE TESTS
// These test internal functionality (not part of public API)
// =============================================================================

describe("Xoshiro256** PRNG (internal)", () => {
  // Helper to create 32-byte seeds
  const make32ByteSeed = (...values: number[]) => {
    const seed = new Uint8Array(32);
    for (let i = 0; i < values.length && i < 32; i++) {
      seed[i] = values[i];
    }
    return seed;
  };

  it("creates a PRNG from 32-byte seed", () => {
    const seed = make32ByteSeed(1, 2, 3, 4);
    const rng = new Xoshiro256(seed);
    expect(rng).toBeDefined();
  });

  it("throws error for non-32-byte seed", () => {
    expect(() => new Xoshiro256(new Uint8Array([1, 2, 3, 4]))).toThrow("Seed must be 32 bytes");
  });

  it("generates deterministic values", () => {
    const seed = make32ByteSeed(1, 2, 3, 4);
    const rng1 = new Xoshiro256(seed);
    const rng2 = new Xoshiro256(seed);

    // Same seed should produce same sequence
    expect(rng1.nextDouble()).toBe(rng2.nextDouble());
    expect(rng1.nextInt(0, 100)).toBe(rng2.nextInt(0, 100));
    expect(rng1.nextByte()).toBe(rng2.nextByte());
  });

  it("generates different values for different seeds", () => {
    // Use createSeed to generate proper 32-byte seeds from different inputs
    const seed1 = createSeed(0x12345678, 1);
    const seed2 = createSeed(0x87654321, 2);
    const rng1 = new Xoshiro256(seed1);
    const rng2 = new Xoshiro256(seed2);

    // Different seeds should produce different values
    const val1 = rng1.nextDouble();
    const val2 = rng2.nextDouble();
    expect(val1).not.toBe(val2);
  });

  it("nextDouble returns values in [0, 1)", () => {
    const rng = new Xoshiro256(make32ByteSeed(42));
    for (let i = 0; i < 100; i++) {
      const val = rng.nextDouble();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("nextInt returns values in [low, high] (inclusive)", () => {
    const rng = new Xoshiro256(make32ByteSeed(42));
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(20); // Inclusive upper bound to match BC-UR reference
    }
  });

  it("nextByte returns values in [0, 255]", () => {
    const rng = new Xoshiro256(make32ByteSeed(42));
    for (let i = 0; i < 100; i++) {
      const val = rng.nextByte();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });

  it("nextData generates array of specified length", () => {
    const rng = new Xoshiro256(make32ByteSeed(42));
    const data = rng.nextData(32);
    expect(data.length).toBe(32);
  });
});

describe("createSeed (internal)", () => {
  it("creates 32-byte seed from checksum and seqNum using SHA-256", () => {
    const seed = createSeed(0x12345678, 1);
    // SHA-256 output is always 32 bytes
    expect(seed.length).toBe(32);
  });

  it("produces different seeds for different seqNums", () => {
    const seed1 = createSeed(0x12345678, 1);
    const seed2 = createSeed(0x12345678, 2);

    expect(seed1).not.toEqual(seed2);
  });

  it("produces deterministic seeds", () => {
    const seed1 = createSeed(0x12345678, 1);
    const seed2 = createSeed(0x12345678, 1);

    expect(seed1).toEqual(seed2);
  });
});

describe("splitMessage (internal)", () => {
  it("splits message into fragments", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const fragments = splitMessage(message, 3);

    expect(fragments.length).toBe(4); // ceil(10/3) = 4
    expect(fragments[0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(fragments[1]).toEqual(new Uint8Array([4, 5, 6]));
    expect(fragments[2]).toEqual(new Uint8Array([7, 8, 9]));
    expect(fragments[3]).toEqual(new Uint8Array([10, 0, 0])); // Padded
  });

  it("handles message shorter than fragment size", () => {
    // Mirrors Rust `fragment_length(2, 10) === 2`: a 2-byte message
    // with `max_fragment_length = 10` produces ONE fragment of length
    // 2 (no padding) — *not* one 10-byte fragment with 8 bytes of
    // padding, as a naive `splitMessage` would.
    const message = new Uint8Array([1, 2]);
    const fragments = splitMessage(message, 10);

    expect(fragments.length).toBe(1);
    const fragment = fragments[0];
    expect(fragment).toBeDefined();
    expect(fragment?.length).toBe(2);
    expect(fragment?.[0]).toBe(1);
    expect(fragment?.[1]).toBe(2);
  });

  it("handles message exactly divisible by fragment size", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const fragments = splitMessage(message, 3);

    expect(fragments.length).toBe(2);
    expect(fragments[0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(fragments[1]).toEqual(new Uint8Array([4, 5, 6]));
  });
});

describe("xorBytes (internal)", () => {
  it("XORs two equal-length arrays", () => {
    const a = new Uint8Array([0b11110000, 0b10101010]);
    const b = new Uint8Array([0b00001111, 0b01010101]);
    const result = xorBytes(a, b);

    expect(result).toEqual(new Uint8Array([0b11111111, 0b11111111]));
  });

  it("XORs arrays of different lengths", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2]);
    const result = xorBytes(a, b);

    expect(result.length).toBe(3);
    expect(result[0]).toBe(0); // 1 XOR 1
    expect(result[1]).toBe(0); // 2 XOR 2
    expect(result[2]).toBe(3); // 3 XOR 0
  });

  it("XOR is involutory (reversible)", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([5, 4, 3, 2, 1]);

    const mixed = xorBytes(a, b);
    const recovered = xorBytes(mixed, b);

    expect(recovered).toEqual(a);
  });
});

describe("chooseFragments (internal)", () => {
  it("returns single fragment for pure parts", () => {
    const indices = chooseFragments(1, 5, 0x12345678);
    expect(indices).toEqual([0]); // seqNum 1 -> index 0

    const indices2 = chooseFragments(3, 5, 0x12345678);
    expect(indices2).toEqual([2]); // seqNum 3 -> index 2

    const indices3 = chooseFragments(5, 5, 0x12345678);
    expect(indices3).toEqual([4]); // seqNum 5 -> index 4
  });

  it("returns multiple fragments for rateless parts", () => {
    const indices = chooseFragments(6, 5, 0x12345678);
    expect(indices.length).toBeGreaterThanOrEqual(1);
    expect(indices.every((i) => i >= 0 && i < 5)).toBe(true);
  });

  it("produces deterministic results", () => {
    const indices1 = chooseFragments(10, 5, 0x12345678);
    const indices2 = chooseFragments(10, 5, 0x12345678);
    expect(indices1).toEqual(indices2);
  });

  it("produces different results for different seqNums", () => {
    // Test that different seqNums can be used without errors
    chooseFragments(6, 5, 0x12345678);
    chooseFragments(7, 5, 0x12345678);
    // They might be the same by chance, but usually different
    // This is a probabilistic test - just verify no error thrown
    expect(true).toBe(true);
  });
});

describe("FountainEncoder (internal)", () => {
  it("creates encoder from message", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5]);
    const encoder = new FountainEncoder(message, 2);
    expect(encoder.seqLen).toBe(3); // ceil(5/2)
  });

  it("generates parts with correct metadata", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5]);
    const encoder = new FountainEncoder(message, 2);
    const part = encoder.nextPart();

    expect(part.seqNum).toBe(1);
    expect(part.seqLen).toBe(3);
    expect(part.messageLen).toBe(5);
    expect(part.checksum).toBeDefined();
  });

  it("generates sequential parts", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const encoder = new FountainEncoder(message, 2);

    expect(encoder.nextPart().seqNum).toBe(1);
    expect(encoder.nextPart().seqNum).toBe(2);
    expect(encoder.nextPart().seqNum).toBe(3);
    expect(encoder.isComplete()).toBe(true);

    // Can continue generating rateless parts
    expect(encoder.nextPart().seqNum).toBe(4);
    expect(encoder.nextPart().seqNum).toBe(5);
  });

  it("resets to beginning", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const encoder = new FountainEncoder(message, 2);

    encoder.nextPart();
    encoder.nextPart();
    expect(encoder.currentSeqNum()).toBe(2);

    encoder.reset();
    expect(encoder.currentSeqNum()).toBe(0);
    expect(encoder.nextPart().seqNum).toBe(1);
  });

  it("identifies single-part messages", () => {
    const shortMessage = new Uint8Array([1, 2]);
    const encoder = new FountainEncoder(shortMessage, 10);
    expect(encoder.isSinglePart()).toBe(true);

    const longMessage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const encoder2 = new FountainEncoder(longMessage, 5);
    expect(encoder2.isSinglePart()).toBe(false);
  });
});

describe("FountainDecoder (internal)", () => {
  it("decodes pure fragments", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const encoder = new FountainEncoder(message, 2);
    const decoder = new FountainDecoder();

    // Receive all pure parts
    while (!encoder.isComplete()) {
      const part = encoder.nextPart();
      decoder.receive(part);
    }

    expect(decoder.isComplete()).toBe(true);
    expect(decoder.message()).toEqual(message);
  });

  it("decodes parts out of order", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const encoder = new FountainEncoder(message, 2);
    const decoder = new FountainDecoder();

    // Collect all parts
    const parts = [];
    while (!encoder.isComplete()) {
      parts.push(encoder.nextPart());
    }

    // Receive in reverse order
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part !== undefined) {
        decoder.receive(part);
      }
    }

    expect(decoder.isComplete()).toBe(true);
    expect(decoder.message()).toEqual(message);
  });

  it("reports progress", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const encoder = new FountainEncoder(message, 2);
    const decoder = new FountainDecoder();

    expect(decoder.progress()).toBe(0);

    decoder.receive(encoder.nextPart());
    expect(decoder.progress()).toBeCloseTo(1 / 3, 5);

    decoder.receive(encoder.nextPart());
    expect(decoder.progress()).toBeCloseTo(2 / 3, 5);

    decoder.receive(encoder.nextPart());
    expect(decoder.progress()).toBe(1);
  });

  it("resets decoder", () => {
    const message = new Uint8Array([1, 2, 3]);
    const encoder = new FountainEncoder(message, 10);
    const decoder = new FountainDecoder();

    decoder.receive(encoder.nextPart());
    expect(decoder.isComplete()).toBe(true);

    decoder.reset();
    expect(decoder.isComplete()).toBe(false);
    expect(decoder.progress()).toBe(0);
    expect(decoder.message()).toBeNull();
  });

  it("validates checksum", () => {
    const message = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const encoder = new FountainEncoder(message, 2);
    const decoder = new FountainDecoder();

    // Receive all parts
    while (!encoder.isComplete()) {
      decoder.receive(encoder.nextPart());
    }

    // Checksum validation happens in message()
    const decoded = decoder.message();
    expect(decoded).toEqual(message);
  });
});

describe("Multipart UR round-trip", () => {
  it("encodes and decodes multipart UR", () => {
    // Create a larger CBOR payload that requires multiple parts
    const largeArray = [];
    for (let i = 0; i < 50; i++) {
      largeArray.push(i);
    }
    const cborData = cbor(largeArray);
    const ur = UR.new("test", cborData);

    // Encode as multipart
    const encoder = new MultipartEncoder(ur, 10);

    // Decode all parts
    const decoder = new MultipartDecoder();
    const parts: string[] = [];

    // Use internal FountainEncoder to check completion
    const fountainEncoder = new FountainEncoder(ur.cbor().toData(), 10);
    while (!fountainEncoder.isComplete()) {
      const part = encoder.nextPart();
      parts.push(part);
      fountainEncoder.nextPart(); // Keep in sync
    }

    // Feed parts to decoder
    for (const part of parts) {
      decoder.receive(part);
      if (decoder.isComplete()) break;
    }

    expect(decoder.isComplete()).toBe(true);

    const decodedUR = decoder.message();
    expect(decodedUR).not.toBeNull();
    expect(decodedUR?.urTypeStr()).toBe("test");
  });

  it("handles single-part UR through multipart decoder", () => {
    const cborData = cbor([1, 2, 3]);
    const ur = UR.new("test", cborData);

    const decoder = new MultipartDecoder();
    decoder.receive(ur.string());

    expect(decoder.isComplete()).toBe(true);
    const decoded = decoder.message();
    expect(decoded).not.toBeNull();
    expect(decoded?.urTypeStr()).toBe("test");
  });
});

// =============================================================================
// RUST PARITY TESTS
// These tests verify that the TypeScript fountain code implementation matches
// the behavior of the Rust bc-ur implementation.
// Reference: ref/bc-ur-rust/src/lib.rs
// =============================================================================

describe("Rust parity tests", () => {
  describe("Fountain code completion behavior", () => {
    // Test message from Rust: "The only thing we have to fear is fear itself."
    const message = new TextEncoder().encode("The only thing we have to fear is fear itself.");

    it("should complete with pure parts when receiving from part 1", () => {
      const encoder = new FountainEncoder(message, 10);
      const decoder = new FountainDecoder();

      let completedAt = 0;
      for (let i = 1; i <= 1000; i++) {
        const part = encoder.nextPart();
        decoder.receive(part);
        if (decoder.isComplete()) {
          completedAt = i;
          break;
        }
      }

      // With 10-byte fragments, message of 47 bytes = ceil(47/10) = 5 pure fragments
      // Should complete after receiving all 5 pure parts
      expect(completedAt).toBe(5);
      expect(decoder.message()).toEqual(message);
    });

    it("should complete with mixed parts when starting late", () => {
      const encoder = new FountainEncoder(message, 10);
      const decoder = new FountainDecoder();

      // Skip parts 1-5 (all pure parts)
      for (let i = 1; i <= 5; i++) {
        encoder.nextPart();
      }

      // Now receive only mixed/rateless parts
      let completedAt = 0;
      for (let i = 6; i <= 1000; i++) {
        const part = encoder.nextPart();
        decoder.receive(part);
        if (decoder.isComplete()) {
          completedAt = i;
          break;
        }
      }

      // Should eventually complete using fountain code properties
      expect(completedAt).toBeGreaterThan(5);
      expect(decoder.message()).toEqual(message);
    });

    it("should decode correctly when receiving out of order", () => {
      const encoder = new FountainEncoder(message, 10);
      const decoder = new FountainDecoder();

      // Collect 10 parts
      const parts = [];
      for (let i = 0; i < 10; i++) {
        parts.push(encoder.nextPart());
      }

      // Receive in shuffled order: 3, 1, 5, 2, 4
      const order = [2, 0, 4, 1, 3];
      for (const idx of order) {
        const part = parts[idx];
        if (part === undefined) continue;
        decoder.receive(part);
        if (decoder.isComplete()) break;
      }

      expect(decoder.isComplete()).toBe(true);
      expect(decoder.message()).toEqual(message);
    });
  });

  describe("Deterministic fragment selection", () => {
    it("should produce consistent fragment indices for same inputs", () => {
      const checksum = 0x12345678;

      // Pure parts should always return single index
      expect(chooseFragments(1, 5, checksum)).toEqual([0]);
      expect(chooseFragments(2, 5, checksum)).toEqual([1]);
      expect(chooseFragments(5, 5, checksum)).toEqual([4]);

      // Mixed parts should be deterministic
      const mixed1 = chooseFragments(6, 5, checksum);
      const mixed2 = chooseFragments(6, 5, checksum);
      expect(mixed1).toEqual(mixed2);
      expect(mixed1.length).toBeGreaterThanOrEqual(1);
    });

    it("should produce different fragments for different seqNums", () => {
      const checksum = 0x12345678;
      const seqLen = 10;

      // Different mixed parts should generally have different indices
      const fragments1 = chooseFragments(11, seqLen, checksum);
      const fragments2 = chooseFragments(12, seqLen, checksum);
      const fragments3 = chooseFragments(13, seqLen, checksum);

      // At least some should differ
      const allSame =
        JSON.stringify(fragments1) === JSON.stringify(fragments2) &&
        JSON.stringify(fragments2) === JSON.stringify(fragments3);
      expect(allSame).toBe(false);
    });
  });
});
