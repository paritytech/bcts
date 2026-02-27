import { describe, it, expect } from "vitest";
import { IdentityKeyPair } from "@bcts/double-ratchet";
import type { RandomNumberGenerator } from "@bcts/rand";
import {
  TripleRatchetSignalMessage,
  TripleRatchetPreKeySignalMessage,
} from "../src/protocol.js";
import {
  encodeTripleRatchetSignalMessage,
  decodeTripleRatchetSignalMessage,
  encodeTripleRatchetPreKeySignalMessage,
  decodeTripleRatchetPreKeySignalMessage,
} from "../src/proto.js";
import { TripleRatchetError } from "../src/error.js";

// ---------------------------------------------------------------------------
// Test helpers
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

function randomBytes(n: number): Uint8Array {
  const d = new Uint8Array(n);
  globalThis.crypto.getRandomValues(d);
  return d;
}

/**
 * Build a minimal valid TripleRatchetSignalMessage for embedding in PreKey
 * messages. Uses the provided identity keys for the MAC computation.
 */
function createTestSignalMessage(
  senderIdentity: IdentityKeyPair,
  receiverIdentity: IdentityKeyPair,
  opts?: { pqRatchet?: Uint8Array },
): TripleRatchetSignalMessage {
  const macKey = randomBytes(32);
  const ratchetKey = randomBytes(32);
  const ciphertext = randomBytes(64);
  return TripleRatchetSignalMessage.create(
    4,
    macKey,
    ratchetKey,
    0,
    0,
    ciphertext,
    senderIdentity.identityKey,
    receiverIdentity.identityKey,
    opts?.pqRatchet,
  );
}

// ---------------------------------------------------------------------------
// Protobuf encode/decode round-trips
// ---------------------------------------------------------------------------

describe("proto encode/decode", () => {
  it("round-trips TripleRatchetSignalMessageProto with all fields including pqRatchet", () => {
    const original = {
      ratchetKey: randomBytes(33),
      counter: 42,
      previousCounter: 7,
      ciphertext: randomBytes(128),
      pqRatchet: randomBytes(64),
    };

    const encoded = encodeTripleRatchetSignalMessage(original);
    const decoded = decodeTripleRatchetSignalMessage(encoded);

    expect(decoded.ratchetKey).toEqual(original.ratchetKey);
    expect(decoded.counter).toBe(original.counter);
    expect(decoded.previousCounter).toBe(original.previousCounter);
    expect(decoded.ciphertext).toEqual(original.ciphertext);
    expect(decoded.pqRatchet).toEqual(original.pqRatchet);
  });

  it("round-trips TripleRatchetSignalMessageProto without pqRatchet", () => {
    const original = {
      ratchetKey: randomBytes(33),
      counter: 100,
      previousCounter: 99,
      ciphertext: randomBytes(48),
    };

    const encoded = encodeTripleRatchetSignalMessage(original);
    const decoded = decodeTripleRatchetSignalMessage(encoded);

    expect(decoded.ratchetKey).toEqual(original.ratchetKey);
    expect(decoded.counter).toBe(original.counter);
    expect(decoded.previousCounter).toBe(original.previousCounter);
    expect(decoded.ciphertext).toEqual(original.ciphertext);
    expect(decoded.pqRatchet).toBeUndefined();
  });

  it("round-trips TripleRatchetPreKeySignalMessageProto with kyber fields", () => {
    const original = {
      preKeyId: 12345,
      baseKey: randomBytes(33),
      identityKey: randomBytes(33),
      message: randomBytes(100),
      registrationId: 9999,
      signedPreKeyId: 42,
      kyberPreKeyId: 7,
      kyberCiphertext: randomBytes(1088),
    };

    const encoded = encodeTripleRatchetPreKeySignalMessage(original);
    const decoded = decodeTripleRatchetPreKeySignalMessage(encoded);

    expect(decoded.preKeyId).toBe(original.preKeyId);
    expect(decoded.baseKey).toEqual(original.baseKey);
    expect(decoded.identityKey).toEqual(original.identityKey);
    expect(decoded.message).toEqual(original.message);
    expect(decoded.registrationId).toBe(original.registrationId);
    expect(decoded.signedPreKeyId).toBe(original.signedPreKeyId);
    expect(decoded.kyberPreKeyId).toBe(original.kyberPreKeyId);
    expect(decoded.kyberCiphertext).toEqual(original.kyberCiphertext);
  });

  it("round-trips TripleRatchetPreKeySignalMessageProto without kyber fields", () => {
    const original = {
      preKeyId: 1,
      baseKey: randomBytes(33),
      identityKey: randomBytes(33),
      message: randomBytes(80),
      registrationId: 100,
      signedPreKeyId: 5,
    };

    const encoded = encodeTripleRatchetPreKeySignalMessage(original);
    const decoded = decodeTripleRatchetPreKeySignalMessage(encoded);

    expect(decoded.preKeyId).toBe(original.preKeyId);
    expect(decoded.baseKey).toEqual(original.baseKey);
    expect(decoded.identityKey).toEqual(original.identityKey);
    expect(decoded.message).toEqual(original.message);
    expect(decoded.registrationId).toBe(original.registrationId);
    expect(decoded.signedPreKeyId).toBe(original.signedPreKeyId);
    expect(decoded.kyberPreKeyId).toBeUndefined();
    expect(decoded.kyberCiphertext).toBeUndefined();
  });

  it("omits empty pqRatchet from encoding (not encoded as zero-length bytes)", () => {
    const withPq = {
      ratchetKey: randomBytes(33),
      counter: 1,
      previousCounter: 0,
      ciphertext: randomBytes(16),
      pqRatchet: randomBytes(32),
    };
    const withoutPq = {
      ratchetKey: withPq.ratchetKey,
      counter: 1,
      previousCounter: 0,
      ciphertext: withPq.ciphertext,
      pqRatchet: new Uint8Array(0),
    };
    const withoutPqField = {
      ratchetKey: withPq.ratchetKey,
      counter: 1,
      previousCounter: 0,
      ciphertext: withPq.ciphertext,
    };

    const encodedEmpty = encodeTripleRatchetSignalMessage(withoutPq);
    const encodedOmitted = encodeTripleRatchetSignalMessage(withoutPqField);

    // Both should produce the same bytes: empty pqRatchet is not written on the wire
    expect(encodedEmpty).toEqual(encodedOmitted);

    // And they should be smaller than the version with actual pqRatchet data
    const encodedFull = encodeTripleRatchetSignalMessage(withPq);
    expect(encodedEmpty.length).toBeLessThan(encodedFull.length);
  });
});

// ---------------------------------------------------------------------------
// TripleRatchetSignalMessage
// ---------------------------------------------------------------------------

describe("TripleRatchetSignalMessage", () => {
  const rng = createTestRng();

  it("create() -> deserialize() round-trip preserves all fields", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = randomBytes(32);
    const ratchetKey = randomBytes(32);
    const ciphertext = randomBytes(128);
    const pqRatchet = randomBytes(64);

    const msg = TripleRatchetSignalMessage.create(
      4,
      macKey,
      ratchetKey,
      10,
      3,
      ciphertext,
      sender.identityKey,
      receiver.identityKey,
      pqRatchet,
    );

    expect(msg.messageVersion).toBe(4);
    expect(msg.counter).toBe(10);
    expect(msg.previousCounter).toBe(3);
    expect(msg.senderRatchetKey).toEqual(ratchetKey);
    expect(msg.ciphertext).toEqual(ciphertext);
    expect(msg.pqRatchet).toEqual(pqRatchet);

    // Deserialize from the wire bytes
    const deserialized = TripleRatchetSignalMessage.deserialize(msg.serialized);

    expect(deserialized.messageVersion).toBe(4);
    expect(deserialized.counter).toBe(10);
    expect(deserialized.previousCounter).toBe(3);
    expect(deserialized.senderRatchetKey).toEqual(ratchetKey);
    expect(deserialized.ciphertext).toEqual(ciphertext);
    expect(deserialized.pqRatchet).toEqual(pqRatchet);
  });

  it("pqRatchet getter returns the SPQR message bytes when provided", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = randomBytes(32);
    const pqRatchetData = randomBytes(96);

    const msg = TripleRatchetSignalMessage.create(
      4,
      macKey,
      randomBytes(32),
      0,
      0,
      randomBytes(32),
      sender.identityKey,
      receiver.identityKey,
      pqRatchetData,
    );

    expect(msg.pqRatchet).toBeDefined();
    expect(msg.pqRatchet).toEqual(pqRatchetData);
  });

  it("empty/undefined pqRatchet results in pqRatchet getter returning undefined", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = randomBytes(32);

    // Undefined pqRatchet
    const msgUndefined = TripleRatchetSignalMessage.create(
      4,
      macKey,
      randomBytes(32),
      0,
      0,
      randomBytes(32),
      sender.identityKey,
      receiver.identityKey,
      undefined,
    );
    expect(msgUndefined.pqRatchet).toBeUndefined();

    // Empty Uint8Array pqRatchet
    const msgEmpty = TripleRatchetSignalMessage.create(
      4,
      macKey,
      randomBytes(32),
      0,
      0,
      randomBytes(32),
      sender.identityKey,
      receiver.identityKey,
      new Uint8Array(0),
    );
    expect(msgEmpty.pqRatchet).toBeUndefined();

    // Verify round-trip also preserves undefined
    const deserialized = TripleRatchetSignalMessage.deserialize(msgUndefined.serialized);
    expect(deserialized.pqRatchet).toBeUndefined();
  });

  it("deserialization rejects messages that are too short", () => {
    // MAC_LENGTH = 8, minimum valid message is 1 (version) + 8 (MAC) = 9 bytes
    const tooShort = new Uint8Array(8); // exactly MAC_LENGTH, too short
    tooShort[0] = 0x44; // valid version byte

    expect(() => TripleRatchetSignalMessage.deserialize(tooShort)).toThrow(TripleRatchetError);
    expect(() => TripleRatchetSignalMessage.deserialize(tooShort)).toThrow(/too short/i);

    // Even shorter
    expect(() => TripleRatchetSignalMessage.deserialize(new Uint8Array(0))).toThrow(
      TripleRatchetError,
    );
    expect(() => TripleRatchetSignalMessage.deserialize(new Uint8Array(1))).toThrow(
      TripleRatchetError,
    );
  });

  it("deserialization rejects legacy versions (< 4)", () => {
    // Build a message with version 3: version_byte = (3 << 4) | anything = 0x3X
    // We need at least 9 bytes (1 version + 0 proto + 8 MAC)
    const legacyData = new Uint8Array(9);
    legacyData[0] = (3 << 4) | 3; // version 3

    expect(() => TripleRatchetSignalMessage.deserialize(legacyData)).toThrow(TripleRatchetError);
    expect(() => TripleRatchetSignalMessage.deserialize(legacyData)).toThrow(/legacy/i);

    // Version 2
    const v2Data = new Uint8Array(9);
    v2Data[0] = (2 << 4) | 2;
    expect(() => TripleRatchetSignalMessage.deserialize(v2Data)).toThrow(/legacy/i);
  });

  it("MAC verification succeeds with the correct key", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = randomBytes(32);

    const msg = TripleRatchetSignalMessage.create(
      4,
      macKey,
      randomBytes(32),
      5,
      2,
      randomBytes(64),
      sender.identityKey,
      receiver.identityKey,
      randomBytes(32),
    );

    // Deserialize and verify MAC with same keys
    const deserialized = TripleRatchetSignalMessage.deserialize(msg.serialized);
    expect(deserialized.verifyMac(sender.identityKey, receiver.identityKey, macKey)).toBe(true);
  });

  it("MAC verification fails with the wrong key", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const macKey = randomBytes(32);
    const wrongMacKey = randomBytes(32);

    const msg = TripleRatchetSignalMessage.create(
      4,
      macKey,
      randomBytes(32),
      5,
      2,
      randomBytes(64),
      sender.identityKey,
      receiver.identityKey,
      randomBytes(32),
    );

    const deserialized = TripleRatchetSignalMessage.deserialize(msg.serialized);

    // Wrong MAC key
    expect(deserialized.verifyMac(sender.identityKey, receiver.identityKey, wrongMacKey)).toBe(
      false,
    );

    // Swapped identity keys (sender/receiver reversed)
    expect(deserialized.verifyMac(receiver.identityKey, sender.identityKey, macKey)).toBe(false);

    // Different sender identity
    const otherSender = IdentityKeyPair.generate(rng);
    expect(deserialized.verifyMac(otherSender.identityKey, receiver.identityKey, macKey)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// TripleRatchetPreKeySignalMessage
// ---------------------------------------------------------------------------

describe("TripleRatchetPreKeySignalMessage", () => {
  const rng = createTestRng();

  it("create() -> deserialize() round-trip preserves all fields including kyber", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);

    const embeddedMsg = createTestSignalMessage(sender, receiver, {
      pqRatchet: randomBytes(48),
    });

    const baseKey = randomBytes(32);
    const senderIdentitySerialized = sender.identityKey.serialize(); // 33 bytes
    const kyberCiphertext = randomBytes(1088);

    const preKeyMsg = TripleRatchetPreKeySignalMessage.create(
      4,
      42, // registrationId
      100, // preKeyId
      7, // signedPreKeyId
      baseKey,
      senderIdentitySerialized,
      embeddedMsg,
      3, // kyberPreKeyId
      kyberCiphertext,
    );

    expect(preKeyMsg.messageVersion).toBe(4);
    expect(preKeyMsg.registrationId).toBe(42);
    expect(preKeyMsg.preKeyId).toBe(100);
    expect(preKeyMsg.signedPreKeyId).toBe(7);
    expect(preKeyMsg.baseKey).toEqual(baseKey);
    expect(preKeyMsg.identityKey).toEqual(senderIdentitySerialized);
    expect(preKeyMsg.kyberPreKeyId).toBe(3);
    expect(preKeyMsg.kyberCiphertext).toEqual(kyberCiphertext);
    expect(preKeyMsg.message).toBe(embeddedMsg);

    // Deserialize from wire bytes
    const deserialized = TripleRatchetPreKeySignalMessage.deserialize(preKeyMsg.serialized);

    expect(deserialized.messageVersion).toBe(4);
    expect(deserialized.registrationId).toBe(42);
    expect(deserialized.preKeyId).toBe(100);
    expect(deserialized.signedPreKeyId).toBe(7);
    expect(deserialized.baseKey).toEqual(baseKey);
    expect(deserialized.identityKey).toEqual(senderIdentitySerialized);
    expect(deserialized.kyberPreKeyId).toBe(3);
    expect(deserialized.kyberCiphertext).toEqual(kyberCiphertext);

    // Embedded message fields should also be preserved
    expect(deserialized.message.counter).toBe(embeddedMsg.counter);
    expect(deserialized.message.previousCounter).toBe(embeddedMsg.previousCounter);
    expect(deserialized.message.ciphertext).toEqual(embeddedMsg.ciphertext);
    expect(deserialized.message.senderRatchetKey).toEqual(embeddedMsg.senderRatchetKey);
  });

  it("kyberPreKeyId and kyberCiphertext getters return correct values", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const embeddedMsg = createTestSignalMessage(sender, receiver);
    const kyberCiphertext = randomBytes(512);

    const preKeyMsg = TripleRatchetPreKeySignalMessage.create(
      4,
      1,
      undefined, // no preKeyId
      10,
      randomBytes(32),
      sender.identityKey.serialize(),
      embeddedMsg,
      55, // kyberPreKeyId
      kyberCiphertext,
    );

    expect(preKeyMsg.kyberPreKeyId).toBe(55);
    expect(preKeyMsg.kyberCiphertext).toEqual(kyberCiphertext);

    // Also verify after deserialization
    const deserialized = TripleRatchetPreKeySignalMessage.deserialize(preKeyMsg.serialized);
    expect(deserialized.kyberPreKeyId).toBe(55);
    expect(deserialized.kyberCiphertext).toEqual(kyberCiphertext);
  });

  it("missing kyber fields result in getters returning undefined", () => {
    const sender = IdentityKeyPair.generate(rng);
    const receiver = IdentityKeyPair.generate(rng);
    const embeddedMsg = createTestSignalMessage(sender, receiver);

    const preKeyMsg = TripleRatchetPreKeySignalMessage.create(
      4,
      1,
      50,
      10,
      randomBytes(32),
      sender.identityKey.serialize(),
      embeddedMsg,
      undefined, // no kyberPreKeyId
      undefined, // no kyberCiphertext
    );

    expect(preKeyMsg.kyberPreKeyId).toBeUndefined();
    expect(preKeyMsg.kyberCiphertext).toBeUndefined();

    // Also verify after deserialization
    const deserialized = TripleRatchetPreKeySignalMessage.deserialize(preKeyMsg.serialized);
    expect(deserialized.kyberPreKeyId).toBeUndefined();
    expect(deserialized.kyberCiphertext).toBeUndefined();
  });

  it("deserialization rejects empty data", () => {
    expect(() => TripleRatchetPreKeySignalMessage.deserialize(new Uint8Array(0))).toThrow(
      TripleRatchetError,
    );
    expect(() => TripleRatchetPreKeySignalMessage.deserialize(new Uint8Array(0))).toThrow(
      /empty/i,
    );
  });
});
