/**
 * PQXDH v4 session tests.
 *
 * Tests post-quantum key exchange using Kyber/ML-KEM-1024 encapsulation
 * during X3DH session initialization.
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
import { InvalidMessageError } from "../src/error.js";
import { createTestRng } from "./test-utils.js";

function setupV4AliceAndBob(rng: ReturnType<typeof createTestRng>) {
  const aliceIdentity = IdentityKeyPair.generate(rng);
  const bobIdentity = IdentityKeyPair.generate(rng);

  const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
  const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

  const bobAddress = new ProtocolAddress("bob", 1);
  const aliceAddress = new ProtocolAddress("alice", 1);

  // Generate Bob's prekeys including Kyber
  const bobPreKey = PreKeyRecord.generate(1, rng);
  const bobSignedPreKey = SignedPreKeyRecord.generate(1, bobIdentity, Date.now(), rng);
  const bobKyberPreKey = KyberPreKeyRecord.generate(1, bobIdentity, Date.now());

  // Store Bob's prekeys
  bobStore.storePreKey(bobPreKey.id, bobPreKey);
  bobStore.storeSignedPreKey(bobSignedPreKey.id, bobSignedPreKey);
  bobStore.storeKyberPreKey(bobKyberPreKey.id, bobKyberPreKey);

  // Create Bob's v4 bundle with Kyber
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

describe("PQXDH v4 Session", () => {
  it("should establish v4 session with Kyber and exchange messages", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } = setupV4AliceAndBob(rng);

    // Alice processes Bob's v4 bundle
    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Alice encrypts
    const plaintext = new TextEncoder().encode("Hello PQ Bob!");
    const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);

    // First message should be a PreKeySignalMessage
    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);
    const preKeyMsg = encrypted as PreKeySignalMessage;

    // Verify v4 message has Kyber fields
    expect(preKeyMsg.kyberPreKeyId).toBe(1);
    expect(preKeyMsg.kyberCiphertext).toBeDefined();
    expect(preKeyMsg.kyberCiphertext!.length).toBeGreaterThan(0);

    // Verify version is 4
    expect(preKeyMsg.messageVersion).toBe(4);

    // Bob decrypts (with Kyber store)
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
    expect(new TextDecoder().decode(decrypted)).toBe("Hello PQ Bob!");

    // Bob responds
    const response = new TextEncoder().encode("Hello PQ Alice!");
    const bobEncrypted = await messageEncrypt(response, aliceAddress, bobStore, bobStore);

    // Bob's response should be a regular SignalMessage
    expect(bobEncrypted).toBeInstanceOf(SignalMessage);

    // Alice decrypts response
    const aliceDecrypted = await messageDecrypt(
      bobEncrypted,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(aliceDecrypted)).toBe("Hello PQ Alice!");
  });

  it("should reject v3 bundles (no Kyber) on Bob's side", async () => {
    const rng = createTestRng();
    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const bobAddress = new ProtocolAddress("bob", 1);
    const aliceAddress = new ProtocolAddress("alice", 1);

    // Generate Bob's prekeys WITHOUT Kyber
    const bobPreKey = PreKeyRecord.generate(1, rng);
    const bobSignedPreKey = SignedPreKeyRecord.generate(1, bobIdentity, Date.now(), rng);

    await bobStore.storePreKey(bobPreKey.id, bobPreKey);
    await bobStore.storeSignedPreKey(bobSignedPreKey.id, bobSignedPreKey);

    const bobBundle = new PreKeyBundle({
      registrationId: 2,
      deviceId: 1,
      preKeyId: bobPreKey.id,
      preKey: bobPreKey.keyPair.publicKey,
      signedPreKeyId: bobSignedPreKey.id,
      signedPreKey: bobSignedPreKey.keyPair.publicKey,
      signedPreKeySignature: bobSignedPreKey.signature,
      identityKey: bobIdentity.identityKey,
    });

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    const plaintext = new TextEncoder().encode("Hello v3 Bob!");
    const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);

    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);
    const preKeyMsg = encrypted as PreKeySignalMessage;
    expect(preKeyMsg.messageVersion).toBe(3);

    // Bob should reject the v3 message (X3DH no longer supported)
    await expect(
      messageDecrypt(encrypted, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
    ).rejects.toThrow(InvalidMessageError);
  });

  it("should exchange 10+ messages on v4 session", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } = setupV4AliceAndBob(rng);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Alice sends first message (PreKeySignalMessage)
    const first = new TextEncoder().encode("Message 0");
    const firstEncrypted = await messageEncrypt(first, bobAddress, aliceStore, aliceStore);
    expect(firstEncrypted).toBeInstanceOf(PreKeySignalMessage);

    const firstDecrypted = await messageDecrypt(
      firstEncrypted,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(firstDecrypted)).toBe("Message 0");

    // Alternate sending messages between Alice and Bob
    for (let i = 1; i <= 10; i++) {
      if (i % 2 === 1) {
        // Bob sends
        const pt = new TextEncoder().encode(`Bob message ${i}`);
        const enc = await messageEncrypt(pt, aliceAddress, bobStore, bobStore);
        expect(enc).toBeInstanceOf(SignalMessage);

        const dec = await messageDecrypt(
          enc,
          bobAddress,
          aliceStore,
          aliceStore,
          aliceStore,
          aliceStore,
          rng,
        );
        expect(new TextDecoder().decode(dec)).toBe(`Bob message ${i}`);
      } else {
        // Alice sends
        const pt = new TextEncoder().encode(`Alice message ${i}`);
        const enc = await messageEncrypt(pt, bobAddress, aliceStore, aliceStore);
        expect(enc).toBeInstanceOf(SignalMessage);

        const dec = await messageDecrypt(
          enc,
          aliceAddress,
          bobStore,
          bobStore,
          bobStore,
          bobStore,
          rng,
        );
        expect(new TextDecoder().decode(dec)).toBe(`Alice message ${i}`);
      }
    }
  });

  it("should serialize and deserialize PreKeySignalMessage with Kyber fields", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } = setupV4AliceAndBob(rng);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    const plaintext = new TextEncoder().encode("Round-trip test");
    const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);

    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);
    const original = encrypted as PreKeySignalMessage;

    // Deserialize from wire bytes
    const deserialized = PreKeySignalMessage.deserialize(original.serialized);

    expect(deserialized.messageVersion).toBe(original.messageVersion);
    expect(deserialized.registrationId).toBe(original.registrationId);
    expect(deserialized.preKeyId).toBe(original.preKeyId);
    expect(deserialized.signedPreKeyId).toBe(original.signedPreKeyId);
    expect(deserialized.kyberPreKeyId).toBe(original.kyberPreKeyId);
    expect(deserialized.kyberCiphertext).toEqual(original.kyberCiphertext);

    // Bob can decrypt the deserialized message
    const decrypted = await messageDecrypt(
      deserialized,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(decrypted)).toBe("Round-trip test");
  });

  it("should work with v4 session without one-time prekey", async () => {
    const rng = createTestRng();
    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const bobAddress = new ProtocolAddress("bob", 1);
    const aliceAddress = new ProtocolAddress("alice", 1);

    // Bundle with Kyber but WITHOUT one-time prekey
    const bobSignedPreKey = SignedPreKeyRecord.generate(1, bobIdentity, Date.now(), rng);
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

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    const plaintext = new TextEncoder().encode("No OTP but Kyber!");
    const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);

    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);
    const preKeyMsg = encrypted as PreKeySignalMessage;
    expect(preKeyMsg.messageVersion).toBe(4);
    expect(preKeyMsg.kyberPreKeyId).toBe(1);

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
    expect(new TextDecoder().decode(decrypted)).toBe("No OTP but Kyber!");
  });
});
