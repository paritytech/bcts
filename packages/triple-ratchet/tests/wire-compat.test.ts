/**
 * V3/V4: Wire format compatibility tests.
 *
 * Verifies that TripleRatchetSignalMessage and TripleRatchetPreKeySignalMessage
 * produce byte-exact serialization matching the protobuf wire format from
 * Rust libsignal's wire.proto:
 *
 *   message SignalMessage {
 *     bytes  ratchet_key      = 1;
 *     uint32 counter          = 2;
 *     uint32 previous_counter = 3;
 *     bytes  ciphertext       = 4;
 *     bytes  pq_ratchet       = 5;
 *   }
 *
 *   message PreKeySignalMessage {
 *     uint32 pre_key_id        = 1;
 *     bytes  base_key          = 2;
 *     bytes  identity_key      = 3;
 *     bytes  message           = 4;
 *     uint32 registration_id   = 5;
 *     uint32 signed_pre_key_id = 6;
 *     uint32 kyber_pre_key_id  = 7;
 *     bytes  kyber_ciphertext  = 8;
 *   }
 *
 * Reference: libsignal/rust/protocol/src/proto/wire.proto
 */

import { describe, it, expect } from "vitest";
import { IdentityKey } from "@bcts/double-ratchet";
import {
  TripleRatchetSignalMessage,
  TripleRatchetPreKeySignalMessage,
} from "../src/protocol.js";
import { V3, V4, toHex } from "./fixtures/rust-vectors.js";

// ---------------------------------------------------------------------------
// V3: TripleRatchetSignalMessage wire format
// ---------------------------------------------------------------------------

describe("TripleRatchetSignalMessage — wire format vector V3", () => {
  it("should produce the expected serialized bytes", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const msg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    expect(toHex(msg.serialized)).toBe(toHex(V3.serialized));
  });

  it("should start with version byte 0x44", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const msg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    expect(msg.serialized[0]).toBe(0x44);
  });

  it("should end with the expected 8-byte MAC", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const msg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    const mac = msg.serialized.slice(msg.serialized.length - 8);
    expect(toHex(mac)).toBe(toHex(V3.mac));
  });

  it("should deserialize back to the original fields", () => {
    const deserialized = TripleRatchetSignalMessage.deserialize(V3.serialized);

    expect(deserialized.messageVersion).toBe(4);
    expect(deserialized.counter).toBe(V3.counter);
    expect(deserialized.previousCounter).toBe(V3.previousCounter);
    expect(deserialized.senderRatchetKey).toEqual(V3.ratchetKeyRaw);
    expect(deserialized.ciphertext).toEqual(V3.ciphertext);
    expect(deserialized.pqRatchet).toEqual(V3.pqRatchet);
  });

  it("should verify MAC with correct keys", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const deserialized = TripleRatchetSignalMessage.deserialize(V3.serialized);
    const valid = deserialized.verifyMac(senderIdentity, receiverIdentity, V3.macKey);
    expect(valid).toBe(true);
  });

  it("should reject MAC with wrong keys", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const deserialized = TripleRatchetSignalMessage.deserialize(V3.serialized);
    const wrongMacKey = new Uint8Array(32).fill(0xdd);
    const valid = deserialized.verifyMac(senderIdentity, receiverIdentity, wrongMacKey);
    expect(valid).toBe(false);
  });

  it("should reject MAC with swapped identities", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const deserialized = TripleRatchetSignalMessage.deserialize(V3.serialized);
    // Swap sender and receiver — MAC should fail
    const valid = deserialized.verifyMac(receiverIdentity, senderIdentity, V3.macKey);
    expect(valid).toBe(false);
  });

  it("should produce undefined pqRatchet when empty", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const msg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      undefined, // no pqRatchet
    );

    const deserialized = TripleRatchetSignalMessage.deserialize(msg.serialized);
    expect(deserialized.pqRatchet).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// V4: TripleRatchetPreKeySignalMessage wire format (with Kyber fields)
// ---------------------------------------------------------------------------

describe("TripleRatchetPreKeySignalMessage — wire format vector V4", () => {
  it("should produce the expected serialized bytes", () => {
    // First create the inner SignalMessage
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const innerMsg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    const preKeyMsg = TripleRatchetPreKeySignalMessage.create(
      4,
      V4.registrationId,
      V4.preKeyId,
      V4.signedPreKeyId,
      V4.baseKeyRaw,
      V4.identityKey,
      innerMsg,
      V4.kyberPreKeyId,
      V4.kyberCiphertext,
    );

    expect(toHex(preKeyMsg.serialized)).toBe(toHex(V4.serialized));
  });

  it("should start with version byte 0x44", () => {
    expect(V4.serialized[0]).toBe(0x44);
  });

  it("should deserialize back to the original fields", () => {
    const deserialized = TripleRatchetPreKeySignalMessage.deserialize(V4.serialized);

    expect(deserialized.messageVersion).toBe(4);
    expect(deserialized.preKeyId).toBe(V4.preKeyId);
    expect(deserialized.baseKey).toEqual(V4.baseKeyRaw);
    expect(deserialized.identityKey).toEqual(V4.identityKey);
    expect(deserialized.registrationId).toBe(V4.registrationId);
    expect(deserialized.signedPreKeyId).toBe(V4.signedPreKeyId);
    expect(deserialized.kyberPreKeyId).toBe(V4.kyberPreKeyId);
    expect(deserialized.kyberCiphertext).toEqual(V4.kyberCiphertext);
  });

  it("embedded message should preserve all fields", () => {
    const deserialized = TripleRatchetPreKeySignalMessage.deserialize(V4.serialized);
    const inner = deserialized.message;

    expect(inner.messageVersion).toBe(4);
    expect(inner.counter).toBe(V3.counter);
    expect(inner.previousCounter).toBe(V3.previousCounter);
    expect(inner.senderRatchetKey).toEqual(V3.ratchetKeyRaw);
    expect(inner.ciphertext).toEqual(V3.ciphertext);
    expect(inner.pqRatchet).toEqual(V3.pqRatchet);
  });

  it("kyber fields should use protobuf field numbers 7 and 8", () => {
    // Verify the raw proto body contains the correct field tags
    const protoBody = V4.serialized.slice(1); // skip version byte

    // Field 7 varint: tag = (7 << 3) | 0 = 0x38
    let found7 = false;
    for (let i = 0; i < protoBody.length - 1; i++) {
      if (protoBody[i] === 0x38) {
        found7 = true;
        break;
      }
    }
    expect(found7).toBe(true);

    // Field 8 bytes: tag = (8 << 3) | 2 = 0x42
    let found8 = false;
    for (let i = 0; i < protoBody.length - 1; i++) {
      if (protoBody[i] === 0x42) {
        found8 = true;
        break;
      }
    }
    expect(found8).toBe(true);
  });

  it("should reject v4 PreKeySignalMessage with mismatched Kyber fields", () => {
    // kyberPreKeyId without kyberCiphertext
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const innerMsg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    const msgWithIdOnly = TripleRatchetPreKeySignalMessage.create(
      4,
      V4.registrationId,
      V4.preKeyId,
      V4.signedPreKeyId,
      V4.baseKeyRaw,
      V4.identityKey,
      innerMsg,
      V4.kyberPreKeyId,
      undefined, // missing ciphertext
    );

    expect(() =>
      TripleRatchetPreKeySignalMessage.deserialize(msgWithIdOnly.serialized),
    ).toThrow("Kyber fields must be both present or both absent");
  });
});
