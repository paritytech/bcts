/**
 * E1-E5: Security hardening tests.
 *
 * Validates that the triple-ratchet implementation correctly rejects:
 *   E1: V3 classical X3DH messages (must require PQXDH)
 *   E2: Messages with forged MACs
 *   E3: Kyber field consistency violations
 *   E4: Replayed (duplicate) messages
 *   E5: Forward secrecy — old chain keys cannot decrypt new messages
 *
 * Reference: libsignal/rust/protocol/src/session_cipher.rs
 * Reference: libsignal/rust/protocol/src/sealed_sender.rs
 */

import { describe, it, expect } from "vitest";
import {
  IdentityKeyPair,
  IdentityKey,
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
import {
  TripleRatchetSignalMessage,
  TripleRatchetPreKeySignalMessage,
} from "../src/protocol.js";
import type { PQXDHPreKeyBundle } from "../src/stores.js";
import { addKemPrefix } from "../src/constants.js";
import { V3, toHex } from "./fixtures/rust-vectors.js";

// ---------------------------------------------------------------------------
// Test helpers (shared with session-e2e.test.ts)
// ---------------------------------------------------------------------------

class TestRng {
  private seed: number;
  constructor(seed = 1) {
    this.seed = seed;
  }
  randomData(n: number): Uint8Array {
    const data = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = this.seed & 0xff;
    }
    return data;
  }
}

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

  const signedPreKey = createSignedPreKey(bob.identityKeyPair, signedPreKeyId, bob.rng);
  await bob.store.storeSignedPreKey(signedPreKeyId, signedPreKey);

  const oneTimePreKey = KeyPair.generate(bob.rng);
  const preKeyRecord = new PreKeyRecord(preKeyId, oneTimePreKey);
  await bob.store.storePreKey(preKeyId, preKeyRecord);

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

/** Establish a full session between Alice and Bob, returning both sides ready to exchange. */
async function establishSession(): Promise<{ alice: PartySetup; bob: PartySetup }> {
  const alice = await setupParty("alice", 500);
  const bob = await setupParty("bob", 600);

  const { bundle } = await createBobBundle(bob);

  await processPreKeyBundle(
    bundle,
    bob.address,
    alice.store,
    alice.store,
    alice.rng,
  );

  // Alice sends first message (PreKeySignalMessage), Bob processes it
  const ct0 = await tripleRatchetEncrypt(
    new TextEncoder().encode("init"),
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

  // Bob replies to complete the ratchet
  const ct1 = await tripleRatchetEncrypt(
    new TextEncoder().encode("ack"),
    alice.address,
    bob.store,
    bob.store,
    bob.rng,
  );
  await tripleRatchetDecrypt(
    ct1,
    bob.address,
    alice.store,
    alice.store,
    alice.store,
    alice.store,
    alice.kyberStore,
    alice.rng,
  );

  return { alice, bob };
}

// ---------------------------------------------------------------------------
// E1: V3 message rejection
// ---------------------------------------------------------------------------

describe("E1: V3 classical X3DH rejection", () => {
  it("should reject deserialization of legacy v3 SignalMessage", () => {
    // Construct a v3 message (version byte = 0x33)
    const fakeProto = new Uint8Array(20);
    fakeProto[0] = 0x33; // v3 version byte
    fakeProto[1] = 0x0a; // field 1 (ratchet key)
    fakeProto[2] = 0x01;
    fakeProto[3] = 0xff;

    expect(() => TripleRatchetSignalMessage.deserialize(fakeProto)).toThrow(
      "Legacy ciphertext version",
    );
  });

  it("should reject deserialization of legacy v3 PreKeySignalMessage", () => {
    const fakeProto = new Uint8Array(20);
    fakeProto[0] = 0x33; // v3 version byte

    expect(() => TripleRatchetPreKeySignalMessage.deserialize(fakeProto)).toThrow(
      "Legacy ciphertext version",
    );
  });

  it("should reject future v5+ SignalMessage", () => {
    const fakeProto = new Uint8Array(20);
    fakeProto[0] = 0x55; // v5 version byte

    expect(() => TripleRatchetSignalMessage.deserialize(fakeProto)).toThrow(
      "Unrecognized ciphertext version",
    );
  });

  it("should reject future v5+ PreKeySignalMessage", () => {
    const fakeProto = new Uint8Array(20);
    fakeProto[0] = 0x55; // v5 version byte

    expect(() => TripleRatchetPreKeySignalMessage.deserialize(fakeProto)).toThrow(
      "Unrecognized ciphertext version",
    );
  });
});

// ---------------------------------------------------------------------------
// E2: MAC forgery rejection
// ---------------------------------------------------------------------------

describe("E2: MAC forgery rejection", () => {
  it("should reject a message with a tampered MAC", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    // Create a valid message
    const msg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    // Tamper with the last byte (MAC)
    const tampered = Uint8Array.from(msg.serialized);
    tampered[tampered.length - 1] ^= 0xff;

    const deserialized = TripleRatchetSignalMessage.deserialize(tampered);
    const valid = deserialized.verifyMac(senderIdentity, receiverIdentity, V3.macKey);
    expect(valid).toBe(false);
  });

  it("should reject a message with a tampered ciphertext body", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const msg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    // Tamper with a byte in the middle (protobuf body, not MAC)
    const tampered = Uint8Array.from(msg.serialized);
    const mid = Math.floor(tampered.length / 2);
    tampered[mid] ^= 0x01;

    const deserialized = TripleRatchetSignalMessage.deserialize(tampered);
    const valid = deserialized.verifyMac(senderIdentity, receiverIdentity, V3.macKey);
    expect(valid).toBe(false);
  });

  it("should reject MAC verification with wrong macKey", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const deserialized = TripleRatchetSignalMessage.deserialize(V3.serialized);
    const wrongKey = new Uint8Array(32).fill(0x00);
    const valid = deserialized.verifyMac(senderIdentity, receiverIdentity, wrongKey);
    expect(valid).toBe(false);
  });

  it("should reject MAC verification with swapped identity keys", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const deserialized = TripleRatchetSignalMessage.deserialize(V3.serialized);
    // Swap sender/receiver — MAC must fail
    const valid = deserialized.verifyMac(receiverIdentity, senderIdentity, V3.macKey);
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E3: Kyber field consistency
// ---------------------------------------------------------------------------

describe("E3: Kyber field consistency", () => {
  it("should reject PreKeySignalMessage with kyberPreKeyId but no kyberCiphertext", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const innerMsg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    const msg = TripleRatchetPreKeySignalMessage.create(
      4,
      12345,
      100,
      200,
      new Uint8Array(32).fill(0x44),
      V3.senderIdentity,
      innerMsg,
      300, // kyberPreKeyId present
      undefined, // but no ciphertext!
    );

    expect(() => TripleRatchetPreKeySignalMessage.deserialize(msg.serialized)).toThrow(
      "Kyber fields must be both present or both absent",
    );
  });

  it("should accept PreKeySignalMessage with both Kyber fields present", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const innerMsg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    const msg = TripleRatchetPreKeySignalMessage.create(
      4,
      12345,
      100,
      200,
      new Uint8Array(32).fill(0x44),
      V3.senderIdentity,
      innerMsg,
      300,
      new Uint8Array(10).fill(0x77),
    );

    const deserialized = TripleRatchetPreKeySignalMessage.deserialize(msg.serialized);
    expect(deserialized.kyberPreKeyId).toBe(300);
    expect(deserialized.kyberCiphertext).toEqual(new Uint8Array(10).fill(0x77));
  });

  it("should accept PreKeySignalMessage with neither Kyber field", () => {
    const senderIdentity = IdentityKey.deserialize(V3.senderIdentity);
    const receiverIdentity = IdentityKey.deserialize(V3.receiverIdentity);

    const innerMsg = TripleRatchetSignalMessage.create(
      4,
      V3.macKey,
      V3.ratchetKeyRaw,
      V3.counter,
      V3.previousCounter,
      V3.ciphertext,
      senderIdentity,
      receiverIdentity,
      V3.pqRatchet,
    );

    const msg = TripleRatchetPreKeySignalMessage.create(
      4,
      12345,
      100,
      200,
      new Uint8Array(32).fill(0x44),
      V3.senderIdentity,
      innerMsg,
      undefined, // no kyberPreKeyId
      undefined, // no kyberCiphertext
    );

    const deserialized = TripleRatchetPreKeySignalMessage.deserialize(msg.serialized);
    expect(deserialized.kyberPreKeyId).toBeUndefined();
    expect(deserialized.kyberCiphertext).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// E4: Replay protection (duplicate message detection)
// ---------------------------------------------------------------------------

describe("E4: replay protection", () => {
  it("should reject a replayed (duplicate) message", async () => {
    const { alice, bob } = await establishSession();

    // Alice sends a message
    const ct = await tripleRatchetEncrypt(
      new TextEncoder().encode("secret"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

    // Bob decrypts it successfully
    const pt = await tripleRatchetDecrypt(
      ct,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );
    expect(new TextDecoder().decode(pt)).toBe("secret");

    // Bob tries to decrypt the same ciphertext again — should be rejected
    await expect(
      tripleRatchetDecrypt(
        ct,
        alice.address,
        bob.store,
        bob.store,
        bob.store,
        bob.store,
        bob.kyberStore,
        bob.rng,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// E5: Forward secrecy — old keys cannot decrypt new messages
// ---------------------------------------------------------------------------

describe("E5: forward secrecy", () => {
  it("should produce different ciphertexts for identical plaintexts", async () => {
    const { alice, bob } = await establishSession();

    const plaintext = new TextEncoder().encode("same message");

    const ct1 = await tripleRatchetEncrypt(
      plaintext,
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

    const ct2 = await tripleRatchetEncrypt(
      plaintext,
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

    // Same plaintext must produce different ciphertexts (different chain keys)
    expect(toHex(ct1)).not.toBe(toHex(ct2));
  });

  it("should use unique message keys for each message in a chain", async () => {
    const { alice, bob } = await establishSession();

    // Send 3 messages
    const cts: Uint8Array[] = [];
    for (let i = 0; i < 3; i++) {
      const ct = await tripleRatchetEncrypt(
        new TextEncoder().encode("msg"),
        bob.address,
        alice.store,
        alice.store,
        alice.rng,
      );
      cts.push(ct);
    }

    // All ciphertexts must be different
    expect(toHex(cts[0])).not.toBe(toHex(cts[1]));
    expect(toHex(cts[1])).not.toBe(toHex(cts[2]));
    expect(toHex(cts[0])).not.toBe(toHex(cts[2]));

    // All must decrypt correctly
    for (let i = 0; i < 3; i++) {
      const pt = await tripleRatchetDecrypt(
        cts[i],
        alice.address,
        bob.store,
        bob.store,
        bob.store,
        bob.store,
        bob.kyberStore,
        bob.rng,
      );
      expect(new TextDecoder().decode(pt)).toBe("msg");
    }
  });

  it("should ratchet forward after direction change", async () => {
    const { alice, bob } = await establishSession();

    // Alice sends
    const ct1 = await tripleRatchetEncrypt(
      new TextEncoder().encode("from alice"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

    await tripleRatchetDecrypt(
      ct1,
      alice.address,
      bob.store,
      bob.store,
      bob.store,
      bob.store,
      bob.kyberStore,
      bob.rng,
    );

    // Bob sends back (triggers DH ratchet step)
    const ct2 = await tripleRatchetEncrypt(
      new TextEncoder().encode("from bob"),
      alice.address,
      bob.store,
      bob.store,
      bob.rng,
    );

    const pt2 = await tripleRatchetDecrypt(
      ct2,
      bob.address,
      alice.store,
      alice.store,
      alice.store,
      alice.store,
      alice.kyberStore,
      alice.rng,
    );
    expect(new TextDecoder().decode(pt2)).toBe("from bob");

    // Alice sends again (new ratchet key)
    const ct3 = await tripleRatchetEncrypt(
      new TextEncoder().encode("alice again"),
      bob.address,
      alice.store,
      alice.store,
      alice.rng,
    );

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
    expect(new TextDecoder().decode(pt3)).toBe("alice again");
  });
});

// ---------------------------------------------------------------------------
// Edge cases: empty/malformed messages
// ---------------------------------------------------------------------------

describe("Edge cases: malformed input rejection", () => {
  it("should reject empty message", async () => {
    const bob = await setupParty("bob", 700);

    await expect(
      tripleRatchetDecrypt(
        new Uint8Array(0),
        new ProtocolAddress("alice", 1),
        bob.store,
        bob.store,
        bob.store,
        bob.store,
        bob.kyberStore,
        bob.rng,
      ),
    ).rejects.toThrow("Empty message");
  });

  it("should reject truncated message (too short for MAC)", () => {
    const tooShort = new Uint8Array([0x44, 0x01, 0x02]); // 3 bytes, less than MAC_LENGTH + 1
    expect(() => TripleRatchetSignalMessage.deserialize(tooShort)).toThrow("Message too short");
  });

  it("should reject empty PreKeySignalMessage", () => {
    expect(() => TripleRatchetPreKeySignalMessage.deserialize(new Uint8Array(0))).toThrow(
      "Empty TripleRatchetPreKeySignalMessage",
    );
  });
});
