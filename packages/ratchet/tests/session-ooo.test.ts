/**
 * Out-of-order message handling tests.
 * All sessions use v3 (X3DH double ratchet).
 */

import { describe, it, expect } from "vitest";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { PreKeyRecord, SignedPreKeyRecord } from "../src/keys/pre-key.js";
import { PreKeyBundle } from "../src/keys/pre-key-bundle.js";
import { ProtocolAddress } from "../src/storage/interfaces.js";
import { InMemorySignalProtocolStore } from "../src/storage/in-memory-store.js";
import { processPreKeyBundle } from "../src/x3dh/process-prekey-bundle.js";
import { messageEncrypt, messageDecrypt } from "../src/session/session-cipher.js";
import { DuplicateMessageError } from "../src/error.js";
import { createTestRng } from "./test-utils.js";

describe("Out-of-Order Messages", () => {
  async function setupSession() {
    const rng = createTestRng();
    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const bobAddress = new ProtocolAddress("bob", 1);
    const aliceAddress = new ProtocolAddress("alice", 1);

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

    // Send initial message to establish session
    const initial = await messageEncrypt(
      new TextEncoder().encode("init"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    await messageDecrypt(
      initial,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );

    return { aliceStore, bobStore, aliceAddress, bobAddress, rng };
  }

  it("should decrypt messages received out of order", async () => {
    const { aliceStore, bobStore, aliceAddress, bobAddress, rng } = await setupSession();

    // Alice sends messages 0, 1, 2, 3, 4
    const messages: Awaited<ReturnType<typeof messageEncrypt>>[] = [];
    for (let i = 0; i < 5; i++) {
      const encrypted = await messageEncrypt(
        new TextEncoder().encode(`msg-${i}`),
        bobAddress,
        aliceStore,
        aliceStore,
      );
      messages.push(encrypted);
    }

    // Bob receives in order: 0, 2, 4, 1, 3
    const receiveOrder = [0, 2, 4, 1, 3];
    for (const idx of receiveOrder) {
      const decrypted = await messageDecrypt(
        messages[idx],
        aliceAddress,
        bobStore,
        bobStore,
        bobStore,
        bobStore,
        rng,
      );
      expect(new TextDecoder().decode(decrypted)).toBe(`msg-${idx}`);
    }
  });

  it("should detect duplicate messages", async () => {
    const { aliceStore, bobStore, aliceAddress, bobAddress, rng } = await setupSession();

    const encrypted = await messageEncrypt(
      new TextEncoder().encode("test"),
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // First decrypt succeeds
    await messageDecrypt(encrypted, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng);

    // Second decrypt should fail with duplicate
    await expect(
      messageDecrypt(encrypted, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
    ).rejects.toThrow(DuplicateMessageError);
  });
});
