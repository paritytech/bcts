import { describe, it, expect } from "vitest";
import {
  TripleRatchetSignalMessage,
  TripleRatchetPreKeySignalMessage,
} from "../src/protocol.js";
import {
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
  MAC_LENGTH,
} from "../src/constants.js";
import { TripleRatchetError, TripleRatchetErrorCode } from "../src/error.js";
import { IdentityKeyPair } from "@bcts/double-ratchet";
import type { RandomNumberGenerator } from "@bcts/rand";
import {
  encodeTripleRatchetSignalMessage,
  encodeTripleRatchetPreKeySignalMessage,
} from "../src/proto.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestRng(): RandomNumberGenerator {
  return {
    nextU32: () => {
      const b = new Uint8Array(4);
      globalThis.crypto.getRandomValues(b);
      return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
    },
    nextU64: () => {
      const b = new Uint8Array(8);
      globalThis.crypto.getRandomValues(b);
      const lo = BigInt((b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0);
      const hi = BigInt((b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0);
      return (hi << 32n) | lo;
    },
    fillBytes: (d: Uint8Array) => globalThis.crypto.getRandomValues(d),
    randomData: (n: number) => {
      const d = new Uint8Array(n);
      globalThis.crypto.getRandomValues(d);
      return d;
    },
    fillRandomData: (d: Uint8Array) => globalThis.crypto.getRandomValues(d),
  };
}

/**
 * Build a minimal valid SignalMessage wire payload with a chosen version byte.
 *
 * Wire format: [version_byte] [protobuf_body] [8-byte MAC]
 *
 * The protobuf body contains:
 *   field 1 (ratchetKey): 33-byte key with 0x05 prefix
 *   field 2 (counter): 0
 *   field 4 (ciphertext): 1 byte
 */
function buildRawSignalMessage(versionByte: number): Uint8Array {
  const ratchetKey = new Uint8Array(33);
  ratchetKey[0] = 0x05;
  ratchetKey.fill(0x42, 1); // 32 bytes of non-zero data for a valid key

  const proto = encodeTripleRatchetSignalMessage({
    ratchetKey,
    counter: 0,
    previousCounter: 0,
    ciphertext: new Uint8Array([0xaa]),
  });

  const mac = new Uint8Array(MAC_LENGTH); // dummy MAC (zeros)

  const wire = new Uint8Array(1 + proto.length + MAC_LENGTH);
  wire[0] = versionByte;
  wire.set(proto, 1);
  wire.set(mac, 1 + proto.length);
  return wire;
}

/**
 * Build a minimal valid PreKeySignalMessage wire payload with a chosen
 * version byte.
 *
 * Wire format: [version_byte] [protobuf_body]
 *
 * The protobuf body embeds a valid v4 SignalMessage in field 4.
 */
function buildRawPreKeySignalMessage(versionByte: number): Uint8Array {
  // First build a valid embedded v4 SignalMessage wire blob
  const embeddedSignalMessage = buildRawSignalMessage(0x44);

  const baseKey = new Uint8Array(33);
  baseKey[0] = 0x05;
  baseKey.fill(0x42, 1);

  const identityKey = new Uint8Array(33);
  identityKey[0] = 0x05;
  identityKey.fill(0x43, 1);

  const proto = encodeTripleRatchetPreKeySignalMessage({
    registrationId: 1,
    signedPreKeyId: 1,
    baseKey,
    identityKey,
    message: embeddedSignalMessage,
  });

  const wire = new Uint8Array(1 + proto.length);
  wire[0] = versionByte;
  wire.set(proto, 1);
  return wire;
}

// ---------------------------------------------------------------------------
// Constants verification
// ---------------------------------------------------------------------------

describe("version constants", () => {
  it("CIPHERTEXT_MESSAGE_CURRENT_VERSION should be 4", () => {
    expect(CIPHERTEXT_MESSAGE_CURRENT_VERSION).toBe(4);
  });

  it("CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION should be 3", () => {
    expect(CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION).toBe(3);
  });

  it("current version should be strictly greater than pre-Kyber version", () => {
    expect(CIPHERTEXT_MESSAGE_CURRENT_VERSION).toBeGreaterThan(
      CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
    );
  });
});

// ---------------------------------------------------------------------------
// TripleRatchetSignalMessage -- version byte on create
// ---------------------------------------------------------------------------

describe("TripleRatchetSignalMessage version", () => {
  it("v4 message should have version byte 0x44", () => {
    const rng = createTestRng();
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);

    const macKey = rng.randomData(32);
    const senderRatchetKey = rng.randomData(32);
    const ciphertext = new Uint8Array([0x01, 0x02, 0x03]);

    const msg = TripleRatchetSignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      macKey,
      senderRatchetKey,
      0,
      0,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      undefined,
    );

    // The first byte of the serialized wire format is the version byte.
    // For v4: (4 << 4) | 4 = 0x44
    expect(msg.serialized[0]).toBe(0x44);
    expect(msg.messageVersion).toBe(4);
  });

  it("version byte should encode message version in the high nibble", () => {
    const rng = createTestRng();
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = rng.randomData(32);
    const senderRatchetKey = rng.randomData(32);
    const ciphertext = new Uint8Array([0xff]);

    const msg = TripleRatchetSignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      macKey,
      senderRatchetKey,
      1,
      0,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      undefined,
    );

    const highNibble = msg.serialized[0] >> 4;
    expect(highNibble).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);
  });

  it("version byte should encode current version in the low nibble", () => {
    const rng = createTestRng();
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = rng.randomData(32);
    const senderRatchetKey = rng.randomData(32);
    const ciphertext = new Uint8Array([0xff]);

    const msg = TripleRatchetSignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      macKey,
      senderRatchetKey,
      1,
      0,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      undefined,
    );

    const lowNibble = msg.serialized[0] & 0x0f;
    expect(lowNibble).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);
  });
});

// ---------------------------------------------------------------------------
// TripleRatchetSignalMessage -- deserialization version checks
// ---------------------------------------------------------------------------

describe("TripleRatchetSignalMessage.deserialize version validation", () => {
  it("should reject legacy v3 message (version byte 0x33)", () => {
    const v3VersionByte = (3 << 4) | 3; // 0x33
    const wire = buildRawSignalMessage(v3VersionByte);

    expect(() => TripleRatchetSignalMessage.deserialize(wire)).toThrowError(
      /[Ll]egacy ciphertext version/,
    );
  });

  it("should throw TripleRatchetError with InvalidMessage code for v3", () => {
    const v3VersionByte = (3 << 4) | 3;
    const wire = buildRawSignalMessage(v3VersionByte);

    try {
      TripleRatchetSignalMessage.deserialize(wire);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TripleRatchetError);
      expect((err as TripleRatchetError).code).toBe(TripleRatchetErrorCode.InvalidMessage);
    }
  });

  it("should reject v2 message (version byte 0x22)", () => {
    const v2VersionByte = (2 << 4) | 2; // 0x22
    const wire = buildRawSignalMessage(v2VersionByte);

    expect(() => TripleRatchetSignalMessage.deserialize(wire)).toThrowError(
      /[Ll]egacy ciphertext version/,
    );
  });

  it("should reject v1 message (version byte 0x11)", () => {
    const v1VersionByte = (1 << 4) | 1; // 0x11
    const wire = buildRawSignalMessage(v1VersionByte);

    expect(() => TripleRatchetSignalMessage.deserialize(wire)).toThrowError(
      /[Ll]egacy ciphertext version/,
    );
  });

  it("should reject future v5 message (version byte 0x55)", () => {
    const v5VersionByte = (5 << 4) | 5; // 0x55
    const wire = buildRawSignalMessage(v5VersionByte);

    expect(() => TripleRatchetSignalMessage.deserialize(wire)).toThrowError(
      /[Uu]nrecognized ciphertext version/,
    );
  });

  it("should throw TripleRatchetError with InvalidMessage code for future version", () => {
    const v5VersionByte = (5 << 4) | 5;
    const wire = buildRawSignalMessage(v5VersionByte);

    try {
      TripleRatchetSignalMessage.deserialize(wire);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TripleRatchetError);
      expect((err as TripleRatchetError).code).toBe(TripleRatchetErrorCode.InvalidMessage);
    }
  });

  it("should reject future v15 message (max high nibble, version byte 0xF4)", () => {
    // High nibble = 15, low nibble = 4 => version extracted as 15
    const v15VersionByte = (15 << 4) | 4; // 0xF4
    const wire = buildRawSignalMessage(v15VersionByte);

    expect(() => TripleRatchetSignalMessage.deserialize(wire)).toThrowError(
      /[Uu]nrecognized ciphertext version/,
    );
  });

  it("should accept valid v4 message (version byte 0x44)", () => {
    const v4VersionByte = (4 << 4) | 4; // 0x44
    const wire = buildRawSignalMessage(v4VersionByte);

    const msg = TripleRatchetSignalMessage.deserialize(wire);
    expect(msg.messageVersion).toBe(4);
  });

  it("should reject messages that are too short", () => {
    // A valid message needs at least 1 version byte + 8-byte MAC = 9 bytes
    const tooShort = new Uint8Array(MAC_LENGTH); // exactly MAC_LENGTH, missing version byte

    expect(() => TripleRatchetSignalMessage.deserialize(tooShort)).toThrowError(
      /too short/i,
    );
  });

  it("should reject empty data", () => {
    const empty = new Uint8Array(0);

    expect(() => TripleRatchetSignalMessage.deserialize(empty)).toThrowError();
  });
});

// ---------------------------------------------------------------------------
// TripleRatchetPreKeySignalMessage -- version byte on create
// ---------------------------------------------------------------------------

describe("TripleRatchetPreKeySignalMessage version", () => {
  it("v4 PreKeySignalMessage should have version byte 0x44", () => {
    const rng = createTestRng();
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);

    const macKey = rng.randomData(32);
    const senderRatchetKey = rng.randomData(32);
    const ciphertext = new Uint8Array([0x01, 0x02, 0x03]);

    const innerMsg = TripleRatchetSignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      macKey,
      senderRatchetKey,
      0,
      0,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      undefined,
    );

    const baseKey = rng.randomData(32);
    const preKeyMsg = TripleRatchetPreKeySignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      42, // registrationId
      1, // preKeyId
      2, // signedPreKeyId
      baseKey,
      sender.identityKey.serialize(),
      innerMsg,
      undefined,
      undefined,
    );

    // For PreKeySignalMessage: versionByte = ((4 & 0xf) << 4) | 4 = 0x44
    expect(preKeyMsg.serialized[0]).toBe(0x44);
    expect(preKeyMsg.messageVersion).toBe(4);
  });

  it("version byte high nibble should equal the message version", () => {
    const rng = createTestRng();
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = rng.randomData(32);
    const senderRatchetKey = rng.randomData(32);
    const ciphertext = new Uint8Array([0xff]);

    const innerMsg = TripleRatchetSignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      macKey,
      senderRatchetKey,
      0,
      0,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      undefined,
    );

    const baseKey = rng.randomData(32);
    const preKeyMsg = TripleRatchetPreKeySignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      1,
      undefined,
      1,
      baseKey,
      sender.identityKey.serialize(),
      innerMsg,
      undefined,
      undefined,
    );

    const highNibble = preKeyMsg.serialized[0] >> 4;
    expect(highNibble).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);
  });
});

// ---------------------------------------------------------------------------
// TripleRatchetPreKeySignalMessage -- deserialization version checks
// ---------------------------------------------------------------------------

describe("TripleRatchetPreKeySignalMessage.deserialize version validation", () => {
  it("should reject legacy v3 PreKeySignalMessage (version byte 0x33)", () => {
    const v3VersionByte = (3 << 4) | 3; // 0x33
    const wire = buildRawPreKeySignalMessage(v3VersionByte);

    expect(() => TripleRatchetPreKeySignalMessage.deserialize(wire)).toThrowError(
      /[Ll]egacy ciphertext version/,
    );
  });

  it("should throw TripleRatchetError with InvalidMessage code for v3 PreKeySignalMessage", () => {
    const v3VersionByte = (3 << 4) | 3;
    const wire = buildRawPreKeySignalMessage(v3VersionByte);

    try {
      TripleRatchetPreKeySignalMessage.deserialize(wire);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TripleRatchetError);
      expect((err as TripleRatchetError).code).toBe(TripleRatchetErrorCode.InvalidMessage);
    }
  });

  it("should reject v2 PreKeySignalMessage (version byte 0x22)", () => {
    const v2VersionByte = (2 << 4) | 2;
    const wire = buildRawPreKeySignalMessage(v2VersionByte);

    expect(() => TripleRatchetPreKeySignalMessage.deserialize(wire)).toThrowError(
      /[Ll]egacy ciphertext version/,
    );
  });

  it("should reject future v5 PreKeySignalMessage (version byte 0x55)", () => {
    const v5VersionByte = (5 << 4) | 5;
    const wire = buildRawPreKeySignalMessage(v5VersionByte);

    expect(() => TripleRatchetPreKeySignalMessage.deserialize(wire)).toThrowError(
      /[Uu]nrecognized ciphertext version/,
    );
  });

  it("should throw TripleRatchetError with InvalidMessage code for future PreKeySignalMessage", () => {
    const v5VersionByte = (5 << 4) | 5;
    const wire = buildRawPreKeySignalMessage(v5VersionByte);

    try {
      TripleRatchetPreKeySignalMessage.deserialize(wire);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TripleRatchetError);
      expect((err as TripleRatchetError).code).toBe(TripleRatchetErrorCode.InvalidMessage);
    }
  });

  it("should accept valid v4 PreKeySignalMessage (version byte 0x44)", () => {
    const v4VersionByte = (4 << 4) | 4; // 0x44
    const wire = buildRawPreKeySignalMessage(v4VersionByte);

    const msg = TripleRatchetPreKeySignalMessage.deserialize(wire);
    expect(msg.messageVersion).toBe(4);
  });

  it("should reject empty data", () => {
    const empty = new Uint8Array(0);

    expect(() => TripleRatchetPreKeySignalMessage.deserialize(empty)).toThrowError(
      /[Ee]mpty/,
    );
  });
});

// ---------------------------------------------------------------------------
// Version byte arithmetic
// ---------------------------------------------------------------------------

describe("version byte encoding arithmetic", () => {
  it("v3 version byte should be 0x33 = (3 << 4) | 3", () => {
    const v3 = (CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION << 4) | CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION;
    expect(v3).toBe(0x33);
  });

  it("v4 version byte should be 0x44 = (4 << 4) | 4", () => {
    const v4 =
      (CIPHERTEXT_MESSAGE_CURRENT_VERSION << 4) | CIPHERTEXT_MESSAGE_CURRENT_VERSION;
    expect(v4).toBe(0x44);
  });

  it("extracting version from high nibble of 0x44 should yield 4", () => {
    const versionByte = 0x44;
    const extracted = versionByte >> 4;
    expect(extracted).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);
  });

  it("extracting version from high nibble of 0x33 should yield 3", () => {
    const versionByte = 0x33;
    const extracted = versionByte >> 4;
    expect(extracted).toBe(CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: create -> serialize -> deserialize preserves version
// ---------------------------------------------------------------------------

describe("TripleRatchetSignalMessage round-trip version", () => {
  it("create followed by deserialize should preserve messageVersion", () => {
    const rng = createTestRng();
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = rng.randomData(32);
    const senderRatchetKey = rng.randomData(32);
    const ciphertext = rng.randomData(16);

    const original = TripleRatchetSignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      macKey,
      senderRatchetKey,
      5,
      3,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      undefined,
    );

    const deserialized = TripleRatchetSignalMessage.deserialize(original.serialized);

    expect(deserialized.messageVersion).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);
    expect(deserialized.counter).toBe(5);
    expect(deserialized.previousCounter).toBe(3);
  });

  it("create with pqRatchet followed by deserialize should preserve pqRatchet bytes", () => {
    const rng = createTestRng();
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = rng.randomData(32);
    const senderRatchetKey = rng.randomData(32);
    const ciphertext = rng.randomData(16);
    const pqRatchet = rng.randomData(48);

    const original = TripleRatchetSignalMessage.create(
      CIPHERTEXT_MESSAGE_CURRENT_VERSION,
      macKey,
      senderRatchetKey,
      0,
      0,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      pqRatchet,
    );

    const deserialized = TripleRatchetSignalMessage.deserialize(original.serialized);

    expect(deserialized.messageVersion).toBe(CIPHERTEXT_MESSAGE_CURRENT_VERSION);
    expect(deserialized.pqRatchet).toBeDefined();
    expect(deserialized.pqRatchet).toEqual(pqRatchet);
  });
});
