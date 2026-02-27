/**
 * S1-S3: Full session-level end-to-end tests.
 *
 * Tests the complete triple-ratchet lifecycle:
 *   S1: Alice↔Bob PQXDH handshake + message exchange
 *   S2: Multi-message ratchet progression
 *   S3: Out-of-order message delivery
 *
 * These tests use real ML-KEM-1024 keys and actual crypto operations,
 * exercising the full stack: processPreKeyBundle → encrypt → decrypt.
 *
 * Reference: libsignal/rust/protocol/tests/session.rs (test_basic_prekey,
 *            test_message_key_limits, test_basic_simultaneous_initiate)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  IdentityKeyPair,
  KeyPair,
  SignedPreKeyRecord,
  PreKeyRecord,
  InMemorySignalProtocolStore,
  ProtocolAddress,
  xeddsaSign,
} from "@bcts/double-ratchet";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";

import {
  processPreKeyBundle,
  tripleRatchetEncrypt,
  tripleRatchetDecrypt,
  KyberPreKeyRecord,
  InMemoryKyberPreKeyStore,
} from "../src/index.js";
import type { PQXDHPreKeyBundle } from "../src/stores.js";
import { addKemPrefix } from "../src/constants.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Simple deterministic RNG for tests (NOT cryptographically secure). */
class TestRng {
  private seed: number;
  constructor(seed = 1) {
    this.seed = seed;
  }
  private next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed;
  }
  nextU32(): number {
    return this.next() >>> 0;
  }
  nextU64(): bigint {
    const lo = BigInt(this.nextU32());
    const hi = BigInt(this.nextU32());
    return (hi << 32n) | lo;
  }
  fillBytes(dest: Uint8Array): void {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = this.next() & 0xff;
    }
  }
  randomData(n: number): Uint8Array {
    const data = new Uint8Array(n);
    this.fillBytes(data);
    return data;
  }
  fillRandomData(data: Uint8Array): void {
    this.fillBytes(data);
  }
}

/** Create a signed pre-key record with a valid signature. */
function createSignedPreKey(
  identityKeyPair: IdentityKeyPair,
  id: number,
  rng: TestRng,
): SignedPreKeyRecord {
  const keyPair = KeyPair.generate(rng);
  const serializedPk = new Uint8Array(33);
  serializedPk[0] = 0x05;
  serializedPk.set(keyPair.publicKey, 1);
  const signature = xeddsaSign(identityKeyPair.privateKey, serializedPk, rng.randomData(64));
  return new SignedPreKeyRecord(id, keyPair, signature, Date.now());
}

/** Create a Kyber pre-key record with a valid signature. */
function createKyberPreKey(
  identityKeyPair: IdentityKeyPair,
  id: number,
  rng: TestRng,
): KyberPreKeyRecord {
  const { publicKey, secretKey } = ml_kem1024.keygen();
  const serializedPk = addKemPrefix(publicKey);
  const signature = xeddsaSign(identityKeyPair.privateKey, serializedPk, rng.randomData(64));
  return new KyberPreKeyRecord(id, { publicKey, secretKey }, signature, Date.now());
}

interface PartySetup {
  store: InMemorySignalProtocolStore;
  kyberStore: InMemoryKyberPreKeyStore;
  identityKeyPair: IdentityKeyPair;
  address: ProtocolAddress;
  rng: TestRng;
}

async function setupParty(name: string, seed: number): Promise<PartySetup> {
  const rng = new TestRng(seed);
  const identityKeyPair = IdentityKeyPair.generate(rng);
  const store = new InMemorySignalProtocolStore(identityKeyPair, 1);
  const kyberStore = new InMemoryKyberPreKeyStore();
  const address = new ProtocolAddress(name, 1);
  return { store, kyberStore, identityKeyPair, address, rng };
}

async function createBobBundle(bob: PartySetup): Promise<{
  bundle: PQXDHPreKeyBundle;
  signedPreKeyId: number;
  preKeyId: number;
  kyberPreKeyId: number;
}> {
  const signedPreKeyId = 1;
  const preKeyId = 100;
  const kyberPreKeyId = 200;

  // Create and store signed pre-key
  const signedPreKey = createSignedPreKey(bob.identityKeyPair, signedPreKeyId, bob.rng);
  await bob.store.storeSignedPreKey(signedPreKeyId, signedPreKey);

  // Create and store one-time EC pre-key
  const oneTimePreKey = KeyPair.generate(bob.rng);
  const preKeyRecord = new PreKeyRecord(preKeyId, oneTimePreKey);
  await bob.store.storePreKey(preKeyId, preKeyRecord);

  // Create and store Kyber pre-key
  const kyberPreKey = createKyberPreKey(bob.identityKeyPair, kyberPreKeyId, bob.rng);
  await bob.kyberStore.storeKyberPreKey(kyberPreKeyId, kyberPreKey);

  const bundle: PQXDHPreKeyBundle = {
    registrationId: 1,
    deviceId: 1,
    preKeyId,
    preKey: oneTimePreKey.publicKey,
    signedPreKeyId,
    signedPreKey: signedPreKey.keyPair.publicKey,
    signedPreKeySignature: signedPreKey.signature,
    identityKey: bob.identityKeyPair.identityKey,
    kyberPreKeyId,
    kyberPreKey: kyberPreKey.keyPair.publicKey,
    kyberPreKeySignature: kyberPreKey.signature,
  };

  return { bundle, signedPreKeyId, preKeyId, kyberPreKeyId };
}

// ---------------------------------------------------------------------------
// S1: Full PQXDH handshake + message exchange
// ---------------------------------------------------------------------------

describe("S1: Alice↔Bob PQXDH handshake + message exchange", () => {
  let alice: PartySetup;
  let bob: PartySetup;

  beforeEach(async () => {
    alice = await setupParty("alice", 42);
    bob = await setupParty("bob", 84);
  });

  it("should complete full handshake and exchange messages", async () => {
    const { bundle } = await createBobBundle(bob);

    // Alice processes Bob's bundle → creates session
    await processPreKeyBundle(bundle, bob.address, alice.store, alice.store, alice.rng);

    // Alice encrypts first message (PreKeySignalMessage)
    const plaintext1 = new TextEncoder().encode("Hello Bob!");
    const encrypted1 = await tripleRatchetEncrypt(
      plaintext1,
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

    // Verify it's a PreKeySignalMessage (version byte 0x44 = v4)
    expect(encrypted1[0]).toBe(0x44);

    // Bob decrypts first message
    const decrypted1 = await tripleRatchetDecrypt(
      encrypted1,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );

    expect(new TextDecoder().decode(decrypted1)).toBe("Hello Bob!");

    // Bob replies (SignalMessage, not PreKey)
    const plaintext2 = new TextEncoder().encode("Hello Alice!");
    const encrypted2 = await tripleRatchetEncrypt(
      plaintext2,
      alice.address,
      bob.store,
      bob.store,
      bob.rng,
    );

    // Alice decrypts Bob's reply
    const decrypted2 = await tripleRatchetDecrypt(
      encrypted2,
      bob.address,
      alice.store,
      alice.store,
      alice.store,
      alice.store,
      alice.kyberStore,
      alice.rng,
    );

    expect(new TextDecoder().decode(decrypted2)).toBe("Hello Alice!");
  });

  it("should consume the one-time Kyber pre-key after first message", async () => {
    const { bundle, kyberPreKeyId } = await createBobBundle(bob);

    await processPreKeyBundle(bundle, bob.address, alice.store, alice.store, alice.rng);

    const encrypted = await tripleRatchetEncrypt(
      new TextEncoder().encode("test"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

    await tripleRatchetDecrypt(
      encrypted,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );

    // Kyber pre-key should be consumed
    await expect(bob.kyberStore.loadKyberPreKey(kyberPreKeyId)).rejects.toThrow(
      "Kyber pre-key not found",
    );
  });
});

// ---------------------------------------------------------------------------
// S2: Multi-message ratchet progression
// ---------------------------------------------------------------------------

describe("S2: multi-message ratchet progression", () => {
  let alice: PartySetup;
  let bob: PartySetup;

  beforeEach(async () => {
    alice = await setupParty("alice", 100);
    bob = await setupParty("bob", 200);
  });

  it("should handle 10 messages in alternating directions", async () => {
    const { bundle } = await createBobBundle(bob);

    await processPreKeyBundle(bundle, bob.address, alice.store, alice.store, alice.rng);

    for (let i = 0; i < 10; i++) {
      const isAliceTurn = i % 2 === 0;
      const sender = isAliceTurn ? alice : bob;
      const receiver = isAliceTurn ? bob : alice;
      const senderAddr = isAliceTurn ? bob.address : alice.address;
      const receiverAddr = isAliceTurn ? alice.address : bob.address;

      const text = `Message ${i} from ${isAliceTurn ? "Alice" : "Bob"}`;
      const plaintext = new TextEncoder().encode(text);

      const encrypted = await tripleRatchetEncrypt(
        plaintext,
        senderAddr,
        sender.store,
        sender.store,
        sender.rng,
      );

      const decrypted = await tripleRatchetDecrypt(
        encrypted,
        receiverAddr,
        receiver.store,
        receiver.store,
        receiver.store,
        receiver.store,
        receiver.kyberStore,
        receiver.rng,
      );

      expect(new TextDecoder().decode(decrypted)).toBe(text);
    }
  });

  it("should handle multiple consecutive messages in one direction", async () => {
    const { bundle } = await createBobBundle(bob);

    await processPreKeyBundle(bundle, bob.address, alice.store, alice.store, alice.rng);

    // Alice sends 5 messages before Bob responds
    const encrypted: Uint8Array[] = [];
    for (let i = 0; i < 5; i++) {
      const ct = await tripleRatchetEncrypt(
        new TextEncoder().encode(`msg${i}`),
        bob.address,
        alice.store,
        alice.store,
        alice.rng,
      );
      encrypted.push(ct);
    }

    // Bob decrypts all 5 in order
    for (let i = 0; i < 5; i++) {
      const pt = await tripleRatchetDecrypt(
        encrypted[i],
        alice.address,
        bob.store,
        bob.store,
        bob.store,
        bob.store,
        bob.kyberStore,
        bob.rng,
      );
      expect(new TextDecoder().decode(pt)).toBe(`msg${i}`);
    }
  });
});

// ---------------------------------------------------------------------------
// S3: Out-of-order message delivery
// ---------------------------------------------------------------------------

describe("S3: out-of-order message delivery", () => {
  let alice: PartySetup;
  let bob: PartySetup;

  beforeEach(async () => {
    alice = await setupParty("alice", 300);
    bob = await setupParty("bob", 400);
  });

  it("should decrypt messages delivered out of order (same chain)", async () => {
    const { bundle } = await createBobBundle(bob);

    await processPreKeyBundle(bundle, bob.address, alice.store, alice.store, alice.rng);

    // Alice sends first message (prekey), Bob processes it to establish session
    const ct0 = await tripleRatchetEncrypt(
      new TextEncoder().encode("msg0"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );
    await tripleRatchetDecrypt(
      ct0,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );

    // Bob sends a reply to complete the ratchet
    const bobReply = await tripleRatchetEncrypt(
      new TextEncoder().encode("ack"),
      alice.address,
      bob.store,
      bob.store,
      bob.rng,
    );
    await tripleRatchetDecrypt(
      bobReply,
      bob.address,
      alice.store,
      alice.store,
      alice.store,
      alice.store,
      alice.kyberStore,
      alice.rng,
    );

    // Now Alice sends messages 1, 2, 3 (all on same sender chain)
    const ct1 = await tripleRatchetEncrypt(
      new TextEncoder().encode("msg1"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );
    const ct2 = await tripleRatchetEncrypt(
      new TextEncoder().encode("msg2"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );
    const ct3 = await tripleRatchetEncrypt(
      new TextEncoder().encode("msg3"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

    // Bob receives in order: msg3, msg1, msg2 (out of order)
    const pt3 = await tripleRatchetDecrypt(
      ct3,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );
    expect(new TextDecoder().decode(pt3)).toBe("msg3");

    const pt1 = await tripleRatchetDecrypt(
      ct1,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );
    expect(new TextDecoder().decode(pt1)).toBe("msg1");

    const pt2 = await tripleRatchetDecrypt(
      ct2,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );
    expect(new TextDecoder().decode(pt2)).toBe("msg2");
  });
});
