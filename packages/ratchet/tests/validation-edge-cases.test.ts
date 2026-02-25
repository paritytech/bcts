/**
 * Validation edge-case tests for the Signal Protocol.
 *
 * Tests boundary conditions, error paths, and security-critical
 * validation logic: simultaneous initiation, signature rejection,
 * version downgrade, forward jump limits, key eviction, failed
 * decrypt atomicity, and duplicate message rejection.
 *
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
import { SignalMessage } from "../src/protocol/signal-message.js";
import {
  SignatureValidationError,
  InvalidMessageError,
  DuplicateMessageError,
} from "../src/error.js";
import { MAX_FORWARD_JUMPS } from "../src/constants.js";
import { createTestRng } from "./test-utils.js";

/**
 * Helper: create a full v3 prekey bundle and store all keys in the given store.
 * Returns the bundle plus the identity so callers can build multiple bundles.
 */
function createBundleAndStore(
  identity: IdentityKeyPair,
  store: InMemorySignalProtocolStore,
  rng: ReturnType<typeof createTestRng>,
  registrationId: number,
  preKeyId = 1,
  signedPreKeyId = 1,
) {
  const preKey = PreKeyRecord.generate(preKeyId, rng);
  const signedPreKey = SignedPreKeyRecord.generate(signedPreKeyId, identity, Date.now(), rng);

  store.storePreKey(preKey.id, preKey);
  store.storeSignedPreKey(signedPreKey.id, signedPreKey);

  const bundle = new PreKeyBundle({
    registrationId,
    deviceId: 1,
    preKeyId: preKey.id,
    preKey: preKey.keyPair.publicKey,
    signedPreKeyId: signedPreKey.id,
    signedPreKey: signedPreKey.keyPair.publicKey,
    signedPreKeySignature: signedPreKey.signature,
    identityKey: identity.identityKey,
  });

  return { bundle, signedPreKey, preKey };
}

// ---------------------------------------------------------------------------
// 1. Simultaneous session initiation
// ---------------------------------------------------------------------------
describe("Simultaneous session initiation", () => {
  it("should allow both parties to decrypt when they initiate concurrently", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    // Both parties publish bundles
    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2, 1, 1);
    const { bundle: aliceBundle } = createBundleAndStore(
      aliceIdentity,
      aliceStore,
      rng,
      1,
      2,
      2,
    );

    // Both parties process each other's bundles concurrently
    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);
    await processPreKeyBundle(aliceBundle, aliceAddress, bobStore, bobStore, rng);

    // Alice sends to Bob (PreKeySignalMessage)
    const aliceMsg = await messageEncrypt(
      new TextEncoder().encode("Hello from Alice"),
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // Bob sends to Alice (PreKeySignalMessage)
    const bobMsg = await messageEncrypt(
      new TextEncoder().encode("Hello from Bob"),
      aliceAddress,
      bobStore,
      bobStore,
    );

    // Bob decrypts Alice's message
    const fromAlice = await messageDecrypt(
      aliceMsg,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(fromAlice)).toBe("Hello from Alice");

    // Alice decrypts Bob's message
    const fromBob = await messageDecrypt(
      bobMsg,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(fromBob)).toBe("Hello from Bob");

    // Both can continue exchanging messages
    const aliceMsg2 = await messageEncrypt(
      new TextEncoder().encode("Follow-up from Alice"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    const fromAlice2 = await messageDecrypt(
      aliceMsg2,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(fromAlice2)).toBe("Follow-up from Alice");
  });
});

// ---------------------------------------------------------------------------
// 2. Bad signed pre-key signature rejection
// ---------------------------------------------------------------------------
describe("Bad signed pre-key signature rejection", () => {
  it("should reject a bundle with a corrupted signed pre-key signature", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);

    const bobSignedPreKey = SignedPreKeyRecord.generate(1, bobIdentity, Date.now(), rng);

    // Corrupt the signed pre-key signature by flipping a bit
    const corruptedSignature = Uint8Array.from(bobSignedPreKey.signature);
    corruptedSignature[0] ^= 0x01;

    const badBundle = new PreKeyBundle({
      registrationId: 2,
      deviceId: 1,
      signedPreKeyId: bobSignedPreKey.id,
      signedPreKey: bobSignedPreKey.keyPair.publicKey,
      signedPreKeySignature: corruptedSignature,
      identityKey: bobIdentity.identityKey,
    });

    const bobAddress = new ProtocolAddress("bob", 1);

    await expect(
      processPreKeyBundle(badBundle, bobAddress, aliceStore, aliceStore, rng),
    ).rejects.toThrow(SignatureValidationError);
  });
});

// ---------------------------------------------------------------------------
// 3. Version downgrade rejection
// ---------------------------------------------------------------------------
describe("Version downgrade rejection", () => {
  it("should reject a SignalMessage with version 2 (legacy)", () => {
    // Build a raw message with version 2 in the high nibble
    const versionByte = (2 << 4) | 3; // version 2, low nibble current
    // Minimal message: version byte + at least enough for MAC_LENGTH check
    const fakeMessage = new Uint8Array(20);
    fakeMessage[0] = versionByte;

    expect(() => SignalMessage.deserialize(fakeMessage)).toThrow(InvalidMessageError);
    expect(() => SignalMessage.deserialize(fakeMessage)).toThrow("Legacy ciphertext version");
  });

  it("should reject a SignalMessage with version 5 (future)", () => {
    const versionByte = (5 << 4) | 3;
    const fakeMessage = new Uint8Array(20);
    fakeMessage[0] = versionByte;

    expect(() => SignalMessage.deserialize(fakeMessage)).toThrow(InvalidMessageError);
    expect(() => SignalMessage.deserialize(fakeMessage)).toThrow("Unrecognized ciphertext version");
  });
});

// ---------------------------------------------------------------------------
// 4. Chain forward jump limit
// ---------------------------------------------------------------------------
describe("Chain forward jump limit", () => {
  it("should reject a message with counter exceeding MAX_FORWARD_JUMPS", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Establish session with initial message
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

    // Bob replies to complete the ratchet
    const reply = await messageEncrypt(
      new TextEncoder().encode("reply"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(reply, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

    // Alice sends MAX_FORWARD_JUMPS + 1 messages (Bob doesn't decrypt any)
    // We only need to skip enough to exceed the limit; the actual test is
    // that the *counter* on the wire exceeds MAX_FORWARD_JUMPS from the
    // receiver's current chain index. We can create this scenario by encrypting
    // many messages without decrypting them.
    const skippedMessages = [];
    for (let i = 0; i < MAX_FORWARD_JUMPS + 2; i++) {
      const msg = await messageEncrypt(
        new TextEncoder().encode(`msg-${i}`),
        bobAddress,
        aliceStore,
        aliceStore,
      );
      skippedMessages.push(msg);
    }

    // The last message has counter = MAX_FORWARD_JUMPS + 1, which exceeds
    // the limit when Bob's receiver chain is at index 0.
    // The inner error is "too far into the future" but decryptMessageWithRecord
    // wraps it as "Decryption failed" (InvalidMessageError).
    const lastMsg = skippedMessages[skippedMessages.length - 1];
    await expect(
      messageDecrypt(lastMsg, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
    ).rejects.toThrow(InvalidMessageError);

    // Verify that MAX_FORWARD_JUMPS is 25000
    expect(MAX_FORWARD_JUMPS).toBe(25_000);
  });
});

// ---------------------------------------------------------------------------
// 5. Message key eviction at MAX_MESSAGE_KEYS
// ---------------------------------------------------------------------------
describe("Message key eviction at MAX_MESSAGE_KEYS", () => {
  it("should evict oldest message keys when exceeding MAX_MESSAGE_KEYS (2000)", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Establish session
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

    // Bob replies so both sides have a sending chain
    const reply = await messageEncrypt(
      new TextEncoder().encode("ack"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(reply, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

    // Alice sends 2002 messages without Bob decrypting
    const allMessages: Awaited<ReturnType<typeof messageEncrypt>>[] = [];
    for (let i = 0; i < 2002; i++) {
      const msg = await messageEncrypt(
        new TextEncoder().encode(`m${i}`),
        bobAddress,
        aliceStore,
        aliceStore,
      );
      allMessages.push(msg);
    }

    // Bob decrypts message 2001 (the last one) - this caches keys for 0..2000
    // but only keeps the most recent MAX_MESSAGE_KEYS (2000), evicting the oldest
    const last = await messageDecrypt(
      allMessages[2001],
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(last)).toBe("m2001");

    // Message 0's key was evicted. When caching 2001 intermediate keys
    // (counters 0..2000), the cache size exceeds MAX_MESSAGE_KEYS (2000)
    // after inserting counter 2000, so counter 0 (the oldest) is popped.
    // Trying to decrypt it throws DuplicateMessageError (key not found).
    await expect(
      messageDecrypt(allMessages[0], aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
    ).rejects.toThrow(DuplicateMessageError);

    // A message whose key was NOT evicted should still be decryptable.
    // Counter 1 is the last element in the cache, so it survived eviction.
    const msg1 = await messageDecrypt(
      allMessages[1],
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(msg1)).toBe("m1");
  });
});

// ---------------------------------------------------------------------------
// 6. Failed decrypt atomicity
// ---------------------------------------------------------------------------
describe("Failed decrypt atomicity", () => {
  it("should not corrupt session state after a failed decrypt attempt", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Establish session
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

    // Bob replies
    const ack = await messageEncrypt(
      new TextEncoder().encode("ack"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(ack, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

    // Alice sends a valid message
    const validMsg = await messageEncrypt(
      new TextEncoder().encode("valid message"),
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // Create a garbage message that will fail MAC verification
    // Corrupt the ciphertext bytes of a real message
    const corruptedMsg = await messageEncrypt(
      new TextEncoder().encode("will be corrupted"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    // Corrupt the serialized bytes (if it's a SignalMessage)
    if (corruptedMsg instanceof SignalMessage) {
      const corrupted = Uint8Array.from(corruptedMsg.serialized);
      // Flip a byte in the middle (protobuf/ciphertext area, not version or MAC)
      corrupted[Math.floor(corrupted.length / 2)] ^= 0xff;
      const badMsg = SignalMessage.deserialize(corrupted);

      // This should fail (MAC or decryption failure)
      await expect(
        messageDecrypt(badMsg, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
      ).rejects.toThrow();
    }

    // The session should still be intact -- decrypt the valid message
    const decrypted = await messageDecrypt(
      validMsg,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(decrypted)).toBe("valid message");
  });
});

// ---------------------------------------------------------------------------
// 7. Duplicate message rejection
// ---------------------------------------------------------------------------
describe("Duplicate message rejection", () => {
  it("should throw DuplicateMessageError when decrypting the same message twice", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Establish session
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

    // Bob replies to establish bidirectional session
    const ack = await messageEncrypt(
      new TextEncoder().encode("ack"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(ack, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

    // Alice sends a message
    const msg = await messageEncrypt(
      new TextEncoder().encode("secret"),
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // First decrypt succeeds
    const plaintext = await messageDecrypt(
      msg,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(plaintext)).toBe("secret");

    // Second decrypt should throw DuplicateMessageError
    await expect(
      messageDecrypt(msg, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
    ).rejects.toThrow(DuplicateMessageError);
  });

  it("should throw DuplicateMessageError even for out-of-order duplicates", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Establish session
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

    // Bob replies
    const ack = await messageEncrypt(
      new TextEncoder().encode("ack"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(ack, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

    // Alice sends 3 messages
    const msgs = [];
    for (let i = 0; i < 3; i++) {
      msgs.push(
        await messageEncrypt(
          new TextEncoder().encode(`msg-${i}`),
          bobAddress,
          aliceStore,
          aliceStore,
        ),
      );
    }

    // Bob decrypts msg-2 first (out of order), then msg-0
    const d2 = await messageDecrypt(
      msgs[2],
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(d2)).toBe("msg-2");

    const d0 = await messageDecrypt(
      msgs[0],
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
    );
    expect(new TextDecoder().decode(d0)).toBe("msg-0");

    // Trying to decrypt msg-0 again should throw DuplicateMessageError
    await expect(
      messageDecrypt(msgs[0], aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
    ).rejects.toThrow(DuplicateMessageError);
  });
});
