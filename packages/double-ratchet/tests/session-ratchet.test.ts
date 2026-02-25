/**
 * Multiple DH ratchet step tests.
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
import { createTestRng } from "./test-utils.js";

describe("DH Ratchet Steps", () => {
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

    return { aliceStore, bobStore, aliceAddress, bobAddress, rng };
  }

  it("should handle bidirectional communication with DH ratcheting", async () => {
    const { aliceStore, bobStore, aliceAddress, bobAddress, rng } = await setupSession();

    // Alice -> Bob
    const msg1 = await messageEncrypt(
      new TextEncoder().encode("Alice 1"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    const dec1 = await messageDecrypt(
      msg1,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(dec1)).toBe("Alice 1");

    // Bob -> Alice (triggers DH ratchet)
    const msg2 = await messageEncrypt(
      new TextEncoder().encode("Bob 1"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    const dec2 = await messageDecrypt(
      msg2,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(dec2)).toBe("Bob 1");

    // Alice -> Bob (another DH ratchet)
    const msg3 = await messageEncrypt(
      new TextEncoder().encode("Alice 2"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    const dec3 = await messageDecrypt(
      msg3,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(dec3)).toBe("Alice 2");

    // Bob -> Alice
    const msg4 = await messageEncrypt(
      new TextEncoder().encode("Bob 2"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    const dec4 = await messageDecrypt(
      msg4,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(dec4)).toBe("Bob 2");
  });

  it("should handle many ratchet steps", async () => {
    const { aliceStore, bobStore, aliceAddress, bobAddress, rng } = await setupSession();

    for (let i = 0; i < 20; i++) {
      const sender = i % 2 === 0 ? "Alice" : "Bob";
      const senderStore = i % 2 === 0 ? aliceStore : bobStore;
      const receiverStore = i % 2 === 0 ? bobStore : aliceStore;
      const senderAddress = i % 2 === 0 ? aliceAddress : bobAddress;
      const receiverAddress = i % 2 === 0 ? bobAddress : aliceAddress;

      const text = `${sender} message ${i}`;
      const encrypted = await messageEncrypt(
        new TextEncoder().encode(text),
        receiverAddress,
        senderStore,
        senderStore,
      );

      const decrypted = await messageDecrypt(
        encrypted,
        senderAddress,
        receiverStore,
        receiverStore,
        receiverStore,
        receiverStore,
        rng,
      );

      expect(new TextDecoder().decode(decrypted)).toBe(text);
    }
  });
});
