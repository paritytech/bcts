/**
 * Basic session integration tests.
 *
 * Tests the complete flow: key generation -> bundle -> session -> encrypt -> decrypt.
 * All sessions use v4 (PQXDH with Kyber) since v3 is no longer supported.
 */

import { describe, it, expect } from "vitest";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { PreKeyRecord, SignedPreKeyRecord } from "../src/keys/pre-key.js";
import { PreKeyBundle } from "../src/keys/pre-key-bundle.js";
import { KyberPreKeyRecord } from "../src/kem/kyber-pre-key.js";
import { ProtocolAddress } from "../src/storage/interfaces.js";
import { InMemorySignalProtocolStore } from "../src/storage/in-memory-store.js";
import { processPreKeyBundle } from "../src/x3dh/process-prekey-bundle.js";
import { messageEncrypt, messageDecrypt } from "../src/session/session-cipher.js";
import { PreKeySignalMessage } from "../src/protocol/pre-key-signal-message.js";
import { SignalMessage } from "../src/protocol/signal-message.js";
import { createTestRng } from "./test-utils.js";

function setupAliceAndBob(rng: ReturnType<typeof createTestRng>) {
  const aliceIdentity = IdentityKeyPair.generate(rng);
  const bobIdentity = IdentityKeyPair.generate(rng);

  const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
  const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

  const bobAddress = new ProtocolAddress("bob", 1);
  const aliceAddress = new ProtocolAddress("alice", 1);

  // Generate Bob's prekeys (v4 with Kyber)
  const bobPreKey = PreKeyRecord.generate(1, rng);
  const bobSignedPreKey = SignedPreKeyRecord.generate(1, bobIdentity, Date.now(), rng);
  const bobKyberPreKey = KyberPreKeyRecord.generate(1, bobIdentity, Date.now());

  // Store Bob's prekeys
  bobStore.storePreKey(bobPreKey.id, bobPreKey);
  bobStore.storeSignedPreKey(bobSignedPreKey.id, bobSignedPreKey);
  bobStore.storeKyberPreKey(bobKyberPreKey.id, bobKyberPreKey);

  // Create Bob's v4 prekey bundle with Kyber
  const bobBundle = new PreKeyBundle({
    registrationId: 2,
    deviceId: 1,
    preKeyId: bobPreKey.id,
    preKey: bobPreKey.keyPair.publicKey,
    signedPreKeyId: bobSignedPreKey.id,
    signedPreKey: bobSignedPreKey.keyPair.publicKey,
    signedPreKeySignature: bobSignedPreKey.signature,
    identityKey: bobIdentity.identityKey,
    kyberPreKeyId: bobKyberPreKey.id,
    kyberPreKey: bobKyberPreKey.keyPair.publicKey,
    kyberPreKeySignature: bobKyberPreKey.signature,
  });

  return {
    aliceStore,
    bobStore,
    aliceAddress,
    bobAddress,
    bobBundle,
    rng,
  };
}

describe("Basic Session", () => {
  it("should establish session and exchange messages", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupAliceAndBob(rng);

    // Alice processes Bob's bundle to establish a session
    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // Alice encrypts a message
    const plaintext = new TextEncoder().encode("Hello Bob!");
    const encrypted = await messageEncrypt(
      plaintext,
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // First message should be a PreKeySignalMessage
    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);

    // Bob decrypts Alice's message
    const decrypted = await messageDecrypt(
      encrypted,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    expect(new TextDecoder().decode(decrypted)).toBe("Hello Bob!");

    // Bob encrypts a response
    const response = new TextEncoder().encode("Hello Alice!");
    const bobEncrypted = await messageEncrypt(
      response,
      aliceAddress,
      bobStore,
      bobStore,
    );

    // Bob's response should be a regular SignalMessage (no prekey needed)
    expect(bobEncrypted).toBeInstanceOf(SignalMessage);

    // Alice decrypts Bob's response
    const aliceDecrypted = await messageDecrypt(
      bobEncrypted,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );

    expect(new TextDecoder().decode(aliceDecrypted)).toBe("Hello Alice!");
  });

  it("should handle session without one-time prekey", async () => {
    const rng = createTestRng();
    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const bobAddress = new ProtocolAddress("bob", 1);
    const aliceAddress = new ProtocolAddress("alice", 1);

    // Bob's bundle WITHOUT one-time prekey but WITH Kyber (v4 required)
    const bobSignedPreKey = SignedPreKeyRecord.generate(
      1,
      bobIdentity,
      Date.now(),
      rng,
    );
    const bobKyberPreKey = KyberPreKeyRecord.generate(1, bobIdentity, Date.now());

    await bobStore.storeSignedPreKey(bobSignedPreKey.id, bobSignedPreKey);
    await bobStore.storeKyberPreKey(bobKyberPreKey.id, bobKyberPreKey);

    const bobBundle = new PreKeyBundle({
      registrationId: 2,
      deviceId: 1,
      signedPreKeyId: bobSignedPreKey.id,
      signedPreKey: bobSignedPreKey.keyPair.publicKey,
      signedPreKeySignature: bobSignedPreKey.signature,
      identityKey: bobIdentity.identityKey,
      kyberPreKeyId: bobKyberPreKey.id,
      kyberPreKey: bobKyberPreKey.keyPair.publicKey,
      kyberPreKeySignature: bobKyberPreKey.signature,
    });

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    const plaintext = new TextEncoder().encode("No one-time prekey!");
    const encrypted = await messageEncrypt(
      plaintext,
      bobAddress,
      aliceStore,
      aliceStore,
    );

    const decrypted = await messageDecrypt(
      encrypted,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    expect(new TextDecoder().decode(decrypted)).toBe("No one-time prekey!");
  });

  it("should handle multiple messages in sequence", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } =
      setupAliceAndBob(rng);

    await processPreKeyBundle(
      bobBundle,
      bobAddress,
      aliceStore,
      aliceStore,
      rng,
    );

    // Send multiple messages from Alice to Bob
    for (let i = 0; i < 10; i++) {
      const plaintext = new TextEncoder().encode(`Message ${i}`);
      const encrypted = await messageEncrypt(
        plaintext,
        bobAddress,
        aliceStore,
        aliceStore,
      );

      const decrypted = await messageDecrypt(
        encrypted,
        aliceAddress,
        bobStore,
        bobStore,
        bobStore,
        bobStore,
        rng,
        bobStore,
      );

      expect(new TextDecoder().decode(decrypted)).toBe(`Message ${i}`);
    }
  });
});
