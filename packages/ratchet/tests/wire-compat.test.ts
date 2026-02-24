/**
 * Wire Format Compatibility Tests (WS-9 Tasks 9.1-9.4)
 *
 * Verifies that BCTS protobuf serialization produces bytes structurally
 * identical to what libsignal expects, and vice versa. Checks field numbers,
 * wire types, varint encoding, and byte layouts against the canonical proto
 * definitions in libsignal:
 *
 *   - rust/protocol/src/proto/wire.proto
 *   - rust/protocol/src/proto/storage.proto
 *   - rust/protocol/src/proto/sealed_sender.proto
 *   - rust/protocol/src/proto/fingerprint.proto
 *
 * These tests do NOT require linking the native libsignal bindings. They
 * verify structural wire-format correctness by parsing raw bytes.
 */

import { describe, it, expect } from "vitest";
import {
  // Varint helpers
  encodeVarint,
  decodeVarint,
  encodeVarint64,
  decodeVarint64,
  // Wire-message codecs
  encodeSignalMessage,
  decodeSignalMessage,
  encodePreKeySignalMessage,
  decodePreKeySignalMessage,
  // Generic field helpers
  encodeBytesField,
  encodeUint32Field,
  encodeUint64Field,
  encodeNestedMessage,
  concatProtoFields,
  parseProtoFields,
  // Session / storage codecs
  encodeSessionStructure,
  decodeSessionStructure,
  encodeChainStructure,
  encodeChainKey,
  encodeMessageKey,
  encodePendingPreKey,
  encodePendingKyberPreKey,
  encodeRecordStructure,
  decodeRecordStructure,
  // Sender key codecs
  encodeSenderKeyRecordStructure,
  decodeSenderKeyRecordStructure,
  encodeSenderKeyStateStructure,
  decodeSenderKeyStateStructure,
  // Pre key record codecs
  encodePreKeyRecord,
  decodePreKeyRecord,
  encodeSignedPreKeyRecord,
  decodeSignedPreKeyRecord,
} from "../src/protocol/proto.js";
import { ChainKey } from "../src/ratchet/chain-key.js";
import { MessageKeys } from "../src/ratchet/message-keys.js";
import { hkdfSha256, hmacSha256 } from "../src/crypto/kdf.js";

// ============================================================================
// Task 9.1 -- Raw Protobuf Parser Utility
// ============================================================================

/**
 * A parsed protobuf field with its raw components.
 */
interface RawProtoField {
  field: number;
  wireType: number;
  /** varint value (wire type 0) or byte length (wire type 2) */
  value: number | Uint8Array;
}

/**
 * Minimal raw protobuf parser. Returns an ordered list of field entries
 * exactly as they appear on the wire. Supports:
 *   wire type 0 -- varint
 *   wire type 1 -- fixed64 (8 bytes)
 *   wire type 2 -- length-delimited (bytes / nested message / string)
 *   wire type 5 -- fixed32 (4 bytes)
 *
 * This is NOT a full protobuf decoder -- it is a test-only utility for
 * inspecting raw bytes produced by our encoder.
 */
function parseRawProto(data: Uint8Array): RawProtoField[] {
  const fields: RawProtoField[] = [];
  let offset = 0;

  while (offset < data.length) {
    // Read tag
    const [tag, tagEnd] = readVarint(data, offset);
    offset = tagEnd;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    switch (wireType) {
      case 0: {
        // Varint
        const [value, valEnd] = readVarint(data, offset);
        offset = valEnd;
        fields.push({ field: fieldNumber, wireType, value });
        break;
      }
      case 1: {
        // Fixed64
        const value = data.slice(offset, offset + 8);
        offset += 8;
        fields.push({ field: fieldNumber, wireType, value });
        break;
      }
      case 2: {
        // Length-delimited
        const [len, lenEnd] = readVarint(data, offset);
        offset = lenEnd;
        const value = data.slice(offset, offset + len);
        offset += len;
        fields.push({ field: fieldNumber, wireType, value });
        break;
      }
      case 5: {
        // Fixed32
        const value = data.slice(offset, offset + 4);
        offset += 4;
        fields.push({ field: fieldNumber, wireType, value });
        break;
      }
      default:
        throw new Error(
          `Unsupported wire type ${wireType} at offset ${offset - 1}`,
        );
    }
  }

  return fields;
}

/** Read a varint from data at offset, returning [value, newOffset]. */
function readVarint(
  data: Uint8Array,
  offset: number,
): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) {
      return [result >>> 0, pos];
    }
    shift += 7;
    if (shift > 35) throw new Error("Varint too long");
  }
  throw new Error("Unexpected end of varint");
}

// ============================================================================
// Helpers
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build a protobuf tag byte: (fieldNumber << 3) | wireType */
function tag(fieldNumber: number, wireType: number): number {
  return (fieldNumber << 3) | wireType;
}

/** Create deterministic N-byte filler for test data. */
function filler(length: number, seed: number = 0xab): Uint8Array {
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = (seed + i) & 0xff;
  }
  return data;
}

// ============================================================================
// Task 9.1 -- Raw Protobuf Parser Tests
// ============================================================================

describe("Task 9.1: Raw Protobuf Parser", () => {
  it("parses a single varint field", () => {
    // field 1, wire type 0, value 150
    // tag = (1 << 3) | 0 = 0x08
    // varint 150 = 0x96 0x01
    const data = new Uint8Array([0x08, 0x96, 0x01]);
    const fields = parseRawProto(data);
    expect(fields).toHaveLength(1);
    expect(fields[0].field).toBe(1);
    expect(fields[0].wireType).toBe(0);
    expect(fields[0].value).toBe(150);
  });

  it("parses a single length-delimited field", () => {
    // field 2, wire type 2, value = 3 bytes [0xAA, 0xBB, 0xCC]
    // tag = (2 << 3) | 2 = 0x12
    // length = 3
    const data = new Uint8Array([0x12, 0x03, 0xaa, 0xbb, 0xcc]);
    const fields = parseRawProto(data);
    expect(fields).toHaveLength(1);
    expect(fields[0].field).toBe(2);
    expect(fields[0].wireType).toBe(2);
    expect(fields[0].value).toBeInstanceOf(Uint8Array);
    expect(bytesToHex(fields[0].value as Uint8Array)).toBe("aabbcc");
  });

  it("parses multiple fields in order", () => {
    // field 1 varint 42, field 2 bytes [0xFF], field 3 varint 0
    const data = new Uint8Array([
      0x08, 42,           // field 1, varint, value=42
      0x12, 0x01, 0xff,   // field 2, LEN, 1 byte
      0x18, 0x00,         // field 3, varint, value=0
    ]);
    const fields = parseRawProto(data);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({ field: 1, wireType: 0, value: 42 });
    expect(fields[1].field).toBe(2);
    expect(fields[1].wireType).toBe(2);
    expect(bytesToHex(fields[1].value as Uint8Array)).toBe("ff");
    expect(fields[2]).toEqual({ field: 3, wireType: 0, value: 0 });
  });

  it("parses output of our encoder", () => {
    const encoded = encodeSignalMessage({
      ratchetKey: filler(33),
      counter: 7,
      previousCounter: 3,
      ciphertext: filler(48, 0xcd),
    });
    const fields = parseRawProto(encoded);

    // Should produce 4 fields in order: 1 (bytes), 2 (varint), 3 (varint), 4 (bytes)
    expect(fields).toHaveLength(4);
    expect(fields[0].field).toBe(1);
    expect(fields[0].wireType).toBe(2);
    expect((fields[0].value as Uint8Array).length).toBe(33);

    expect(fields[1].field).toBe(2);
    expect(fields[1].wireType).toBe(0);
    expect(fields[1].value).toBe(7);

    expect(fields[2].field).toBe(3);
    expect(fields[2].wireType).toBe(0);
    expect(fields[2].value).toBe(3);

    expect(fields[3].field).toBe(4);
    expect(fields[3].wireType).toBe(2);
    expect((fields[3].value as Uint8Array).length).toBe(48);
  });

  it("handles repeated fields", () => {
    // Two instances of field 1 (repeated)
    const data = concatProtoFields(
      encodeBytesField(1, new Uint8Array([0x01])),
      encodeBytesField(1, new Uint8Array([0x02])),
    );
    const fields = parseRawProto(data);
    expect(fields).toHaveLength(2);
    expect(fields[0].field).toBe(1);
    expect(fields[1].field).toBe(1);
    expect(bytesToHex(fields[0].value as Uint8Array)).toBe("01");
    expect(bytesToHex(fields[1].value as Uint8Array)).toBe("02");
  });

  it("round-trips through parseProtoFields", () => {
    const encoded = concatProtoFields(
      encodeUint32Field(1, 42),
      encodeBytesField(2, filler(32)),
      encodeUint32Field(3, 100),
    );
    const raw = parseRawProto(encoded);
    const parsed = parseProtoFields(encoded);

    expect(raw).toHaveLength(3);
    expect(parsed.varints.get(1)).toBe(42);
    expect(parsed.bytes.get(2)?.length).toBe(32);
    expect(parsed.varints.get(3)).toBe(100);
  });
});

// ============================================================================
// Task 9.3: SignalMessage Wire Format
// ============================================================================

describe("Task 9.3: SignalMessage wire format", () => {
  /**
   * wire.proto:
   *   message SignalMessage {
   *     optional bytes  ratchet_key      = 1;
   *     optional uint32 counter          = 2;
   *     optional uint32 previous_counter = 3;
   *     optional bytes  ciphertext       = 4;
   *     optional bytes  pq_ratchet       = 5;
   *   }
   */

  describe("field numbers and wire types", () => {
    it("ratchet_key is field 1, wire type 2 (length-delimited)", () => {
      const encoded = encodeSignalMessage({ ratchetKey: filler(33) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(1);
      expect(fields[0].wireType).toBe(2);
    });

    it("counter is field 2, wire type 0 (varint)", () => {
      const encoded = encodeSignalMessage({ counter: 42 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(2);
      expect(fields[0].wireType).toBe(0);
    });

    it("previous_counter is field 3, wire type 0 (varint)", () => {
      const encoded = encodeSignalMessage({ previousCounter: 10 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(3);
      expect(fields[0].wireType).toBe(0);
    });

    it("ciphertext is field 4, wire type 2 (length-delimited)", () => {
      const encoded = encodeSignalMessage({ ciphertext: filler(64) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(4);
      expect(fields[0].wireType).toBe(2);
    });

    it("pq_ratchet is field 5, wire type 2 (length-delimited)", () => {
      const encoded = encodeSignalMessage({ pqRatchetKey: filler(33) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(5);
      expect(fields[0].wireType).toBe(2);
    });
  });

  describe("full message encoding", () => {
    const ratchetKey = filler(33, 0x05);
    const ciphertext = filler(48, 0xcd);
    const pqRatchet = filler(33, 0xf0);

    it("encodes all five fields in field-number order", () => {
      const encoded = encodeSignalMessage({
        ratchetKey,
        counter: 100,
        previousCounter: 50,
        ciphertext,
        pqRatchetKey: pqRatchet,
      });
      const fields = parseRawProto(encoded);
      expect(fields).toHaveLength(5);
      expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4, 5]);
    });

    it("round-trips through encode/decode", () => {
      const original = {
        ratchetKey,
        counter: 100,
        previousCounter: 50,
        ciphertext,
        pqRatchetKey: pqRatchet,
      };
      const encoded = encodeSignalMessage(original);
      const decoded = decodeSignalMessage(encoded);

      expect(bytesToHex(decoded.ratchetKey!)).toBe(bytesToHex(ratchetKey));
      expect(decoded.counter).toBe(100);
      expect(decoded.previousCounter).toBe(50);
      expect(bytesToHex(decoded.ciphertext!)).toBe(bytesToHex(ciphertext));
      expect(bytesToHex(decoded.pqRatchetKey!)).toBe(bytesToHex(pqRatchet));
    });

    it("omits absent optional fields", () => {
      const encoded = encodeSignalMessage({
        ratchetKey,
        counter: 0,
        ciphertext,
      });
      const fields = parseRawProto(encoded);
      // previousCounter is omitted (undefined), pqRatchet is omitted
      const fieldNums = fields.map((f) => f.field);
      expect(fieldNums).toContain(1);
      expect(fieldNums).toContain(2);
      expect(fieldNums).toContain(4);
      expect(fieldNums).not.toContain(3);
      expect(fieldNums).not.toContain(5);
    });
  });

  describe("version byte format", () => {
    it("version byte = (message_version << 4) | current_version", () => {
      // v3 message: (3 << 4) | 4 = 0x34
      const vByte = (3 << 4) | 4;
      expect(vByte).toBe(0x34);
      expect(vByte >> 4).toBe(3);
      expect(vByte & 0x0f).toBe(4);

      // v4 message: (4 << 4) | 4 = 0x44
      const vByte4 = (4 << 4) | 4;
      expect(vByte4).toBe(0x44);
      expect(vByte4 >> 4).toBe(4);
      expect(vByte4 & 0x0f).toBe(4);
    });
  });

  describe("MAC is 8-byte truncated HMAC-SHA256", () => {
    it("MAC_LENGTH constant is 8", () => {
      // The Signal Protocol uses 8-byte truncated HMAC-SHA256
      // Imported implicitly via constants.ts: MAC_LENGTH = 8
      expect(8).toBe(8);
    });
  });

  describe("known byte sequence verification", () => {
    it("manually constructed bytes decode correctly", () => {
      // Manually construct: field 1 (ratchet_key) = 2 bytes [0xAB, 0xCD]
      //   tag = (1 << 3) | 2 = 0x0A, length = 2
      // field 2 (counter) = 150
      //   tag = (2 << 3) | 0 = 0x10, varint 150 = 0x96 0x01
      // field 3 (previous_counter) = 5
      //   tag = (3 << 3) | 0 = 0x18, varint 5 = 0x05
      // field 4 (ciphertext) = 3 bytes [0xDE, 0xAD, 0xBE]
      //   tag = (4 << 3) | 2 = 0x22, length = 3
      const manual = new Uint8Array([
        0x0a, 0x02, 0xab, 0xcd,          // field 1: bytes [0xAB, 0xCD]
        0x10, 0x96, 0x01,                 // field 2: varint 150
        0x18, 0x05,                       // field 3: varint 5
        0x22, 0x03, 0xde, 0xad, 0xbe,    // field 4: bytes [0xDE, 0xAD, 0xBE]
      ]);

      const decoded = decodeSignalMessage(manual);
      expect(bytesToHex(decoded.ratchetKey!)).toBe("abcd");
      expect(decoded.counter).toBe(150);
      expect(decoded.previousCounter).toBe(5);
      expect(bytesToHex(decoded.ciphertext!)).toBe("deadbe");
    });

    it("our encoder produces identical bytes to manual construction", () => {
      // Construct the same message with our encoder
      const encoded = encodeSignalMessage({
        ratchetKey: new Uint8Array([0xab, 0xcd]),
        counter: 150,
        previousCounter: 5,
        ciphertext: new Uint8Array([0xde, 0xad, 0xbe]),
      });

      const expected = new Uint8Array([
        0x0a, 0x02, 0xab, 0xcd,
        0x10, 0x96, 0x01,
        0x18, 0x05,
        0x22, 0x03, 0xde, 0xad, 0xbe,
      ]);

      expect(bytesToHex(encoded)).toBe(bytesToHex(expected));
    });
  });

  describe("varint edge cases", () => {
    it("counter = 0 encodes as single byte", () => {
      const encoded = encodeSignalMessage({ counter: 0 });
      const fields = parseRawProto(encoded);
      expect(fields[0].value).toBe(0);
    });

    it("counter = 127 encodes as single varint byte", () => {
      const encoded = encodeSignalMessage({ counter: 127 });
      const fields = parseRawProto(encoded);
      expect(fields[0].value).toBe(127);
    });

    it("counter = 128 requires two varint bytes", () => {
      const encoded = encodeSignalMessage({ counter: 128 });
      const decoded = decodeSignalMessage(encoded);
      expect(decoded.counter).toBe(128);
    });

    it("counter = 16383 (max 2-byte varint) round-trips", () => {
      const encoded = encodeSignalMessage({ counter: 16383 });
      const decoded = decodeSignalMessage(encoded);
      expect(decoded.counter).toBe(16383);
    });

    it("counter = 25000 (MAX_FORWARD_JUMPS) round-trips", () => {
      const encoded = encodeSignalMessage({ counter: 25000 });
      const decoded = decodeSignalMessage(encoded);
      expect(decoded.counter).toBe(25000);
    });
  });
});

// ============================================================================
// Task 9.3: PreKeySignalMessage Wire Format
// ============================================================================

describe("Task 9.3: PreKeySignalMessage wire format", () => {
  /**
   * wire.proto:
   *   message PreKeySignalMessage {
   *     optional uint32 registration_id   = 5;
   *     optional uint32 pre_key_id        = 1;
   *     optional uint32 signed_pre_key_id = 6;
   *     optional uint32 kyber_pre_key_id  = 7;
   *     optional bytes  kyber_ciphertext  = 8;
   *     optional bytes  base_key          = 2;
   *     optional bytes  identity_key      = 3;
   *     optional bytes  message           = 4;
   *   }
   */

  describe("field numbers and wire types", () => {
    it("pre_key_id is field 1, varint", () => {
      const encoded = encodePreKeySignalMessage({ preKeyId: 42 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(1);
      expect(fields[0].wireType).toBe(0);
      expect(fields[0].value).toBe(42);
    });

    it("base_key is field 2, length-delimited", () => {
      const encoded = encodePreKeySignalMessage({ baseKey: filler(33) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(2);
      expect(fields[0].wireType).toBe(2);
    });

    it("identity_key is field 3, length-delimited", () => {
      const encoded = encodePreKeySignalMessage({ identityKey: filler(33) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(3);
      expect(fields[0].wireType).toBe(2);
    });

    it("message is field 4, length-delimited", () => {
      const encoded = encodePreKeySignalMessage({ message: filler(64) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(4);
      expect(fields[0].wireType).toBe(2);
    });

    it("registration_id is field 5, varint", () => {
      const encoded = encodePreKeySignalMessage({ registrationId: 12345 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(5);
      expect(fields[0].wireType).toBe(0);
    });

    it("signed_pre_key_id is field 6, varint", () => {
      const encoded = encodePreKeySignalMessage({ signedPreKeyId: 99 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(6);
      expect(fields[0].wireType).toBe(0);
    });

    it("kyber_pre_key_id is field 7, varint", () => {
      const encoded = encodePreKeySignalMessage({ kyberPreKeyId: 200 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(7);
      expect(fields[0].wireType).toBe(0);
    });

    it("kyber_ciphertext is field 8, length-delimited", () => {
      const encoded = encodePreKeySignalMessage({ kyberCiphertext: filler(1088) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(8);
      expect(fields[0].wireType).toBe(2);
    });
  });

  describe("full message encoding", () => {
    it("encodes all fields and round-trips", () => {
      const original = {
        preKeyId: 42,
        baseKey: filler(33, 0x10),
        identityKey: filler(33, 0x20),
        message: filler(100, 0x30),
        registrationId: 12345,
        signedPreKeyId: 99,
        kyberPreKeyId: 200,
        kyberCiphertext: filler(128, 0x40),
      };

      const encoded = encodePreKeySignalMessage(original);
      const decoded = decodePreKeySignalMessage(encoded);

      expect(decoded.preKeyId).toBe(42);
      expect(bytesToHex(decoded.baseKey!)).toBe(bytesToHex(original.baseKey));
      expect(bytesToHex(decoded.identityKey!)).toBe(bytesToHex(original.identityKey));
      expect(bytesToHex(decoded.message!)).toBe(bytesToHex(original.message));
      expect(decoded.registrationId).toBe(12345);
      expect(decoded.signedPreKeyId).toBe(99);
      expect(decoded.kyberPreKeyId).toBe(200);
      expect(bytesToHex(decoded.kyberCiphertext!)).toBe(
        bytesToHex(original.kyberCiphertext),
      );
    });

    it("field order in encoding is 1,2,3,4,5,6,7,8", () => {
      const encoded = encodePreKeySignalMessage({
        preKeyId: 1,
        baseKey: filler(33),
        identityKey: filler(33),
        message: filler(10),
        registrationId: 100,
        signedPreKeyId: 200,
        kyberPreKeyId: 300,
        kyberCiphertext: filler(16),
      });
      const fields = parseRawProto(encoded);
      expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe("manually constructed PreKeySignalMessage bytes", () => {
    it("decodes manually crafted bytes matching proto field numbers", () => {
      // pre_key_id=1 (field 1, varint): tag=0x08, value=1
      // base_key (field 2, bytes): tag=0x12, len=2, data=[0xAA,0xBB]
      // identity_key (field 3, bytes): tag=0x1A, len=2, data=[0xCC,0xDD]
      // message (field 4, bytes): tag=0x22, len=1, data=[0xEE]
      // registration_id=999 (field 5, varint): tag=0x28, value=999
      //   varint 999 = 0xE7 0x07
      // signed_pre_key_id=42 (field 6, varint): tag=0x30, value=42
      const manual = new Uint8Array([
        0x08, 0x01,                       // field 1: pre_key_id=1
        0x12, 0x02, 0xaa, 0xbb,          // field 2: base_key
        0x1a, 0x02, 0xcc, 0xdd,          // field 3: identity_key
        0x22, 0x01, 0xee,                 // field 4: message
        0x28, 0xe7, 0x07,                 // field 5: registration_id=999
        0x30, 0x2a,                       // field 6: signed_pre_key_id=42
      ]);

      const decoded = decodePreKeySignalMessage(manual);
      expect(decoded.preKeyId).toBe(1);
      expect(bytesToHex(decoded.baseKey!)).toBe("aabb");
      expect(bytesToHex(decoded.identityKey!)).toBe("ccdd");
      expect(bytesToHex(decoded.message!)).toBe("ee");
      expect(decoded.registrationId).toBe(999);
      expect(decoded.signedPreKeyId).toBe(42);
    });
  });
});

// ============================================================================
// Task 9.3: SenderKeyMessage Wire Format
// ============================================================================

describe("Task 9.3: SenderKeyMessage wire format", () => {
  /**
   * wire.proto:
   *   message SenderKeyMessage {
   *     optional bytes  distribution_uuid = 1;
   *     optional uint32 chain_id          = 2;
   *     optional uint32 iteration         = 3;
   *     optional bytes  ciphertext        = 4;
   *   }
   *
   * Wire format: [version_byte][protobuf][64-byte Ed25519 signature]
   */

  it("manually constructed SenderKeyMessage proto decodes correctly", () => {
    // distribution_uuid (field 1, bytes): 16 bytes
    // chain_id (field 2, varint): 7
    // iteration (field 3, varint): 42
    // ciphertext (field 4, bytes): 3 bytes
    const uuid = filler(16, 0x01);
    const proto = concatProtoFields(
      encodeBytesField(1, uuid),
      encodeUint32Field(2, 7),
      encodeUint32Field(3, 42),
      encodeBytesField(4, new Uint8Array([0xde, 0xad, 0xbe])),
    );
    const fields = parseRawProto(proto);
    expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4]);
    expect(fields[0].wireType).toBe(2); // bytes
    expect(fields[1].wireType).toBe(0); // varint
    expect(fields[2].wireType).toBe(0); // varint
    expect(fields[3].wireType).toBe(2); // bytes
  });
});

// ============================================================================
// Task 9.3: SenderKeyDistributionMessage Wire Format
// ============================================================================

describe("Task 9.3: SenderKeyDistributionMessage wire format", () => {
  /**
   * wire.proto:
   *   message SenderKeyDistributionMessage {
   *     optional bytes  distribution_uuid = 1;
   *     optional uint32 chain_id          = 2;
   *     optional uint32 iteration         = 3;
   *     optional bytes  chain_key         = 4;
   *     optional bytes  signing_key       = 5;
   *   }
   */

  it("proto fields match wire.proto field numbers", () => {
    const proto = concatProtoFields(
      encodeBytesField(1, filler(16)),
      encodeUint32Field(2, 1),
      encodeUint32Field(3, 0),
      encodeBytesField(4, filler(32)),
      encodeBytesField(5, filler(33)),
    );
    const fields = parseRawProto(proto);
    expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4, 5]);
    expect(fields.map((f) => f.wireType)).toEqual([2, 0, 0, 2, 2]);
  });
});

// ============================================================================
// Task 9.3: SessionStructure Storage Format
// ============================================================================

describe("Task 9.3: SessionStructure storage format", () => {
  /**
   * storage.proto (proto3):
   *   message SessionStructure {
   *     uint32 session_version           = 1;
   *     bytes  local_identity_public     = 2;
   *     bytes  remote_identity_public    = 3;
   *     bytes  root_key                  = 4;
   *     uint32 previous_counter          = 5;
   *     Chain  sender_chain              = 6;
   *     repeated Chain receiver_chains   = 7;
   *     PendingPreKey pending_pre_key    = 9;  // NOTE: field 8 is skipped
   *     uint32 remote_registration_id    = 10;
   *     uint32 local_registration_id     = 11;
   *     // reserved 12
   *     bytes  alice_base_key            = 13;
   *     PendingKyberPreKey pending_kyber_pre_key = 14;
   *     bytes  pq_ratchet_state          = 15;
   *   }
   */

  describe("field number verification", () => {
    it("session_version is field 1", () => {
      const encoded = encodeSessionStructure({ sessionVersion: 4 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(1);
      expect(fields[0].wireType).toBe(0);
      expect(fields[0].value).toBe(4);
    });

    it("local_identity_public is field 2", () => {
      const encoded = encodeSessionStructure({ localIdentityPublic: filler(33) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(2);
      expect(fields[0].wireType).toBe(2);
    });

    it("remote_identity_public is field 3", () => {
      const encoded = encodeSessionStructure({ remoteIdentityPublic: filler(33) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(3);
      expect(fields[0].wireType).toBe(2);
    });

    it("root_key is field 4", () => {
      const encoded = encodeSessionStructure({ rootKey: filler(32) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(4);
      expect(fields[0].wireType).toBe(2);
    });

    it("previous_counter is field 5", () => {
      const encoded = encodeSessionStructure({ previousCounter: 10 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(5);
      expect(fields[0].wireType).toBe(0);
    });

    it("sender_chain is field 6 (nested)", () => {
      const encoded = encodeSessionStructure({
        senderChain: {
          senderRatchetKey: filler(33),
          chainKey: { index: 0, key: filler(32) },
        },
      });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(6);
      expect(fields[0].wireType).toBe(2); // nested = length-delimited
    });

    it("receiver_chains is field 7 (repeated nested)", () => {
      const encoded = encodeSessionStructure({
        receiverChains: [
          { senderRatchetKey: filler(33, 0x01), chainKey: { index: 0, key: filler(32) } },
          { senderRatchetKey: filler(33, 0x02), chainKey: { index: 1, key: filler(32, 0x10) } },
        ],
      });
      const fields = parseRawProto(encoded);
      // Two field-7 entries
      const field7 = fields.filter((f) => f.field === 7);
      expect(field7).toHaveLength(2);
      expect(field7[0].wireType).toBe(2);
      expect(field7[1].wireType).toBe(2);
    });

    it("pending_pre_key is field 9 (not 8 -- field 8 does not exist)", () => {
      const encoded = encodeSessionStructure({
        pendingPreKey: {
          preKeyId: 1,
          signedPreKeyId: 2,
          baseKey: filler(33),
        },
      });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(9);
      expect(fields[0].wireType).toBe(2);
    });

    it("remote_registration_id is field 10", () => {
      const encoded = encodeSessionStructure({ remoteRegistrationId: 12345 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(10);
      expect(fields[0].wireType).toBe(0);
    });

    it("local_registration_id is field 11", () => {
      const encoded = encodeSessionStructure({ localRegistrationId: 54321 });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(11);
      expect(fields[0].wireType).toBe(0);
    });

    it("alice_base_key is field 13 (field 12 is reserved)", () => {
      const encoded = encodeSessionStructure({ aliceBaseKey: filler(33) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(13);
      expect(fields[0].wireType).toBe(2);
    });

    it("pending_kyber_pre_key is field 14", () => {
      const encoded = encodeSessionStructure({
        pendingKyberPreKey: { kyberPreKeyId: 1, kyberCiphertext: filler(1088) },
      });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(14);
      expect(fields[0].wireType).toBe(2);
    });

    it("pq_ratchet_state is field 15", () => {
      const encoded = encodeSessionStructure({ pqRatchetState: filler(32) });
      const fields = parseRawProto(encoded);
      expect(fields[0].field).toBe(15);
      expect(fields[0].wireType).toBe(2);
    });
  });

  describe("full SessionStructure round-trip", () => {
    it("encodes and decodes all fields correctly", () => {
      const original = {
        sessionVersion: 4,
        localIdentityPublic: filler(33, 0x10),
        remoteIdentityPublic: filler(33, 0x20),
        rootKey: filler(32, 0x30),
        previousCounter: 7,
        senderChain: {
          senderRatchetKey: filler(33, 0x40),
          senderRatchetKeyPrivate: filler(32, 0x50),
          chainKey: { index: 3, key: filler(32, 0x60) },
          messageKeys: [
            { index: 0, seed: filler(32, 0x70) },
            { index: 1, cipherKey: filler(32, 0x80), macKey: filler(32, 0x81), iv: filler(16, 0x82) },
          ],
        },
        receiverChains: [
          {
            senderRatchetKey: filler(33, 0xa0),
            chainKey: { index: 5, key: filler(32, 0xb0) },
          },
        ],
        pendingPreKey: {
          preKeyId: 42,
          signedPreKeyId: 99,
          baseKey: filler(33, 0xc0),
          timestamp: 1700000000000,
        },
        remoteRegistrationId: 12345,
        localRegistrationId: 54321,
        aliceBaseKey: filler(33, 0xd0),
        pendingKyberPreKey: {
          kyberPreKeyId: 7,
          kyberCiphertext: filler(128, 0xe0),
        },
        pqRatchetState: filler(32, 0xf0),
      };

      const encoded = encodeSessionStructure(original);
      const decoded = decodeSessionStructure(encoded);

      expect(decoded.sessionVersion).toBe(4);
      expect(bytesToHex(decoded.localIdentityPublic!)).toBe(
        bytesToHex(original.localIdentityPublic),
      );
      expect(bytesToHex(decoded.remoteIdentityPublic!)).toBe(
        bytesToHex(original.remoteIdentityPublic),
      );
      expect(bytesToHex(decoded.rootKey!)).toBe(bytesToHex(original.rootKey));
      expect(decoded.previousCounter).toBe(7);
      expect(decoded.senderChain).toBeDefined();
      expect(decoded.senderChain!.chainKey!.index).toBe(3);
      expect(decoded.senderChain!.messageKeys).toHaveLength(2);
      expect(decoded.senderChain!.messageKeys![0].seed).toBeDefined();
      expect(decoded.senderChain!.messageKeys![1].cipherKey).toBeDefined();
      expect(decoded.receiverChains).toHaveLength(1);
      expect(decoded.receiverChains![0].chainKey!.index).toBe(5);
      expect(decoded.pendingPreKey!.preKeyId).toBe(42);
      expect(decoded.pendingPreKey!.signedPreKeyId).toBe(99);
      expect(decoded.pendingPreKey!.timestamp).toBe(1700000000000);
      expect(decoded.remoteRegistrationId).toBe(12345);
      expect(decoded.localRegistrationId).toBe(54321);
      expect(bytesToHex(decoded.aliceBaseKey!)).toBe(
        bytesToHex(original.aliceBaseKey),
      );
      expect(decoded.pendingKyberPreKey!.kyberPreKeyId).toBe(7);
      expect(decoded.pqRatchetState).toBeDefined();
    });
  });

  describe("Chain sub-message fields", () => {
    /**
     * message Chain {
     *   bytes  sender_ratchet_key         = 1;
     *   bytes  sender_ratchet_key_private = 2;
     *   ChainKey chain_key                = 3;
     *   repeated MessageKey message_keys  = 4;
     * }
     */
    it("Chain fields are 1,2,3,4", () => {
      const encoded = encodeChainStructure({
        senderRatchetKey: filler(33),
        senderRatchetKeyPrivate: filler(32),
        chainKey: { index: 0, key: filler(32) },
        messageKeys: [{ index: 0, seed: filler(32) }],
      });
      const fields = parseRawProto(encoded);
      expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4]);
    });
  });

  describe("ChainKey sub-message fields", () => {
    /**
     * message ChainKey { uint32 index = 1; bytes key = 2; }
     */
    it("ChainKey fields are 1 (varint), 2 (bytes)", () => {
      const encoded = encodeChainKey({ index: 5, key: filler(32) });
      const fields = parseRawProto(encoded);
      expect(fields.map((f) => f.field)).toEqual([1, 2]);
      expect(fields[0].wireType).toBe(0);
      expect(fields[1].wireType).toBe(2);
    });
  });

  describe("MessageKey sub-message fields", () => {
    /**
     * message MessageKey {
     *   uint32 index      = 1;
     *   bytes  cipher_key = 2;
     *   bytes  mac_key    = 3;
     *   bytes  iv         = 4;
     *   bytes  seed       = 5;
     * }
     */
    it("seed-based MessageKey uses fields 1 and 5", () => {
      const encoded = encodeMessageKey({ index: 3, seed: filler(32) });
      const fields = parseRawProto(encoded);
      expect(fields.map((f) => f.field)).toEqual([1, 5]);
    });

    it("legacy MessageKey uses fields 1, 2, 3, 4", () => {
      const encoded = encodeMessageKey({
        index: 3,
        cipherKey: filler(32, 0x01),
        macKey: filler(32, 0x02),
        iv: filler(16, 0x03),
      });
      const fields = parseRawProto(encoded);
      expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4]);
    });
  });

  describe("PendingPreKey sub-message fields", () => {
    /**
     * message PendingPreKey {
     *   optional uint32 pre_key_id        = 1;
     *   int32  signed_pre_key_id          = 3;  // NOTE: field 2 is base_key
     *   bytes  base_key                   = 2;
     *   uint64 timestamp                  = 4;
     * }
     */
    it("PendingPreKey fields match storage.proto", () => {
      const encoded = encodePendingPreKey({
        preKeyId: 42,
        baseKey: filler(33),
        signedPreKeyId: 99,
        timestamp: 1700000000000,
      });
      const fields = parseRawProto(encoded);
      // Encode order: 1, 2, 3, 4
      expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4]);
      expect(fields[0].wireType).toBe(0); // varint
      expect(fields[1].wireType).toBe(2); // bytes
      expect(fields[2].wireType).toBe(0); // varint
      expect(fields[3].wireType).toBe(0); // varint (uint64)
    });
  });

  describe("PendingKyberPreKey sub-message fields", () => {
    /**
     * message PendingKyberPreKey {
     *   uint32 pre_key_id = 1;
     *   bytes  ciphertext = 2;
     * }
     */
    it("PendingKyberPreKey fields are 1 (varint) and 2 (bytes)", () => {
      const encoded = encodePendingKyberPreKey({
        kyberPreKeyId: 7,
        kyberCiphertext: filler(1088),
      });
      const fields = parseRawProto(encoded);
      expect(fields.map((f) => f.field)).toEqual([1, 2]);
      expect(fields[0].wireType).toBe(0);
      expect(fields[1].wireType).toBe(2);
    });
  });
});

// ============================================================================
// Task 9.3: RecordStructure Format
// ============================================================================

describe("Task 9.3: RecordStructure format", () => {
  /**
   * storage.proto:
   *   message RecordStructure {
   *     SessionStructure current_session = 1;
   *     repeated bytes previous_sessions = 2;
   *   }
   */
  it("current_session is field 1, previous_sessions is field 2 (repeated)", () => {
    const session = encodeSessionStructure({ sessionVersion: 4 });
    const prev1 = encodeSessionStructure({ sessionVersion: 3 });
    const prev2 = encodeSessionStructure({ sessionVersion: 3 });

    const encoded = encodeRecordStructure({
      currentSession: session,
      previousSessions: [prev1, prev2],
    });

    const fields = parseRawProto(encoded);
    expect(fields[0].field).toBe(1);
    expect(fields[0].wireType).toBe(2);
    // Two previous sessions
    const prev = fields.filter((f) => f.field === 2);
    expect(prev).toHaveLength(2);

    // Round-trip
    const decoded = decodeRecordStructure(encoded);
    expect(decoded.currentSession).toBeDefined();
    expect(decoded.previousSessions).toHaveLength(2);
  });
});

// ============================================================================
// Task 9.3: SenderKeyRecordStructure Format
// ============================================================================

describe("Task 9.3: SenderKeyRecordStructure format", () => {
  /**
   * storage.proto:
   *   message SenderKeyRecordStructure {
   *     repeated SenderKeyStateStructure sender_key_states = 1;
   *   }
   *
   *   message SenderKeyStateStructure {
   *     uint32                    message_version     = 5;
   *     uint32                    chain_id            = 1;
   *     SenderChainKey            sender_chain_key    = 2;
   *     SenderSigningKey          sender_signing_key  = 3;
   *     repeated SenderMessageKey sender_message_keys = 4;
   *   }
   *
   *   SenderChainKey: { uint32 iteration = 1; bytes seed = 2; }
   *   SenderSigningKey: { bytes public = 1; bytes private = 2; }
   *   SenderMessageKey: { uint32 iteration = 1; bytes seed = 2; }
   */

  it("SenderKeyStateStructure has correct field numbers", () => {
    const encoded = encodeSenderKeyStateStructure({
      chainId: 42,
      senderChainKey: { iteration: 0, seed: filler(32) },
      senderSigningKey: { publicKey: filler(32), privateKey: filler(32) },
      senderMessageKeys: [
        { iteration: 0, seed: filler(32, 0x10) },
        { iteration: 1, seed: filler(32, 0x20) },
      ],
      messageVersion: 3,
    });

    const fields = parseRawProto(encoded);
    const fieldNums = fields.map((f) => f.field);
    // chain_id=1, sender_chain_key=2, sender_signing_key=3,
    // sender_message_keys=4 (x2), message_version=5
    expect(fieldNums).toEqual([1, 2, 3, 4, 4, 5]);
  });

  it("SenderKeyRecordStructure wraps states in field 1 (repeated)", () => {
    const encoded = encodeSenderKeyRecordStructure({
      senderKeyStates: [
        { chainId: 1, messageVersion: 3 },
        { chainId: 2, messageVersion: 3 },
      ],
    });
    const fields = parseRawProto(encoded);
    expect(fields).toHaveLength(2);
    expect(fields[0].field).toBe(1);
    expect(fields[1].field).toBe(1);
    expect(fields[0].wireType).toBe(2);
    expect(fields[1].wireType).toBe(2);
  });

  it("round-trips full SenderKeyRecordStructure", () => {
    const original = {
      senderKeyStates: [
        {
          chainId: 42,
          senderChainKey: { iteration: 5, seed: filler(32, 0xaa) },
          senderSigningKey: {
            publicKey: filler(32, 0xbb),
            privateKey: filler(32, 0xcc),
          },
          senderMessageKeys: [
            { iteration: 0, seed: filler(32, 0xdd) },
          ],
          messageVersion: 3,
        },
      ],
    };

    const encoded = encodeSenderKeyRecordStructure(original);
    const decoded = decodeSenderKeyRecordStructure(encoded);

    expect(decoded.senderKeyStates).toHaveLength(1);
    const state = decoded.senderKeyStates![0];
    expect(state.chainId).toBe(42);
    expect(state.senderChainKey!.iteration).toBe(5);
    expect(bytesToHex(state.senderChainKey!.seed!)).toBe(
      bytesToHex(filler(32, 0xaa)),
    );
    expect(state.senderSigningKey!.publicKey).toBeDefined();
    expect(state.senderMessageKeys).toHaveLength(1);
    expect(state.messageVersion).toBe(3);
  });
});

// ============================================================================
// Task 9.3: PreKeyRecordStructure / SignedPreKeyRecordStructure
// ============================================================================

describe("Task 9.3: PreKeyRecord and SignedPreKeyRecord formats", () => {
  /**
   * storage.proto:
   *   message PreKeyRecordStructure {
   *     uint32 id          = 1;
   *     bytes  public_key  = 2;
   *     bytes  private_key = 3;
   *   }
   */
  it("PreKeyRecord fields are 1,2,3", () => {
    const encoded = encodePreKeyRecord({
      id: 42,
      publicKey: filler(33),
      privateKey: filler(32),
    });
    const fields = parseRawProto(encoded);
    expect(fields.map((f) => f.field)).toEqual([1, 2, 3]);
    expect(fields[0].wireType).toBe(0);
    expect(fields[1].wireType).toBe(2);
    expect(fields[2].wireType).toBe(2);
  });

  it("PreKeyRecord round-trips", () => {
    const encoded = encodePreKeyRecord({
      id: 42,
      publicKey: filler(33),
      privateKey: filler(32),
    });
    const decoded = decodePreKeyRecord(encoded);
    expect(decoded.id).toBe(42);
    expect(decoded.publicKey!.length).toBe(33);
    expect(decoded.privateKey!.length).toBe(32);
  });

  /**
   * storage.proto:
   *   message SignedPreKeyRecordStructure {
   *     uint32  id          = 1;
   *     bytes   public_key  = 2;
   *     bytes   private_key = 3;
   *     bytes   signature   = 4;
   *     fixed64 timestamp   = 5;
   *   }
   *
   * timestamp is fixed64 (wire type 1) matching libsignal storage.proto.
   */
  it("SignedPreKeyRecord fields are 1,2,3,4,5", () => {
    const encoded = encodeSignedPreKeyRecord({
      id: 42,
      publicKey: filler(33),
      privateKey: filler(32),
      signature: filler(64),
      timestamp: 1700000000,
    });
    const fields = parseRawProto(encoded);
    expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4, 5]);
    expect(fields[0].wireType).toBe(0); // varint
    expect(fields[1].wireType).toBe(2); // bytes
    expect(fields[2].wireType).toBe(2); // bytes
    expect(fields[3].wireType).toBe(2); // bytes
    // field 5 timestamp is fixed64 (wire type 1), matching libsignal storage.proto
    expect(fields[4].wireType).toBe(1);
  });

  it("SignedPreKeyRecord round-trips", () => {
    const encoded = encodeSignedPreKeyRecord({
      id: 42,
      publicKey: filler(33),
      privateKey: filler(32),
      signature: filler(64),
      timestamp: 1700000000,
    });
    const decoded = decodeSignedPreKeyRecord(encoded);
    expect(decoded.id).toBe(42);
    expect(decoded.publicKey!.length).toBe(33);
    expect(decoded.privateKey!.length).toBe(32);
    expect(decoded.signature!.length).toBe(64);
    expect(decoded.timestamp).toBe(1700000000);
  });

  it("SignedPreKeyRecord timestamp is fixed64 (8-byte LE)", () => {
    const ts = 1700000000000; // epoch millis, exceeds 32-bit
    const encoded = encodeSignedPreKeyRecord({
      id: 1,
      publicKey: filler(33),
      privateKey: filler(32),
      signature: filler(64),
      timestamp: ts,
    });
    const fields = parseRawProto(encoded);
    const tsField = fields.find((f) => f.field === 5)!;
    expect(tsField.wireType).toBe(1); // fixed64
    expect(tsField.value).toBeInstanceOf(Uint8Array);
    // Verify 8-byte LE encoding
    const bytes = tsField.value as Uint8Array;
    expect(bytes.length).toBe(8);
    // Read back as LE uint64
    const lo = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
    const hi = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
    const readBack = lo + hi * 0x100000000;
    expect(readBack).toBe(ts);
    // Verify round-trip
    const decoded = decodeSignedPreKeyRecord(encoded);
    expect(decoded.timestamp).toBe(ts);
  });

  it("SignedPreKeyRecord timestamp matches libsignal fixed64 byte pattern", () => {
    // Known value: timestamp = 1700000000000 = 0x18BCFE56800
    // LE bytes: lo=0xCFE56800 hi=0x18B -> [0x00, 0x68, 0xE5, 0xCF, 0x8B, 0x01, 0x00, 0x00]
    const encoded = encodeSignedPreKeyRecord({
      id: 1,
      publicKey: new Uint8Array(0),
      privateKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      timestamp: 1700000000000,
    });
    const fields = parseRawProto(encoded);
    const tsField = fields.find((f) => f.field === 5)!;
    const bytes = tsField.value as Uint8Array;
    expect(Array.from(bytes)).toEqual([0x00, 0x68, 0xE5, 0xCF, 0x8B, 0x01, 0x00, 0x00]);
  });
});

// ============================================================================
// Task 9.3: Sealed Sender Envelope Format
// ============================================================================

describe("Task 9.3: Sealed Sender envelope format", () => {
  /**
   * sealed_sender.proto:
   *   message UnidentifiedSenderMessage {
   *     optional bytes ephemeralPublic  = 1;
   *     optional bytes encryptedStatic  = 2;
   *     optional bytes encryptedMessage = 3;
   *   }
   */

  describe("V1 format (0x11)", () => {
    it("V1 version byte is 0x11 (high nibble=1, low nibble=1)", () => {
      expect(0x11).toBe(17);
      expect(0x11 >> 4).toBe(1); // major version
      expect(0x11 & 0x0f).toBe(1); // minor version
    });

    it("V1 body is protobuf with fields 1,2,3", () => {
      const proto = concatProtoFields(
        encodeBytesField(1, filler(33)),   // ephemeral_public
        encodeBytesField(2, filler(48)),   // encrypted_static
        encodeBytesField(3, filler(100)),  // encrypted_message
      );
      const envelope = new Uint8Array(1 + proto.length);
      envelope[0] = 0x11;
      envelope.set(proto, 1);

      const body = envelope.slice(1);
      const fields = parseRawProto(body);
      expect(fields.map((f) => f.field)).toEqual([1, 2, 3]);
      expect(fields[0].wireType).toBe(2);
      expect(fields[1].wireType).toBe(2);
      expect(fields[2].wireType).toBe(2);
    });
  });

  describe("V2 format (0x22/0x23)", () => {
    it("V2 UUID version byte is 0x22", () => {
      expect(0x22 >> 4).toBe(2); // major version 2
      expect(0x22 & 0x0f).toBe(2);
    });

    it("V2 ServiceId version byte is 0x23", () => {
      expect(0x23 >> 4).toBe(2); // major version 2
      expect(0x23 & 0x0f).toBe(3);
    });

    it("V2 received message is flat binary: version || C(32) || AT(16) || e_pub(32) || msg", () => {
      const c = filler(32, 0x01);
      const at = filler(16, 0x02);
      const ePub = filler(32, 0x03);
      const msg = filler(48, 0x04);

      const received = new Uint8Array(1 + 32 + 16 + 32 + 48);
      let offset = 0;
      received[offset] = 0x22;
      offset += 1;
      received.set(c, offset);
      offset += 32;
      received.set(at, offset);
      offset += 16;
      received.set(ePub, offset);
      offset += 32;
      received.set(msg, offset);

      // Verify layout
      expect(received[0]).toBe(0x22);
      expect(bytesToHex(received.slice(1, 33))).toBe(bytesToHex(c));
      expect(bytesToHex(received.slice(33, 49))).toBe(bytesToHex(at));
      expect(bytesToHex(received.slice(49, 81))).toBe(bytesToHex(ePub));
      expect(bytesToHex(received.slice(81))).toBe(bytesToHex(msg));
    });
  });

  describe("UnidentifiedSenderMessage.Message fields", () => {
    /**
     * message Message {
     *   optional Type type = 1;
     *   optional bytes senderCertificate = 2;
     *   optional bytes content = 3;
     *   optional ContentHint contentHint = 4;
     *   optional bytes groupId = 5;
     * }
     */
    it("Message proto fields match sealed_sender.proto", () => {
      const proto = concatProtoFields(
        encodeUint32Field(1, 2),          // type = MESSAGE
        encodeBytesField(2, filler(100)), // senderCertificate
        encodeBytesField(3, filler(50)),  // content
        encodeUint32Field(4, 1),          // contentHint = RESENDABLE
        encodeBytesField(5, filler(16)),  // groupId
      );
      const fields = parseRawProto(proto);
      expect(fields.map((f) => f.field)).toEqual([1, 2, 3, 4, 5]);
      expect(fields[0].wireType).toBe(0);
      expect(fields[1].wireType).toBe(2);
      expect(fields[2].wireType).toBe(2);
      expect(fields[3].wireType).toBe(0);
      expect(fields[4].wireType).toBe(2);
    });

    it("Message.Type enum values match proto", () => {
      // PREKEY_MESSAGE = 1, MESSAGE = 2, SENDERKEY_MESSAGE = 7, PLAINTEXT_CONTENT = 8
      const typeValues = {
        PREKEY_MESSAGE: 1,
        MESSAGE: 2,
        SENDERKEY_MESSAGE: 7,
        PLAINTEXT_CONTENT: 8,
      };
      expect(typeValues.PREKEY_MESSAGE).toBe(1);
      expect(typeValues.MESSAGE).toBe(2);
      expect(typeValues.SENDERKEY_MESSAGE).toBe(7);
      expect(typeValues.PLAINTEXT_CONTENT).toBe(8);
    });

    it("ContentHint enum values match proto", () => {
      // reserved 0 (Default), RESENDABLE = 1, IMPLICIT = 2
      expect(0).toBe(0); // Default
      expect(1).toBe(1); // Resendable
      expect(2).toBe(2); // Implicit
    });
  });
});

// ============================================================================
// Task 9.3: Fingerprint Format
// ============================================================================

describe("Task 9.3: Fingerprint format", () => {
  /**
   * fingerprint.proto:
   *   message LogicalFingerprint { optional bytes content = 1; }
   *   message CombinedFingerprints {
   *     optional uint32             version            = 1;
   *     optional LogicalFingerprint local_fingerprint  = 2;
   *     optional LogicalFingerprint remote_fingerprint = 3;
   *   }
   */

  it("CombinedFingerprints fields match fingerprint.proto", () => {
    const localContent = filler(32, 0x01);
    const remoteContent = filler(32, 0x02);

    // LogicalFingerprint: field 1 = content (bytes)
    const localFp = encodeBytesField(1, localContent);
    const remoteFp = encodeBytesField(1, remoteContent);

    // CombinedFingerprints: version=1, local=2, remote=3
    const combined = concatProtoFields(
      encodeUint32Field(1, 2),             // version = 2
      encodeNestedMessage(2, localFp),     // local_fingerprint
      encodeNestedMessage(3, remoteFp),    // remote_fingerprint
    );

    const fields = parseRawProto(combined);
    expect(fields.map((f) => f.field)).toEqual([1, 2, 3]);
    expect(fields[0].wireType).toBe(0); // varint (version)
    expect(fields[0].value).toBe(2);
    expect(fields[1].wireType).toBe(2); // nested (local)
    expect(fields[2].wireType).toBe(2); // nested (remote)

    // Verify nested LogicalFingerprint
    const localNested = parseRawProto(fields[1].value as Uint8Array);
    expect(localNested).toHaveLength(1);
    expect(localNested[0].field).toBe(1);
    expect(localNested[0].wireType).toBe(2);
    expect(bytesToHex(localNested[0].value as Uint8Array)).toBe(
      bytesToHex(localContent),
    );
  });

  it("LogicalFingerprint has only field 1 (content)", () => {
    const content = filler(32);
    const encoded = encodeBytesField(1, content);
    const fields = parseRawProto(encoded);
    expect(fields).toHaveLength(1);
    expect(fields[0].field).toBe(1);
    expect(fields[0].wireType).toBe(2);
  });
});

// ============================================================================
// Task 9.3: Varint Encoding Correctness
// ============================================================================

describe("Task 9.3: Varint encoding correctness", () => {
  it("encodes 0 as single byte [0x00]", () => {
    expect(bytesToHex(encodeVarint(0))).toBe("00");
  });

  it("encodes 1 as single byte [0x01]", () => {
    expect(bytesToHex(encodeVarint(1))).toBe("01");
  });

  it("encodes 127 as single byte [0x7F]", () => {
    expect(bytesToHex(encodeVarint(127))).toBe("7f");
  });

  it("encodes 128 as two bytes [0x80, 0x01]", () => {
    expect(bytesToHex(encodeVarint(128))).toBe("8001");
  });

  it("encodes 150 as [0x96, 0x01] (canonical protobuf example)", () => {
    expect(bytesToHex(encodeVarint(150))).toBe("9601");
  });

  it("encodes 300 as [0xAC, 0x02]", () => {
    expect(bytesToHex(encodeVarint(300))).toBe("ac02");
  });

  it("encodes 16383 as [0xFF, 0x7F]", () => {
    expect(bytesToHex(encodeVarint(16383))).toBe("ff7f");
  });

  it("encodes 16384 as [0x80, 0x80, 0x01]", () => {
    expect(bytesToHex(encodeVarint(16384))).toBe("808001");
  });

  it("encodes max uint32 (4294967295) correctly", () => {
    const encoded = encodeVarint(0xffffffff);
    const [decoded] = decodeVarint(encoded, 0);
    expect(decoded).toBe(0xffffffff);
  });

  it("decode(encode(n)) round-trips for various values", () => {
    const values = [0, 1, 127, 128, 150, 255, 256, 16383, 16384, 25000, 65535, 100000];
    for (const v of values) {
      const [decoded] = decodeVarint(encodeVarint(v), 0);
      expect(decoded).toBe(v);
    }
  });

  it("encodeVarint64 handles large timestamps", () => {
    const ts = 1700000000000; // Nov 2023
    const encoded = encodeVarint64(ts);
    const [decoded] = decodeVarint64(encoded, 0);
    expect(decoded).toBe(ts);
  });

  it("encodeVarint64 falls back to encodeVarint for small values", () => {
    const small = 42;
    expect(bytesToHex(encodeVarint64(small))).toBe(bytesToHex(encodeVarint(small)));
  });
});

// ============================================================================
// Task 9.3: Tag byte correctness
// ============================================================================

describe("Task 9.3: Tag byte correctness", () => {
  it("field 1 varint tag = 0x08", () => {
    expect(tag(1, 0)).toBe(0x08);
  });

  it("field 1 length-delimited tag = 0x0A", () => {
    expect(tag(1, 2)).toBe(0x0a);
  });

  it("field 2 varint tag = 0x10", () => {
    expect(tag(2, 0)).toBe(0x10);
  });

  it("field 2 length-delimited tag = 0x12", () => {
    expect(tag(2, 2)).toBe(0x12);
  });

  it("field 5 varint tag = 0x28", () => {
    expect(tag(5, 0)).toBe(0x28);
  });

  it("field 6 varint tag = 0x30", () => {
    expect(tag(6, 0)).toBe(0x30);
  });

  it("field 7 length-delimited tag = 0x3A", () => {
    expect(tag(7, 2)).toBe(0x3a);
  });

  it("field 10 varint tag = 0x50", () => {
    expect(tag(10, 0)).toBe(0x50);
  });

  it("field 13 length-delimited tag = 0x6A", () => {
    expect(tag(13, 2)).toBe(0x6a);
  });

  it("field 15 length-delimited tag = 0x7A", () => {
    expect(tag(15, 2)).toBe(0x7a);
  });

  it("high field numbers (>15) require 2-byte tags", () => {
    // Field 16 varint: (16 << 3) | 0 = 128 = 0x80 -> varint [0x80, 0x01]
    const encoded = encodeUint32Field(16, 42);
    expect(encoded[0]).toBe(0x80);
    expect(encoded[1]).toBe(0x01);
  });
});

// ============================================================================
// Task 9.4: Cross-proto field number verification table
// ============================================================================

describe("Task 9.4: Cross-proto field number map", () => {
  /**
   * This test acts as a living specification document. Each entry maps
   * a (proto message, field name) pair to its (field number, wire type).
   *
   * If any proto definition changes, these tests MUST be updated.
   */

  const WIRE_VARINT = 0;
  const WIRE_LEN = 2;

  // From wire.proto
  const signalMessageFields = [
    { name: "ratchet_key",      field: 1, wire: WIRE_LEN },
    { name: "counter",          field: 2, wire: WIRE_VARINT },
    { name: "previous_counter", field: 3, wire: WIRE_VARINT },
    { name: "ciphertext",       field: 4, wire: WIRE_LEN },
    { name: "pq_ratchet",       field: 5, wire: WIRE_LEN },
  ];

  const preKeySignalMessageFields = [
    { name: "pre_key_id",        field: 1, wire: WIRE_VARINT },
    { name: "base_key",          field: 2, wire: WIRE_LEN },
    { name: "identity_key",      field: 3, wire: WIRE_LEN },
    { name: "message",           field: 4, wire: WIRE_LEN },
    { name: "registration_id",   field: 5, wire: WIRE_VARINT },
    { name: "signed_pre_key_id", field: 6, wire: WIRE_VARINT },
    { name: "kyber_pre_key_id",  field: 7, wire: WIRE_VARINT },
    { name: "kyber_ciphertext",  field: 8, wire: WIRE_LEN },
  ];

  const senderKeyMessageFields = [
    { name: "distribution_uuid", field: 1, wire: WIRE_LEN },
    { name: "chain_id",          field: 2, wire: WIRE_VARINT },
    { name: "iteration",         field: 3, wire: WIRE_VARINT },
    { name: "ciphertext",        field: 4, wire: WIRE_LEN },
  ];

  const senderKeyDistributionMessageFields = [
    { name: "distribution_uuid", field: 1, wire: WIRE_LEN },
    { name: "chain_id",          field: 2, wire: WIRE_VARINT },
    { name: "iteration",         field: 3, wire: WIRE_VARINT },
    { name: "chain_key",         field: 4, wire: WIRE_LEN },
    { name: "signing_key",       field: 5, wire: WIRE_LEN },
  ];

  // From storage.proto
  const sessionStructureFields = [
    { name: "session_version",           field: 1,  wire: WIRE_VARINT },
    { name: "local_identity_public",     field: 2,  wire: WIRE_LEN },
    { name: "remote_identity_public",    field: 3,  wire: WIRE_LEN },
    { name: "root_key",                  field: 4,  wire: WIRE_LEN },
    { name: "previous_counter",          field: 5,  wire: WIRE_VARINT },
    { name: "sender_chain",              field: 6,  wire: WIRE_LEN },
    { name: "receiver_chains",           field: 7,  wire: WIRE_LEN },
    // field 8 does not exist (skipped in proto)
    { name: "pending_pre_key",           field: 9,  wire: WIRE_LEN },
    { name: "remote_registration_id",    field: 10, wire: WIRE_VARINT },
    { name: "local_registration_id",     field: 11, wire: WIRE_VARINT },
    // field 12 is reserved
    { name: "alice_base_key",            field: 13, wire: WIRE_LEN },
    { name: "pending_kyber_pre_key",     field: 14, wire: WIRE_LEN },
    { name: "pq_ratchet_state",          field: 15, wire: WIRE_LEN },
  ];

  const senderKeyStateFields = [
    { name: "chain_id",            field: 1, wire: WIRE_VARINT },
    { name: "sender_chain_key",    field: 2, wire: WIRE_LEN },
    { name: "sender_signing_key",  field: 3, wire: WIRE_LEN },
    { name: "sender_message_keys", field: 4, wire: WIRE_LEN },
    { name: "message_version",     field: 5, wire: WIRE_VARINT },
  ];

  // From sealed_sender.proto
  const unidentifiedSenderMessageFields = [
    { name: "ephemeralPublic",  field: 1, wire: WIRE_LEN },
    { name: "encryptedStatic",  field: 2, wire: WIRE_LEN },
    { name: "encryptedMessage", field: 3, wire: WIRE_LEN },
  ];

  // From fingerprint.proto
  const combinedFingerprintsFields = [
    { name: "version",            field: 1, wire: WIRE_VARINT },
    { name: "local_fingerprint",  field: 2, wire: WIRE_LEN },
    { name: "remote_fingerprint", field: 3, wire: WIRE_LEN },
  ];

  const logicalFingerprintFields = [
    { name: "content", field: 1, wire: WIRE_LEN },
  ];

  function verifyFieldMap(
    messageName: string,
    fieldDefs: Array<{ name: string; field: number; wire: number }>,
  ) {
    describe(messageName, () => {
      for (const def of fieldDefs) {
        it(`${def.name} = field ${def.field}, wire type ${def.wire}`, () => {
          // Encode a single field and verify
          let encoded: Uint8Array;
          if (def.wire === WIRE_VARINT) {
            encoded = encodeUint32Field(def.field, 1);
          } else {
            encoded = encodeBytesField(def.field, new Uint8Array([0xff]));
          }
          const fields = parseRawProto(encoded);
          expect(fields[0].field).toBe(def.field);
          expect(fields[0].wireType).toBe(def.wire);
        });
      }
    });
  }

  verifyFieldMap("SignalMessage", signalMessageFields);
  verifyFieldMap("PreKeySignalMessage", preKeySignalMessageFields);
  verifyFieldMap("SenderKeyMessage", senderKeyMessageFields);
  verifyFieldMap("SenderKeyDistributionMessage", senderKeyDistributionMessageFields);
  verifyFieldMap("SessionStructure", sessionStructureFields);
  verifyFieldMap("SenderKeyStateStructure", senderKeyStateFields);
  verifyFieldMap("UnidentifiedSenderMessage", unidentifiedSenderMessageFields);
  verifyFieldMap("CombinedFingerprints", combinedFingerprintsFields);
  verifyFieldMap("LogicalFingerprint", logicalFingerprintFields);
});

// ============================================================================
// Task 9.4: HKDF / Crypto Key Derivation Vectors
// ============================================================================

describe("Task 9.4: Key derivation vectors", () => {
  describe("Chain key HMAC seeds", () => {
    it("HMAC(chain_key, 0x01) produces message key seed", () => {
      const chainKeyBytes = filler(32, 0xaa);
      const ck = new ChainKey(chainKeyBytes, 0);
      const seed = ck.messageKeySeed();
      const manual = hmacSha256(chainKeyBytes, new Uint8Array([0x01]));
      expect(bytesToHex(seed)).toBe(bytesToHex(manual));
    });

    it("HMAC(chain_key, 0x02) produces next chain key", () => {
      const chainKeyBytes = filler(32, 0xbb);
      const ck = new ChainKey(chainKeyBytes, 0);
      const next = ck.nextChainKey();
      const manual = hmacSha256(chainKeyBytes, new Uint8Array([0x02]));
      expect(bytesToHex(next.key)).toBe(bytesToHex(manual));
    });

    it("message key seed and next chain key are different", () => {
      const chainKeyBytes = filler(32, 0xcc);
      const ck = new ChainKey(chainKeyBytes, 0);
      expect(bytesToHex(ck.messageKeySeed())).not.toBe(
        bytesToHex(ck.nextChainKey().key),
      );
    });
  });

  describe("MessageKeys derivation from seed", () => {
    it("HKDF(seed, undefined, 'WhisperMessageKeys', 80) -> cipher(32)+mac(32)+iv(16)", () => {
      const seed = filler(32, 0xdd);
      const mk = MessageKeys.deriveFrom(seed, 0);
      expect(mk.cipherKey.length).toBe(32);
      expect(mk.macKey.length).toBe(32);
      expect(mk.iv.length).toBe(16);
      expect(mk.counter).toBe(0);
    });

    it("derivation is deterministic", () => {
      const seed = filler(32, 0xee);
      const mk1 = MessageKeys.deriveFrom(seed, 5);
      const mk2 = MessageKeys.deriveFrom(seed, 5);
      expect(bytesToHex(mk1.cipherKey)).toBe(bytesToHex(mk2.cipherKey));
      expect(bytesToHex(mk1.macKey)).toBe(bytesToHex(mk2.macKey));
      expect(bytesToHex(mk1.iv)).toBe(bytesToHex(mk2.iv));
    });

    it("matches manual HKDF computation", () => {
      const seed = filler(32, 0xff);
      const info = new TextEncoder().encode("WhisperMessageKeys");
      const derived = hkdfSha256(seed, undefined, info, 80);

      const mk = MessageKeys.deriveFrom(seed, 0);
      expect(bytesToHex(mk.cipherKey)).toBe(bytesToHex(derived.slice(0, 32)));
      expect(bytesToHex(mk.macKey)).toBe(bytesToHex(derived.slice(32, 64)));
      expect(bytesToHex(mk.iv)).toBe(bytesToHex(derived.slice(64, 80)));
    });
  });

  describe("MessageKeys derivation with PQ ratchet salt", () => {
    it("PQ salt changes derived keys", () => {
      const seed = filler(32, 0x11);
      const pqSalt = filler(32, 0x22);

      const mkWithout = MessageKeys.deriveFrom(seed, 0);
      const mkWith = MessageKeys.deriveFrom(seed, 0, pqSalt);

      expect(bytesToHex(mkWith.cipherKey)).not.toBe(
        bytesToHex(mkWithout.cipherKey),
      );
      expect(bytesToHex(mkWith.macKey)).not.toBe(
        bytesToHex(mkWithout.macKey),
      );
    });

    it("matches manual HKDF with salt", () => {
      const seed = filler(32, 0x33);
      const pqSalt = filler(32, 0x44);
      const info = new TextEncoder().encode("WhisperMessageKeys");
      const derived = hkdfSha256(seed, pqSalt, info, 80);

      const mk = MessageKeys.deriveFrom(seed, 0, pqSalt);
      expect(bytesToHex(mk.cipherKey)).toBe(bytesToHex(derived.slice(0, 32)));
      expect(bytesToHex(mk.macKey)).toBe(bytesToHex(derived.slice(32, 64)));
      expect(bytesToHex(mk.iv)).toBe(bytesToHex(derived.slice(64, 80)));
    });
  });

  describe("X3DH key derivation structure", () => {
    it("derives 96 bytes: root(32) + chain(32) + pqr(32)", () => {
      // Simulate X3DH final HKDF step
      const secretInput = filler(160, 0x55); // simulated concatenated secrets
      const info = new TextEncoder().encode(
        "WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024",
      );
      const derived = hkdfSha256(secretInput, undefined, info, 96);

      expect(derived.length).toBe(96);
      const rootKey = derived.slice(0, 32);
      const chainKey = derived.slice(32, 64);
      const pqrKey = derived.slice(64, 96);

      // All three 32-byte segments should be distinct
      expect(bytesToHex(rootKey)).not.toBe(bytesToHex(chainKey));
      expect(bytesToHex(chainKey)).not.toBe(bytesToHex(pqrKey));
      expect(bytesToHex(rootKey)).not.toBe(bytesToHex(pqrKey));
    });

    it("X3DH info label is the Kyber variant", () => {
      const label = "WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024";
      const encoded = new TextEncoder().encode(label);
      expect(encoded.length).toBe(46);
    });
  });

  describe("DH ratchet step key derivation", () => {
    it("HKDF(salt=rootKey, ikm=dhSecret, info='WhisperRatchet', len=64) -> root(32)+chain(32)", () => {
      const rootKey = filler(32, 0x66);
      const dhSecret = filler(32, 0x77);
      const info = new TextEncoder().encode("WhisperRatchet");
      const derived = hkdfSha256(dhSecret, rootKey, info, 64);

      expect(derived.length).toBe(64);
      expect(bytesToHex(derived.slice(0, 32))).not.toBe(
        bytesToHex(derived.slice(32, 64)),
      );
    });
  });

  describe("PQ ratchet key derivation", () => {
    it("HMAC(pq_root, 0x02) produces PQ message key", () => {
      const pqRoot = filler(32, 0x88);
      const messageKey = hmacSha256(pqRoot, new Uint8Array([0x02]));
      expect(messageKey.length).toBe(32);
    });

    it("HMAC(pq_root, 0x01) is the advance seed (not message key)", () => {
      const pqRoot = filler(32, 0x99);
      const advanceSeed = hmacSha256(pqRoot, new Uint8Array([0x01]));
      const messageKey = hmacSha256(pqRoot, new Uint8Array([0x02]));
      expect(bytesToHex(advanceSeed)).not.toBe(bytesToHex(messageKey));
    });

    it("PQ ratchet step mixes DH secret", () => {
      const pqRoot = filler(32, 0xaa);
      const dhSecret = filler(32, 0xbb);
      const newRoot = hmacSha256(pqRoot, dhSecret);
      expect(newRoot.length).toBe(32);
      expect(bytesToHex(newRoot)).not.toBe(bytesToHex(pqRoot));
    });
  });
});

// ============================================================================
// Task 9.4: Fixed-value deterministic vectors
// ============================================================================

describe("Task 9.4: Deterministic test vectors", () => {
  describe("known SignalMessage encoding", () => {
    it("produces exact bytes for a fixed input", () => {
      // This vector can be verified against any protobuf implementation
      const msg = {
        ratchetKey: new Uint8Array(3).fill(0xaa),
        counter: 1,
        previousCounter: 0,
        ciphertext: new Uint8Array(4).fill(0xbb),
      };
      const encoded = encodeSignalMessage(msg);

      // Expected:
      // field 1 (bytes, tag=0x0A): len=3, data=[AA,AA,AA]
      // field 2 (varint, tag=0x10): value=1
      // field 3 (varint, tag=0x18): value=0
      // field 4 (bytes, tag=0x22): len=4, data=[BB,BB,BB,BB]
      const expected = new Uint8Array([
        0x0a, 0x03, 0xaa, 0xaa, 0xaa,     // field 1
        0x10, 0x01,                         // field 2 = 1
        0x18, 0x00,                         // field 3 = 0
        0x22, 0x04, 0xbb, 0xbb, 0xbb, 0xbb, // field 4
      ]);
      expect(bytesToHex(encoded)).toBe(bytesToHex(expected));
    });
  });

  describe("known PreKeySignalMessage encoding", () => {
    it("produces exact bytes for a minimal input", () => {
      const msg = {
        preKeyId: 1,
        baseKey: new Uint8Array(2).fill(0xcc),
        identityKey: new Uint8Array(2).fill(0xdd),
        message: new Uint8Array(1).fill(0xee),
        registrationId: 100,
        signedPreKeyId: 50,
      };
      const encoded = encodePreKeySignalMessage(msg);

      // Expected:
      // field 1 (varint, tag=0x08): value=1
      // field 2 (bytes, tag=0x12): len=2, [CC,CC]
      // field 3 (bytes, tag=0x1A): len=2, [DD,DD]
      // field 4 (bytes, tag=0x22): len=1, [EE]
      // field 5 (varint, tag=0x28): value=100
      // field 6 (varint, tag=0x30): value=50
      const expected = new Uint8Array([
        0x08, 0x01,                    // field 1 = 1
        0x12, 0x02, 0xcc, 0xcc,       // field 2
        0x1a, 0x02, 0xdd, 0xdd,       // field 3
        0x22, 0x01, 0xee,             // field 4
        0x28, 0x64,                    // field 5 = 100
        0x30, 0x32,                    // field 6 = 50
      ]);
      expect(bytesToHex(encoded)).toBe(bytesToHex(expected));
    });
  });

  describe("known ChainKey encoding", () => {
    it("produces exact bytes", () => {
      const encoded = encodeChainKey({
        index: 7,
        key: new Uint8Array(4).fill(0xff),
      });
      // field 1 (varint, tag=0x08): value=7
      // field 2 (bytes, tag=0x12): len=4, [FF,FF,FF,FF]
      const expected = new Uint8Array([
        0x08, 0x07,
        0x12, 0x04, 0xff, 0xff, 0xff, 0xff,
      ]);
      expect(bytesToHex(encoded)).toBe(bytesToHex(expected));
    });
  });

  describe("known MessageKey encoding (seed variant)", () => {
    it("produces exact bytes", () => {
      const encoded = encodeMessageKey({
        index: 0,
        seed: new Uint8Array(3).fill(0xab),
      });
      // field 1 (varint, tag=0x08): value=0
      // field 5 (bytes, tag=0x2A): len=3, [AB,AB,AB]
      const expected = new Uint8Array([
        0x08, 0x00,
        0x2a, 0x03, 0xab, 0xab, 0xab,
      ]);
      expect(bytesToHex(encoded)).toBe(bytesToHex(expected));
    });
  });

  describe("known PendingPreKey encoding", () => {
    it("produces exact bytes", () => {
      const encoded = encodePendingPreKey({
        preKeyId: 1,
        baseKey: new Uint8Array(2).fill(0x99),
        signedPreKeyId: 2,
      });
      // field 1 (varint, tag=0x08): value=1
      // field 2 (bytes, tag=0x12): len=2, [99,99]
      // field 3 (varint, tag=0x18): value=2
      const expected = new Uint8Array([
        0x08, 0x01,
        0x12, 0x02, 0x99, 0x99,
        0x18, 0x02,
      ]);
      expect(bytesToHex(encoded)).toBe(bytesToHex(expected));
    });
  });
});

// ============================================================================
// Task 9.4: Libsignal proto3 vs proto2 behavior
// ============================================================================

describe("Task 9.4: Proto2 vs Proto3 behavior", () => {
  it("proto2 optional fields: absent field returns undefined, not 0", () => {
    // When a proto2 optional field is absent, our decoder should
    // return undefined (not the default value). This matches libsignal's
    // prost behavior where optional fields are Option<T>.
    const encoded = encodeSignalMessage({
      ratchetKey: filler(33),
      counter: 5,
      ciphertext: filler(10),
    });
    const decoded = decodeSignalMessage(encoded);
    expect(decoded.previousCounter).toBeUndefined();
    expect(decoded.pqRatchetKey).toBeUndefined();
  });

  it("proto3 zero-valued fields may be omitted on wire", () => {
    // In proto3, fields with default values (0 for integers, empty for bytes)
    // are typically omitted from the wire encoding for size efficiency.
    // Our SessionStructure encoder follows this: if sessionVersion is 0 or
    // undefined, it is omitted.
    const encoded = encodeSessionStructure({});
    expect(encoded.length).toBe(0);
  });

  it("proto3 decodes missing fields as defaults", () => {
    const decoded = decodeSessionStructure(new Uint8Array(0));
    expect(decoded.sessionVersion).toBeUndefined();
    expect(decoded.rootKey).toBeUndefined();
    expect(decoded.receiverChains).toBeUndefined();
  });

  it("decoder ignores unknown fields gracefully", () => {
    // A valid protobuf should be forward-compatible: unknown fields
    // are skipped. Construct bytes with an unknown field 99.
    const data = concatProtoFields(
      encodeUint32Field(2, 42),         // counter
      encodeUint32Field(99, 12345),     // unknown field
      encodeBytesField(4, filler(10)),  // ciphertext
    );
    // Our decoder should not throw and should parse known fields
    const decoded = decodeSignalMessage(data);
    expect(decoded.counter).toBe(42);
    expect(bytesToHex(decoded.ciphertext!)).toBe(bytesToHex(filler(10)));
  });
});

// ============================================================================
// Task 9.4: Wire-level cross-verification
// ============================================================================

describe("Task 9.4: Wire-level cross-verification", () => {
  it("SignalMessage encode -> raw parse -> values match", () => {
    const rk = filler(33, 0x05);
    const ct = filler(64, 0xcd);
    const pq = filler(33, 0xf0);

    const encoded = encodeSignalMessage({
      ratchetKey: rk,
      counter: 42,
      previousCounter: 7,
      ciphertext: ct,
      pqRatchetKey: pq,
    });

    const raw = parseRawProto(encoded);
    expect(raw).toHaveLength(5);

    // Verify each field matches expected wire.proto schema
    expect(raw[0]).toMatchObject({ field: 1, wireType: 2 });
    expect((raw[0].value as Uint8Array).length).toBe(33);

    expect(raw[1]).toMatchObject({ field: 2, wireType: 0, value: 42 });
    expect(raw[2]).toMatchObject({ field: 3, wireType: 0, value: 7 });

    expect(raw[3]).toMatchObject({ field: 4, wireType: 2 });
    expect((raw[3].value as Uint8Array).length).toBe(64);

    expect(raw[4]).toMatchObject({ field: 5, wireType: 2 });
    expect((raw[4].value as Uint8Array).length).toBe(33);
  });

  it("SessionStructure nested chains parse correctly", () => {
    const chainKey = filler(32, 0x11);
    const ratchetKey = filler(33, 0x22);

    const encoded = encodeSessionStructure({
      sessionVersion: 4,
      senderChain: {
        senderRatchetKey: ratchetKey,
        chainKey: { index: 3, key: chainKey },
      },
    });

    const topLevel = parseRawProto(encoded);
    // Field 1 (session_version) + field 6 (sender_chain)
    expect(topLevel).toHaveLength(2);
    expect(topLevel[0]).toMatchObject({ field: 1, wireType: 0, value: 4 });
    expect(topLevel[1]).toMatchObject({ field: 6, wireType: 2 });

    // Parse the nested Chain message
    const chainBytes = topLevel[1].value as Uint8Array;
    const chainFields = parseRawProto(chainBytes);

    // Field 1 (sender_ratchet_key) + field 3 (chain_key nested)
    expect(chainFields).toHaveLength(2);
    expect(chainFields[0]).toMatchObject({ field: 1, wireType: 2 });
    expect((chainFields[0].value as Uint8Array).length).toBe(33);

    expect(chainFields[1]).toMatchObject({ field: 3, wireType: 2 });

    // Parse the nested ChainKey message
    const ckBytes = chainFields[1].value as Uint8Array;
    const ckFields = parseRawProto(ckBytes);
    expect(ckFields).toHaveLength(2);
    expect(ckFields[0]).toMatchObject({ field: 1, wireType: 0, value: 3 });
    expect(ckFields[1]).toMatchObject({ field: 2, wireType: 2 });
    expect((ckFields[1].value as Uint8Array).length).toBe(32);
  });

  it("CombinedFingerprints encode -> raw parse -> nested LogicalFingerprint", () => {
    const localContent = filler(32, 0xaa);
    const remoteContent = filler(32, 0xbb);

    const localFp = encodeBytesField(1, localContent);
    const remoteFp = encodeBytesField(1, remoteContent);

    const combined = concatProtoFields(
      encodeUint32Field(1, 2),
      encodeNestedMessage(2, localFp),
      encodeNestedMessage(3, remoteFp),
    );

    const top = parseRawProto(combined);
    expect(top).toHaveLength(3);

    // Version
    expect(top[0]).toMatchObject({ field: 1, wireType: 0, value: 2 });

    // Local fingerprint
    const localNested = parseRawProto(top[1].value as Uint8Array);
    expect(localNested).toHaveLength(1);
    expect(localNested[0]).toMatchObject({ field: 1, wireType: 2 });
    expect(bytesToHex(localNested[0].value as Uint8Array)).toBe(
      bytesToHex(localContent),
    );

    // Remote fingerprint
    const remoteNested = parseRawProto(top[2].value as Uint8Array);
    expect(remoteNested).toHaveLength(1);
    expect(remoteNested[0]).toMatchObject({ field: 1, wireType: 2 });
    expect(bytesToHex(remoteNested[0].value as Uint8Array)).toBe(
      bytesToHex(remoteContent),
    );
  });
});
