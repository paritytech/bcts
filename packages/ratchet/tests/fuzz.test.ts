/**
 * Fuzz tests for the Signal Protocol ratchet implementation.
 *
 * Randomized testing to verify robustness under:
 * - Random message sequences and directions
 * - Random out-of-order delivery
 * - Malformed protobuf inputs
 * - Rapid chain advancement
 * - Group cipher random sequences
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
import { SessionState } from "../src/session/session-state.js";
import { SessionRecord } from "../src/session/session-record.js";
import {
  groupEncrypt,
  groupDecrypt,
  createSenderKeyDistributionMessage,
  processSenderKeyDistributionMessage,
} from "../src/group/group-cipher.js";
import { createTestRng } from "./test-utils.js";

// --- Helpers ---

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomBytes(size: number): Uint8Array {
  const data = new Uint8Array(size);
  crypto.getRandomValues(data);
  return data;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function randomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Set up a v3 (X3DH) session between Alice and Bob. */
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

  // Send initial message to establish the session on both sides
  const initial = await messageEncrypt(
    new TextEncoder().encode("init"),
    bobAddress,
    aliceStore,
    aliceStore,
  );
  await messageDecrypt(initial, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng);

  // Bob replies to complete the ratchet handshake
  const reply = await messageEncrypt(
    new TextEncoder().encode("init-reply"),
    aliceAddress,
    bobStore,
    bobStore,
  );
  await messageDecrypt(reply, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

  return { aliceStore, bobStore, aliceAddress, bobAddress, rng };
}

// --- Tests ---

describe("Fuzz: Random message sequence", () => {
  it("should correctly encrypt/decrypt 50 random-direction messages", async () => {
    const { aliceStore, bobStore, aliceAddress, bobAddress, rng } = await setupSession();

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    for (let i = 0; i < 50; i++) {
      const msgLength = randomInt(1, 200);
      const text = randomString(msgLength);
      const plaintext = encoder.encode(text);

      // Random direction: true = Alice->Bob, false = Bob->Alice
      const aliceToBob = Math.random() < 0.5;

      if (aliceToBob) {
        const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);
        const decrypted = await messageDecrypt(
          encrypted,
          aliceAddress,
          bobStore,
          bobStore,
          bobStore,
          bobStore,
          rng,
        );
        expect(decoder.decode(decrypted)).toBe(text);
      } else {
        const encrypted = await messageEncrypt(plaintext, aliceAddress, bobStore, bobStore);
        const decrypted = await messageDecrypt(
          encrypted,
          bobAddress,
          aliceStore,
          aliceStore,
          aliceStore,
          aliceStore,
          rng,
        );
        expect(decoder.decode(decrypted)).toBe(text);
      }
    }
  }, 30_000);
});

describe("Fuzz: Random out-of-order delivery", () => {
  it("should decrypt 20 messages delivered in random shuffled order", async () => {
    const { aliceStore, bobStore, aliceAddress, bobAddress, rng } = await setupSession();

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const count = 20;

    // Alice encrypts 20 messages
    const messages: {
      index: number;
      text: string;
      encrypted: Awaited<ReturnType<typeof messageEncrypt>>;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const text = `ooo-msg-${i}-${randomString(randomInt(5, 50))}`;
      const encrypted = await messageEncrypt(
        encoder.encode(text),
        bobAddress,
        aliceStore,
        aliceStore,
      );
      messages.push({ index: i, text, encrypted });
    }

    // Shuffle delivery order
    const shuffled = shuffle([...messages]);

    // Bob decrypts in shuffled order
    for (const msg of shuffled) {
      const decrypted = await messageDecrypt(
        msg.encrypted,
        aliceAddress,
        bobStore,
        bobStore,
        bobStore,
        bobStore,
        rng,
      );
      expect(decoder.decode(decrypted)).toBe(msg.text);
    }
  }, 30_000);
});

describe("Fuzz: Malformed protobuf — SignalMessage", () => {
  it("should handle 100 random byte arrays without crashing", async () => {
    for (let i = 0; i < 100; i++) {
      const length = randomInt(1, 500);
      const data = randomBytes(length);
      try {
        SignalMessage.deserialize(data);
        // If it parses, that is fine -- the important thing is no crash/hang
      } catch {
        // Expected: InvalidMessageError or similar
      }
    }
  }, 15_000);

  it("should handle edge-case byte arrays", () => {
    // Empty
    expect(() => SignalMessage.deserialize(new Uint8Array(0))).toThrow();

    // Single byte
    expect(() => SignalMessage.deserialize(new Uint8Array([0x33]))).toThrow();

    // All zeros
    expect(() => SignalMessage.deserialize(new Uint8Array(100))).toThrow();

    // All 0xFF
    expect(() => SignalMessage.deserialize(new Uint8Array(100).fill(0xff))).toThrow();

    // Just the minimum length (9 bytes: 1 version + 8 MAC)
    expect(() => SignalMessage.deserialize(new Uint8Array(9))).toThrow();
  });
});

describe("Fuzz: Malformed protobuf — SessionState", () => {
  it("should handle 100 random byte arrays without crashing", async () => {
    for (let i = 0; i < 100; i++) {
      const length = randomInt(1, 1000);
      const data = randomBytes(length);
      try {
        SessionState.deserialize(data);
      } catch {
        // Expected: InvalidSessionError, InvalidProtobufError, or similar
      }
    }
  }, 15_000);

  it("should handle edge-case byte arrays", () => {
    // Empty
    expect(() => SessionState.deserialize(new Uint8Array(0))).toThrow();

    // Single byte
    expect(() => SessionState.deserialize(new Uint8Array([0x08]))).toThrow();

    // All zeros
    expect(() => SessionState.deserialize(new Uint8Array(50))).toThrow();

    // All 0xFF
    expect(() => SessionState.deserialize(new Uint8Array(50).fill(0xff))).toThrow();
  });
});

describe("Fuzz: Malformed protobuf — SessionRecord", () => {
  it("should handle 100 random byte arrays without crashing", async () => {
    for (let i = 0; i < 100; i++) {
      const length = randomInt(1, 1000);
      const data = randomBytes(length);
      try {
        SessionRecord.deserialize(data);
      } catch {
        // Expected: various deserialization errors
      }
    }
  }, 15_000);

  it("should handle edge-case byte arrays", () => {
    // Empty -- may produce an empty record (valid protobuf with no fields)
    try {
      const record = SessionRecord.deserialize(new Uint8Array(0));
      // If it succeeds, the record should at least be usable
      expect(record.sessionState()).toBeUndefined();
    } catch {
      // Also acceptable
    }

    // All 0xFF
    expect(() => SessionRecord.deserialize(new Uint8Array(100).fill(0xff))).toThrow();

    // Valid-looking length prefix but truncated
    expect(() => SessionRecord.deserialize(new Uint8Array([0x0a, 0x80, 0x01]))).toThrow();
  });
});

describe("Fuzz: Rapid chain advancement", () => {
  it("should handle 100 messages encrypted then decrypted in order", async () => {
    const { aliceStore, bobStore, aliceAddress, bobAddress, rng } = await setupSession();

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const count = 100;

    // Alice encrypts 100 messages (advances sender chain rapidly)
    const encrypted: {
      msg: Awaited<ReturnType<typeof messageEncrypt>>;
      text: string;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const text = `chain-${i}`;
      const msg = await messageEncrypt(encoder.encode(text), bobAddress, aliceStore, aliceStore);
      encrypted.push({ msg, text });
    }

    // Bob decrypts all 100 in order
    for (let i = 0; i < count; i++) {
      const decrypted = await messageDecrypt(
        encrypted[i].msg,
        aliceAddress,
        bobStore,
        bobStore,
        bobStore,
        bobStore,
        rng,
      );
      expect(decoder.decode(decrypted)).toBe(encrypted[i].text);
    }
  }, 30_000);
});

describe("Fuzz: Group cipher random sequence", () => {
  it("should handle 30 random messages from 3 senders", async () => {
    const rng = createTestRng();
    const distributionId = generateUUID();

    // Create 3 participants
    const participants = ["alice", "bob", "carol"].map((name, idx) => {
      const identity = IdentityKeyPair.generate(rng);
      const store = new InMemorySignalProtocolStore(identity, idx + 1);
      const address = new ProtocolAddress(name, 1);
      return { name, store, address };
    });

    // Each participant creates a sender key distribution message
    // and distributes it to all others
    for (const sender of participants) {
      const skdm = await createSenderKeyDistributionMessage(
        sender.store,
        sender.address,
        distributionId,
      );

      for (const receiver of participants) {
        if (receiver.name !== sender.name) {
          await processSenderKeyDistributionMessage(
            sender.address,
            distributionId,
            skdm,
            receiver.store,
          );
        }
      }
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Send 30 random messages from random senders
    for (let i = 0; i < 30; i++) {
      const senderIdx = randomInt(0, participants.length);
      const sender = participants[senderIdx];

      const text = `group-${sender.name}-${i}-${randomString(randomInt(5, 30))}`;
      const plaintext = encoder.encode(text);

      const skm = await groupEncrypt(sender.store, sender.address, distributionId, plaintext);

      // All other participants decrypt
      for (const receiver of participants) {
        if (receiver.name !== sender.name) {
          const decrypted = await groupDecrypt(skm.serialized, receiver.store, sender.address);
          expect(decoder.decode(decrypted)).toBe(text);
        }
      }
    }
  }, 30_000);
});
