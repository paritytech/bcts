/**
 * Behavioral fixes tests (H1, H2, H4, H5).
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
import { SessionRecord } from "../src/session/session-record.js";
import { SessionState } from "../src/session/session-state.js";
import { RootKey } from "../src/ratchet/root-key.js";
import { x25519RawAgreement } from "../src/crypto/agreement.js";
import { InvalidKeyError, DuplicateMessageError } from "../src/error.js";
import { KeyPair } from "../src/keys/key-pair.js";
import { createTestRng } from "./test-utils.js";

function setupAliceAndBob(rng: ReturnType<typeof createTestRng>) {
  const aliceIdentity = IdentityKeyPair.generate(rng);
  const bobIdentity = IdentityKeyPair.generate(rng);

  const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
  const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

  const bobAddress = new ProtocolAddress("bob", 1);
  const aliceAddress = new ProtocolAddress("alice", 1);

  const bobPreKey = PreKeyRecord.generate(1, rng);
  const bobSignedPreKey = SignedPreKeyRecord.generate(1, bobIdentity, Date.now(), rng);
  const bobKyberPreKey = KyberPreKeyRecord.generate(1, bobIdentity, Date.now());

  bobStore.storePreKey(bobPreKey.id, bobPreKey);
  bobStore.storeSignedPreKey(bobSignedPreKey.id, bobSignedPreKey);
  bobStore.storeKyberPreKey(bobKyberPreKey.id, bobKyberPreKey);

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

describe("H1: archiveCurrentState clears pending prekey", () => {
  it("should clear pending prekey when archiving session state", () => {
    const rng = createTestRng();
    const identity = IdentityKeyPair.generate(rng);

    const state = new SessionState({
      sessionVersion: 4,
      localIdentityKey: identity.identityKey,
      rootKey: new RootKey(rng.randomData(32)),
    });

    // Set a pending prekey
    state.setPendingPreKey({
      preKeyId: 42,
      signedPreKeyId: 1,
      baseKey: rng.randomData(32),
      timestamp: Date.now(),
    });

    expect(state.pendingPreKey()).toBeDefined();

    // Archive it
    const record = new SessionRecord(state);
    record.archiveCurrentState();

    // The archived state should have its pending prekey cleared
    const archived = record.previousSessionStates();
    expect(archived.length).toBe(1);
    expect(archived[0].pendingPreKey()).toBeUndefined();
  });
});

describe("H2: PreKey decrypt short-circuits on existing session", () => {
  it("should short-circuit retransmitted prekey message via existing session", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } = setupAliceAndBob(rng);

    // Alice processes Bob's bundle
    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Alice encrypts a message (produces PreKeySignalMessage)
    const plaintext = new TextEncoder().encode("Hello Bob!");
    const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);
    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);
    const preKeyMsg = encrypted as PreKeySignalMessage;

    // Bob decrypts it the first time (creates session, consumes prekey)
    const decrypted1 = await messageDecrypt(
      preKeyMsg,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(decrypted1)).toBe("Hello Bob!");

    // The one-time prekey (id=1) has been consumed and removed from Bob's store.
    // Alice retransmits the same PreKeySignalMessage.
    // Without H2: would throw InvalidKeyError("PreKey not found: 1") -- confusing.
    // With H2: short-circuits through existing session, correctly throws
    // DuplicateMessageError because the message key at counter 0 was already used.
    await expect(
      messageDecrypt(
        preKeyMsg,
        aliceAddress,
        bobStore,
        bobStore,
        bobStore,
        bobStore,
        rng,
        bobStore,
      ),
    ).rejects.toThrow(DuplicateMessageError);
  });

  it("should process a new prekey message after session already exists", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } = setupAliceAndBob(rng);

    // Alice processes Bob's bundle and sends first message
    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    const msg1 = await messageEncrypt(
      new TextEncoder().encode("Message 1"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    expect(msg1).toBeInstanceOf(PreKeySignalMessage);

    const decrypted1 = await messageDecrypt(
      msg1,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(decrypted1)).toBe("Message 1");

    // Alice sends a second message (still PreKeySignalMessage since Bob hasn't replied)
    const msg2 = await messageEncrypt(
      new TextEncoder().encode("Message 2"),
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // This should decrypt successfully -- the existing session handles it
    const decrypted2 = await messageDecrypt(
      msg2,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );
    expect(new TextDecoder().decode(decrypted2)).toBe("Message 2");
  });
});

describe("H4: DH agreement rejects invalid public keys", () => {
  it("should reject all-zero public key", () => {
    const rng = createTestRng();
    const privateKey = rng.randomData(32);
    const zeroKey = new Uint8Array(32);

    expect(() => x25519RawAgreement(privateKey, zeroKey)).toThrow(InvalidKeyError);
    expect(() => x25519RawAgreement(privateKey, zeroKey)).toThrow("low-order");
  });

  it("should accept valid public keys", () => {
    const rng = createTestRng();
    const kp1 = KeyPair.generate(rng);
    const kp2 = KeyPair.generate(rng);

    const result = x25519RawAgreement(kp1.privateKey, kp2.publicKey);
    expect(result.length).toBe(32);
    // Valid DH should not produce all-zero output
    expect(result.some((b) => b !== 0)).toBe(true);
  });
});

describe("H5: Root key validity check", () => {
  it("should succeed for normal DH ratchet steps", async () => {
    const rng = createTestRng();
    const { aliceStore, bobStore, aliceAddress, bobAddress, bobBundle } = setupAliceAndBob(rng);

    // Establish session
    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Exchange messages to trigger DH ratchet steps
    const plaintext = new TextEncoder().encode("Hello");
    const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);

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
    expect(new TextDecoder().decode(decrypted)).toBe("Hello");

    // Bob replies (triggers DH ratchet on Alice's side when she decrypts)
    const reply = new TextEncoder().encode("World");
    const bobEncrypted = await messageEncrypt(reply, aliceAddress, bobStore, bobStore);

    const aliceDecrypted = await messageDecrypt(
      bobEncrypted,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(aliceDecrypted)).toBe("World");
  });
});
