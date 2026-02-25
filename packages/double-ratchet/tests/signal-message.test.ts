/**
 * SignalMessage serialization/deserialization tests.
 */

import { describe, it, expect } from "vitest";
import { SignalMessage } from "../src/protocol/signal-message.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { KeyPair } from "../src/keys/key-pair.js";
import { createTestRng } from "./test-utils.js";

describe("SignalMessage", () => {
  const rng = createTestRng();

  function createTestMessage(): SignalMessage {
    const macKey = rng.randomData(32);
    const ciphertext = rng.randomData(20);
    const senderRatchetKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const receiverIdentity = IdentityKeyPair.generate(rng);

    return SignalMessage.create(
      3, // version 3
      macKey,
      senderRatchetKey.publicKey,
      42,
      41,
      ciphertext,
      senderIdentity.identityKey,
      receiverIdentity.identityKey,
    );
  }

  it("should create with correct properties", () => {
    const msg = createTestMessage();
    expect(msg.messageVersion).toBe(3);
    expect(msg.counter).toBe(42);
    expect(msg.previousCounter).toBe(41);
    expect(msg.senderRatchetKey.length).toBe(32);
    expect(msg.ciphertext.length).toBe(20);
  });

  it("should serialize and deserialize correctly", () => {
    const msg = createTestMessage();
    const deserialized = SignalMessage.deserialize(msg.serialized);

    expect(deserialized.messageVersion).toBe(msg.messageVersion);
    expect(deserialized.counter).toBe(msg.counter);
    expect(deserialized.previousCounter).toBe(msg.previousCounter);
    expect(deserialized.senderRatchetKey).toEqual(msg.senderRatchetKey);
    expect(deserialized.ciphertext).toEqual(msg.ciphertext);
    expect(deserialized.serialized).toEqual(msg.serialized);
  });

  it("should verify MAC with correct keys", () => {
    const macKey = rng.randomData(32);
    const ciphertext = rng.randomData(20);
    const senderRatchetKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const receiverIdentity = IdentityKeyPair.generate(rng);

    const msg = SignalMessage.create(
      3,
      macKey,
      senderRatchetKey.publicKey,
      1,
      0,
      ciphertext,
      senderIdentity.identityKey,
      receiverIdentity.identityKey,
    );

    expect(msg.verifyMac(senderIdentity.identityKey, receiverIdentity.identityKey, macKey)).toBe(
      true,
    );
  });

  it("should reject MAC with wrong key", () => {
    const macKey = rng.randomData(32);
    const wrongMacKey = rng.randomData(32);
    const ciphertext = rng.randomData(20);
    const senderRatchetKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const receiverIdentity = IdentityKeyPair.generate(rng);

    const msg = SignalMessage.create(
      3,
      macKey,
      senderRatchetKey.publicKey,
      1,
      0,
      ciphertext,
      senderIdentity.identityKey,
      receiverIdentity.identityKey,
    );

    expect(
      msg.verifyMac(senderIdentity.identityKey, receiverIdentity.identityKey, wrongMacKey),
    ).toBe(false);
  });

  it("should reject too-short messages", () => {
    expect(() => SignalMessage.deserialize(new Uint8Array(5))).toThrow();
  });

  it("should have correct version byte format", () => {
    const msg = createTestMessage();
    // Version byte: (messageVersion << 4) | CURRENT_VERSION
    // For version 3: (3 << 4) | 3 = 0x33
    expect(msg.serialized[0]).toBe(0x33);
  });
});
