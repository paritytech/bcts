/**
 * PreKeySignalMessage serialization/deserialization tests.
 */

import { describe, it, expect } from "vitest";
import { PreKeySignalMessage } from "../src/protocol/pre-key-signal-message.js";
import { SignalMessage } from "../src/protocol/signal-message.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { KeyPair } from "../src/keys/key-pair.js";
import { createTestRng } from "./test-utils.js";

describe("PreKeySignalMessage", () => {
  const rng = createTestRng();

  function createTestPreKeyMessage(): PreKeySignalMessage {
    const macKey = rng.randomData(32);
    const ciphertext = rng.randomData(20);
    const senderRatchetKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const receiverIdentity = IdentityKeyPair.generate(rng);
    const baseKey = KeyPair.generate(rng);

    const signalMessage = SignalMessage.create(
      3,
      macKey,
      senderRatchetKey.publicKey,
      42,
      41,
      ciphertext,
      senderIdentity.identityKey,
      receiverIdentity.identityKey,
    );

    return PreKeySignalMessage.create(
      3,
      365,
      undefined, // no one-time prekey
      97,
      baseKey.publicKey,
      senderIdentity.identityKey,
      signalMessage,
    );
  }

  it("should create with correct properties", () => {
    const msg = createTestPreKeyMessage();
    expect(msg.messageVersion).toBe(3);
    expect(msg.registrationId).toBe(365);
    expect(msg.preKeyId).toBeUndefined();
    expect(msg.signedPreKeyId).toBe(97);
    expect(msg.baseKey.length).toBe(32);
  });

  it("should serialize and deserialize correctly", () => {
    const msg = createTestPreKeyMessage();
    const deserialized = PreKeySignalMessage.deserialize(msg.serialized);

    expect(deserialized.messageVersion).toBe(msg.messageVersion);
    expect(deserialized.registrationId).toBe(msg.registrationId);
    expect(deserialized.preKeyId).toBe(msg.preKeyId);
    expect(deserialized.signedPreKeyId).toBe(msg.signedPreKeyId);
    expect(deserialized.baseKey).toEqual(msg.baseKey);
    expect(deserialized.identityKey.publicKey).toEqual(
      msg.identityKey.publicKey,
    );
    expect(deserialized.message.counter).toEqual(msg.message.counter);
    expect(deserialized.message.ciphertext).toEqual(msg.message.ciphertext);
  });

  it("should include optional prekey ID", () => {
    const macKey = rng.randomData(32);
    const ciphertext = rng.randomData(20);
    const senderRatchetKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const receiverIdentity = IdentityKeyPair.generate(rng);
    const baseKey = KeyPair.generate(rng);

    const signalMessage = SignalMessage.create(
      3,
      macKey,
      senderRatchetKey.publicKey,
      1,
      0,
      ciphertext,
      senderIdentity.identityKey,
      receiverIdentity.identityKey,
    );

    const msg = PreKeySignalMessage.create(
      3,
      100,
      42, // with one-time prekey
      5,
      baseKey.publicKey,
      senderIdentity.identityKey,
      signalMessage,
    );

    const deserialized = PreKeySignalMessage.deserialize(msg.serialized);
    expect(deserialized.preKeyId).toBe(42);
  });

  it("should reject empty data", () => {
    expect(() =>
      PreKeySignalMessage.deserialize(new Uint8Array(0)),
    ).toThrow();
  });
});
