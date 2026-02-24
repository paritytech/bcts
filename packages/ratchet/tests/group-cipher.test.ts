import { describe, it, expect } from "vitest";
import {
  groupEncrypt,
  groupDecrypt,
  createSenderKeyDistributionMessage,
  processSenderKeyDistributionMessage,
} from "../src/group/group-cipher.js";
import { SenderKeyMessage } from "../src/protocol/sender-key-message.js";
import { SenderChainKey } from "../src/group/sender-chain-key.js";
import { SenderKeyRecord } from "../src/group/sender-key-record.js";
import { ProtocolAddress } from "../src/storage/interfaces.js";
import { InMemorySignalProtocolStore } from "../src/storage/in-memory-store.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { createTestRng } from "./test-utils.js";
import { DuplicateMessageError } from "../src/error.js";

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function randomBytes(size: number): Uint8Array {
  const data = new Uint8Array(size);
  crypto.getRandomValues(data);
  return data;
}

describe("SenderChainKey", () => {
  it("advances iteration and produces unique seeds", () => {
    let ck = new SenderChainKey(0, randomBytes(32));
    const seeds = new Set<string>();
    seeds.add(Array.from(ck.seed).join(","));
    for (let i = 1; i <= 10; i++) {
      ck = ck.next();
      expect(ck.iteration).toBe(i);
      const seedStr = Array.from(ck.seed).join(",");
      expect(seeds.has(seedStr)).toBe(false);
      seeds.add(seedStr);
    }
  });

  it("produces message keys", () => {
    const ck = new SenderChainKey(0, randomBytes(32));
    const mk = ck.senderMessageKey();
    expect(mk.iteration).toBe(0);
    expect(mk.cipherKey.length).toBe(32);
    expect(mk.iv.length).toBe(16);
  });
});

describe("SenderKeyRecord", () => {
  it("serializes and deserializes", () => {
    const record = new SenderKeyRecord();
    record.addSenderKeyState(3, 42, 0, randomBytes(32), randomBytes(32));
    const bytes = record.serialize();
    const restored = SenderKeyRecord.deserialize(bytes);
    expect(restored.senderKeyState()).toBeDefined();
    expect(restored.senderKeyState()!.chainId).toBe(42);
  });

  it("evicts oldest state when exceeding limit", () => {
    const record = new SenderKeyRecord();
    for (let i = 0; i < 6; i++) {
      record.addSenderKeyState(3, i, 0, randomBytes(32), randomBytes(32));
    }
    // Should have 5 states (MAX_SENDER_KEY_STATES)
    expect(record.senderKeyStateForChainId(5)).toBeDefined();
    expect(record.senderKeyStateForChainId(0)).toBeUndefined();
  });
});

describe("Group Cipher", () => {
  it("distributes, encrypts, and decrypts a message", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const bobId = IdentityKeyPair.generate(rng);
    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const bobStore = new InMemorySignalProtocolStore(bobId, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    // Alice creates sender key distribution message
    const skdm = await createSenderKeyDistributionMessage(
      aliceStore, aliceAddress, distributionId,
    );

    // Bob processes the distribution message
    await processSenderKeyDistributionMessage(
      aliceAddress, distributionId, skdm, bobStore,
    );

    // Alice encrypts
    const plaintext = new TextEncoder().encode("Hello group!");
    const skm = await groupEncrypt(
      aliceStore, aliceAddress, distributionId, plaintext,
    );

    // Bob decrypts
    const decrypted = await groupDecrypt(
      skm.serialized, bobStore, aliceAddress,
    );
    expect(decrypted).toEqual(plaintext);
  });

  it("decrypts multiple sequential messages", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const bobId = IdentityKeyPair.generate(rng);
    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const bobStore = new InMemorySignalProtocolStore(bobId, 2);
    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    const skdm = await createSenderKeyDistributionMessage(
      aliceStore, aliceAddress, distributionId,
    );
    await processSenderKeyDistributionMessage(
      aliceAddress, distributionId, skdm, bobStore,
    );

    for (let i = 0; i < 5; i++) {
      const pt = new TextEncoder().encode(`Message ${i}`);
      const skm = await groupEncrypt(aliceStore, aliceAddress, distributionId, pt);
      const dec = await groupDecrypt(skm.serialized, bobStore, aliceAddress);
      expect(dec).toEqual(pt);
    }
  });

  it("handles out-of-order messages", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const bobId = IdentityKeyPair.generate(rng);
    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const bobStore = new InMemorySignalProtocolStore(bobId, 2);
    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    const skdm = await createSenderKeyDistributionMessage(
      aliceStore, aliceAddress, distributionId,
    );
    await processSenderKeyDistributionMessage(
      aliceAddress, distributionId, skdm, bobStore,
    );

    // Encrypt 3 messages
    const messages: SenderKeyMessage[] = [];
    for (let i = 0; i < 3; i++) {
      const pt = new TextEncoder().encode(`Message ${i}`);
      messages.push(await groupEncrypt(aliceStore, aliceAddress, distributionId, pt));
    }

    // Decrypt in reverse order
    const dec2 = await groupDecrypt(messages[2].serialized, bobStore, aliceAddress);
    expect(dec2).toEqual(new TextEncoder().encode("Message 2"));

    const dec0 = await groupDecrypt(messages[0].serialized, bobStore, aliceAddress);
    expect(dec0).toEqual(new TextEncoder().encode("Message 0"));

    const dec1 = await groupDecrypt(messages[1].serialized, bobStore, aliceAddress);
    expect(dec1).toEqual(new TextEncoder().encode("Message 1"));
  });

  it("rejects duplicate messages", async () => {
    const rng = createTestRng();
    const aliceId = IdentityKeyPair.generate(rng);
    const bobId = IdentityKeyPair.generate(rng);
    const aliceStore = new InMemorySignalProtocolStore(aliceId, 1);
    const bobStore = new InMemorySignalProtocolStore(bobId, 2);
    const aliceAddress = new ProtocolAddress("alice", 1);
    const distributionId = generateUUID();

    const skdm = await createSenderKeyDistributionMessage(
      aliceStore, aliceAddress, distributionId,
    );
    await processSenderKeyDistributionMessage(
      aliceAddress, distributionId, skdm, bobStore,
    );

    const pt = new TextEncoder().encode("Hello");
    const skm = await groupEncrypt(aliceStore, aliceAddress, distributionId, pt);
    await groupDecrypt(skm.serialized, bobStore, aliceAddress);

    // Second decrypt of same message should fail
    await expect(
      groupDecrypt(skm.serialized, bobStore, aliceAddress),
    ).rejects.toThrow(DuplicateMessageError);
  });

  it("rejects unknown distribution ID", async () => {
    const rng = createTestRng();
    const bobId = IdentityKeyPair.generate(rng);
    const bobStore = new InMemorySignalProtocolStore(bobId, 2);
    const aliceAddress = new ProtocolAddress("alice", 1);

    // Create a fake SenderKeyMessage (won't parse, but store lookup will fail first)
    const fakeBytes = new Uint8Array(100);
    await expect(
      groupDecrypt(fakeBytes, bobStore, aliceAddress),
    ).rejects.toThrow();
  });
});
