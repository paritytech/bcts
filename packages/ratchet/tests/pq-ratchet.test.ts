/**
 * PQ Ratchet (SPQR) state machine tests.
 *
 * Tests the sparse post-quantum ratchet state, wire format round-trip for
 * pqRatchet in SignalMessage, PQR initialization in v4 sessions, SPQR V0
 * integration, 96-byte HKDF key split, and pqRatchetState serialization.
 */

import { describe, it, expect } from "vitest";
import { PqRatchetState } from "../src/ratchet/pq-ratchet.js";
import { MessageKeys } from "../src/ratchet/message-keys.js";
import { RootKey } from "../src/ratchet/root-key.js";
import { ChainKey } from "../src/ratchet/chain-key.js";
import { SessionState } from "../src/session/session-state.js";
import { SignalMessage } from "../src/protocol/signal-message.js";
import { encodeSignalMessage, decodeSignalMessage } from "../src/protocol/proto.js";
import { hkdfSha256 } from "../src/crypto/kdf.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { KeyPair } from "../src/keys/key-pair.js";
import { PreKeyRecord, SignedPreKeyRecord } from "../src/keys/pre-key.js";
import { PreKeyBundle } from "../src/keys/pre-key-bundle.js";
import { KyberPreKeyRecord } from "../src/kem/kyber-pre-key.js";
import { ProtocolAddress } from "../src/storage/interfaces.js";
import { InMemorySignalProtocolStore } from "../src/storage/in-memory-store.js";
import { processPreKeyBundle } from "../src/x3dh/process-prekey-bundle.js";
import { messageEncrypt, messageDecrypt } from "../src/session/session-cipher.js";
import { PreKeySignalMessage } from "../src/protocol/pre-key-signal-message.js";
import { createTestRng } from "./test-utils.js";

describe("PQ Ratchet State", () => {
  it("should construct with 32-byte key", () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const state = new PqRatchetState(key);
    expect(state.rootKey()).toEqual(key);
  });

  it("should reject non-32-byte keys", () => {
    expect(() => new PqRatchetState(new Uint8Array(16))).toThrow(
      "PQ ratchet root key must be 32 bytes",
    );
    expect(() => new PqRatchetState(new Uint8Array(64))).toThrow(
      "PQ ratchet root key must be 32 bytes",
    );
  });

  it("should produce a constant message key per chain (no per-message advance)", () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const state = new PqRatchetState(key);

    const { messageKey: key1 } = state.send();
    const { messageKey: key2 } = state.send();

    // Same chain → same PQ message key (sparse ratchet)
    expect(key1).toEqual(key2);
    // Root key should NOT advance on send()
    expect(state.rootKey()).toEqual(key);
  });

  it("should produce deterministic output", () => {
    const key = new Uint8Array(32).fill(0x42);

    const state1 = new PqRatchetState(Uint8Array.from(key));
    const state2 = new PqRatchetState(Uint8Array.from(key));

    const result1 = state1.send();
    const result2 = state2.send();

    expect(result1.messageKey).toEqual(result2.messageKey);
    expect(state1.rootKey()).toEqual(state2.rootKey());
  });

  it("should produce different message keys from different root keys", () => {
    const state1 = new PqRatchetState(new Uint8Array(32).fill(0x01));
    const state2 = new PqRatchetState(new Uint8Array(32).fill(0x02));

    const result1 = state1.send();
    const result2 = state2.send();

    expect(result1.messageKey).not.toEqual(result2.messageKey);
  });

  it("should advance root key on ratchetStep (DH boundary)", () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const dhSecret = crypto.getRandomValues(new Uint8Array(32));
    const state = new PqRatchetState(key);

    state.ratchetStep(dhSecret);
    expect(state.rootKey()).not.toEqual(key);

    // After ratchetStep, send() produces a different key
    const state2 = new PqRatchetState(Uint8Array.from(key));
    const beforeStep = state2.send().messageKey;
    const afterStep = state.send().messageKey;
    expect(afterStep).not.toEqual(beforeStep);
  });

  it("should produce different keys after different DH secrets", () => {
    const key = new Uint8Array(32).fill(0x42);

    const state1 = new PqRatchetState(Uint8Array.from(key));
    const state2 = new PqRatchetState(Uint8Array.from(key));

    state1.ratchetStep(new Uint8Array(32).fill(0x01));
    state2.ratchetStep(new Uint8Array(32).fill(0x02));

    expect(state1.send().messageKey).not.toEqual(state2.send().messageKey);
  });

  it("should clone independently", () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const state = new PqRatchetState(key);
    const cloned = state.clone();

    state.ratchetStep(crypto.getRandomValues(new Uint8Array(32)));

    // Clone should be unaffected
    expect(cloned.rootKey()).toEqual(key);
    expect(state.rootKey()).not.toEqual(key);
  });

  it("should produce matching keys for send/recv pair", () => {
    const key = new Uint8Array(32).fill(0x42);
    const sender = new PqRatchetState(Uint8Array.from(key));
    const receiver = new PqRatchetState(Uint8Array.from(key));

    const { messageKey: sendKey, spqrMessage } = sender.send();
    const recvKey = receiver.recv(spqrMessage);

    expect(sendKey).toEqual(recvKey);
    expect(sender.rootKey()).toEqual(receiver.rootKey());
  });
});

describe("PQ Ratchet in SignalMessage proto", () => {
  it("should encode and decode pqRatchetKey field", () => {
    const pqKey = crypto.getRandomValues(new Uint8Array(32));
    const ratchetKey = new Uint8Array(33);
    ratchetKey[0] = 0x05;
    ratchetKey.set(crypto.getRandomValues(new Uint8Array(32)), 1);

    const encoded = encodeSignalMessage({
      ratchetKey,
      counter: 7,
      previousCounter: 5,
      ciphertext: new Uint8Array([1, 2, 3]),
      pqRatchetKey: pqKey,
    });

    const decoded = decodeSignalMessage(encoded);
    expect(decoded.pqRatchetKey).toEqual(pqKey);
    expect(decoded.counter).toBe(7);
    expect(decoded.previousCounter).toBe(5);
  });

  it("should omit pqRatchetKey when not provided", () => {
    const encoded = encodeSignalMessage({
      ratchetKey: new Uint8Array(33),
      counter: 1,
      previousCounter: 0,
      ciphertext: new Uint8Array([1]),
    });

    const decoded = decodeSignalMessage(encoded);
    expect(decoded.pqRatchetKey).toBeUndefined();
  });
});

describe("PQ Ratchet in SignalMessage", () => {
  const rng = createTestRng();

  it("should serialize and deserialize pqRatchet", () => {
    const macKey = rng.randomData(32);
    const ciphertext = rng.randomData(20);
    const senderRatchetKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const receiverIdentity = IdentityKeyPair.generate(rng);
    const pqKey = rng.randomData(32);

    const msg = SignalMessage.create(
      4,
      macKey,
      senderRatchetKey.publicKey,
      10,
      9,
      ciphertext,
      senderIdentity.identityKey,
      receiverIdentity.identityKey,
      pqKey,
    );

    expect(msg.pqRatchet).toEqual(pqKey);

    const deserialized = SignalMessage.deserialize(msg.serialized);
    expect(deserialized.pqRatchet).toEqual(pqKey);
    expect(deserialized.counter).toBe(10);
    expect(deserialized.previousCounter).toBe(9);
  });

  it("should leave pqRatchet undefined for v3 messages", () => {
    const macKey = rng.randomData(32);
    const ciphertext = rng.randomData(20);
    const senderRatchetKey = KeyPair.generate(rng);
    const senderIdentity = IdentityKeyPair.generate(rng);
    const receiverIdentity = IdentityKeyPair.generate(rng);

    const msg = SignalMessage.create(
      3,
      macKey,
      senderRatchetKey.publicKey,
      1,
      0,
      ciphertext,
      senderIdentity.identityKey,
      receiverIdentity.identityKey,
    );

    expect(msg.pqRatchet).toBeUndefined();

    const deserialized = SignalMessage.deserialize(msg.serialized);
    expect(deserialized.pqRatchet).toBeUndefined();
  });
});

describe("PQ Ratchet in v4 session", () => {
  it("should initialize PQR state in v4 sessions and exchange messages", async () => {
    const rng = createTestRng();
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

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Alice encrypts first message
    const plaintext = new TextEncoder().encode("PQ ratchet test!");
    const encrypted = await messageEncrypt(plaintext, bobAddress, aliceStore, aliceStore);

    expect(encrypted).toBeInstanceOf(PreKeySignalMessage);
    expect((encrypted as PreKeySignalMessage).messageVersion).toBe(4);

    // Bob decrypts
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
    expect(new TextDecoder().decode(decrypted)).toBe("PQ ratchet test!");

    // Bob responds
    const response = new TextEncoder().encode("PQ ratchet reply!");
    const bobEncrypted = await messageEncrypt(response, aliceAddress, bobStore, bobStore);

    expect(bobEncrypted).toBeInstanceOf(SignalMessage);

    const aliceDecrypted = await messageDecrypt(
      bobEncrypted,
      bobAddress,
      aliceStore,
      aliceStore,
      aliceStore,
      aliceStore,
      rng,
    );
    expect(new TextDecoder().decode(aliceDecrypted)).toBe("PQ ratchet reply!");
  });
});

// ============================================================================
// WS-1 Parts 1.2-1.4: SPQR Chain Integration Tests
// ============================================================================

describe("Task 1.2 — 96-byte HKDF Key Split", () => {
  it("should produce 3 x 32-byte keys from 96-byte HKDF output", () => {
    const secretInput = crypto.getRandomValues(new Uint8Array(128));
    const info = new TextEncoder().encode("WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024");

    const derived = hkdfSha256(secretInput, undefined, info, 96);
    expect(derived.length).toBe(96);

    const rootKey = derived.slice(0, 32);
    const chainKey = derived.slice(32, 64);
    const pqrKey = derived.slice(64, 96);

    expect(rootKey.length).toBe(32);
    expect(chainKey.length).toBe(32);
    expect(pqrKey.length).toBe(32);

    // All three keys should be different
    expect(rootKey).not.toEqual(chainKey);
    expect(chainKey).not.toEqual(pqrKey);
    expect(rootKey).not.toEqual(pqrKey);
  });

  it("should produce deterministic output for same input", () => {
    const secretInput = new Uint8Array(96).fill(0xaa);
    const info = new TextEncoder().encode("WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024");

    const derived1 = hkdfSha256(secretInput, undefined, info, 96);
    const derived2 = hkdfSha256(secretInput, undefined, info, 96);

    expect(derived1).toEqual(derived2);
  });

  it("should produce different outputs for different inputs", () => {
    const info = new TextEncoder().encode("WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024");

    const derived1 = hkdfSha256(new Uint8Array(96).fill(0x01), undefined, info, 96);
    const derived2 = hkdfSha256(new Uint8Array(96).fill(0x02), undefined, info, 96);

    expect(derived1).not.toEqual(derived2);
  });
});

describe("Task 1.3 — PQR Salt in Message Key Derivation", () => {
  it("should produce different message keys with vs without PQ salt", () => {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const pqSalt = crypto.getRandomValues(new Uint8Array(32));

    const keysWithout = MessageKeys.deriveFrom(seed, 0);
    const keysWith = MessageKeys.deriveFrom(seed, 0, pqSalt);

    // Same seed, different salt produces different keys
    expect(keysWithout.cipherKey).not.toEqual(keysWith.cipherKey);
    expect(keysWithout.macKey).not.toEqual(keysWith.macKey);
    expect(keysWithout.iv).not.toEqual(keysWith.iv);
  });

  it("should produce same keys without salt as with undefined salt", () => {
    const seed = crypto.getRandomValues(new Uint8Array(32));

    const keys1 = MessageKeys.deriveFrom(seed, 5);
    const keys2 = MessageKeys.deriveFrom(seed, 5, undefined);

    expect(keys1.cipherKey).toEqual(keys2.cipherKey);
    expect(keys1.macKey).toEqual(keys2.macKey);
    expect(keys1.iv).toEqual(keys2.iv);
    expect(keys1.counter).toBe(5);
    expect(keys2.counter).toBe(5);
  });

  it("should produce different keys for different PQ salts", () => {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const salt1 = new Uint8Array(32).fill(0x01);
    const salt2 = new Uint8Array(32).fill(0x02);

    const keys1 = MessageKeys.deriveFrom(seed, 0, salt1);
    const keys2 = MessageKeys.deriveFrom(seed, 0, salt2);

    expect(keys1.cipherKey).not.toEqual(keys2.cipherKey);
  });

  it("should use WhisperMessageKeys info string", () => {
    // Verify deterministic output to confirm the correct info string is used
    const seed = new Uint8Array(32).fill(0xab);
    const keys = MessageKeys.deriveFrom(seed, 0);

    expect(keys.cipherKey.length).toBe(32);
    expect(keys.macKey.length).toBe(32);
    expect(keys.iv.length).toBe(16);

    // Re-derive manually to confirm
    const info = new TextEncoder().encode("WhisperMessageKeys");
    const derived = hkdfSha256(seed, undefined, info, 80);
    expect(keys.cipherKey).toEqual(derived.slice(0, 32));
    expect(keys.macKey).toEqual(derived.slice(32, 64));
    expect(keys.iv).toEqual(derived.slice(64, 80));
  });
});

describe("Task 1.4 — SPQR V0 Integration", () => {
  const rng = createTestRng();

  describe("V0 PQ ratchet (disabled)", () => {
    it("should produce empty messages and null keys on send", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 3,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      // V0: no PQ ratchet state set
      expect(state.hasPqRatchetState()).toBe(false);

      const sendResult = state.pqRatchetSend();
      expect(sendResult.message.length).toBe(0);
      expect(sendResult.key).toBeNull();
    });

    it("should return null key on recv with empty message", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 3,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      const recvResult = state.pqRatchetRecv(new Uint8Array(0));
      expect(recvResult.key).toBeNull();
    });

    it("should return null key on recv with undefined message", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 3,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      const recvResult = state.pqRatchetRecv(undefined);
      expect(recvResult.key).toBeNull();
    });
  });

  describe("V1+ PQ ratchet (enabled via setPqRatchetState)", () => {
    it("should produce non-empty messages and real keys on send", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      const pqKey = rng.randomData(32);
      state.setPqRatchetState(new PqRatchetState(pqKey));

      expect(state.hasPqRatchetState()).toBe(true);

      const sendResult = state.pqRatchetSend();
      expect(sendResult.message.length).toBeGreaterThan(0);
      expect(sendResult.key).not.toBeNull();
      expect(sendResult.key!.length).toBe(32);
    });

    it("should produce matching send/recv keys", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const pqKey = rng.randomData(32);

      const senderState = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });
      senderState.setPqRatchetState(new PqRatchetState(Uint8Array.from(pqKey)));

      const receiverState = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });
      receiverState.setPqRatchetState(new PqRatchetState(Uint8Array.from(pqKey)));

      const sendResult = senderState.pqRatchetSend();
      const recvResult = receiverState.pqRatchetRecv(sendResult.message);

      expect(sendResult.key).toEqual(recvResult.key);
    });
  });

  describe("pqRatchetState serialization (field 15)", () => {
    it("should round-trip V0 (empty) pqRatchetState", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 3,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      // V0: no PQ state
      expect(state.hasPqRatchetState()).toBe(false);

      const serialized = state.serialize();
      const restored = SessionState.deserialize(serialized);

      expect(restored.hasPqRatchetState()).toBe(false);
      expect(restored.pqRatchetStateBytes().length).toBe(0);
    });

    it("should round-trip non-empty pqRatchetState (32-byte root key)", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const pqKey = rng.randomData(32);
      const state = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });
      state.setPqRatchetState(new PqRatchetState(pqKey));

      expect(state.hasPqRatchetState()).toBe(true);
      expect(state.pqRatchetStateBytes()).toEqual(pqKey);

      const serialized = state.serialize();
      const restored = SessionState.deserialize(serialized);

      expect(restored.hasPqRatchetState()).toBe(true);
      expect(restored.pqRatchetStateBytes()).toEqual(pqKey);
      expect(restored.pqRatchetState()).toBeDefined();
      expect(restored.pqRatchetState()!.rootKey()).toEqual(pqKey);
    });

    it("should round-trip raw bytes via setPqRatchetStateBytes", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const pqBytes = rng.randomData(32);
      const state = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });
      state.setPqRatchetStateBytes(pqBytes);

      const serialized = state.serialize();
      const restored = SessionState.deserialize(serialized);

      expect(restored.pqRatchetStateBytes()).toEqual(pqBytes);
      expect(restored.hasPqRatchetState()).toBe(true);
    });

    it("should clone pqRatchetStateBytes independently", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const pqKey = rng.randomData(32);
      const state = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });
      state.setPqRatchetState(new PqRatchetState(pqKey));

      const cloned = state.clone();

      // Modify original -- clone should be unaffected
      state.setPqRatchetStateBytes(new Uint8Array(0));
      expect(state.hasPqRatchetState()).toBe(false);
      expect(cloned.hasPqRatchetState()).toBe(true);
      expect(cloned.pqRatchetStateBytes()).toEqual(pqKey);
    });
  });

  describe("V0 session state behavior", () => {
    it("V0 pqRatchetSend returns empty message and null key consistently", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      // V0: explicitly empty state bytes
      state.setPqRatchetStateBytes(new Uint8Array(0));
      expect(state.hasPqRatchetState()).toBe(false);

      // Multiple sends all return V0 result
      for (let i = 0; i < 5; i++) {
        const result = state.pqRatchetSend();
        expect(result.message.length).toBe(0);
        expect(result.key).toBeNull();
      }
    });

    it("V0 pqRatchetRecv returns null key for empty and undefined messages", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      state.setPqRatchetStateBytes(new Uint8Array(0));

      expect(state.pqRatchetRecv(new Uint8Array(0)).key).toBeNull();
      expect(state.pqRatchetRecv(undefined).key).toBeNull();
    });

    it("transitioning from V0 to V1+ preserves correct behavior", () => {
      const idKeyPair = IdentityKeyPair.generate(rng);
      const state = new SessionState({
        sessionVersion: 4,
        localIdentityKey: idKeyPair.identityKey,
        rootKey: new RootKey(rng.randomData(32)),
      });

      // Start as V0
      expect(state.hasPqRatchetState()).toBe(false);
      expect(state.pqRatchetSend().key).toBeNull();

      // Transition to V1+ by setting PQ state
      const pqKey = rng.randomData(32);
      state.setPqRatchetState(new PqRatchetState(pqKey));
      expect(state.hasPqRatchetState()).toBe(true);

      const sendResult = state.pqRatchetSend();
      expect(sendResult.key).not.toBeNull();
      expect(sendResult.message.length).toBeGreaterThan(0);
    });
  });

  describe("V4 session cipher with PQ ratchet (end-to-end)", () => {
    it("should encrypt/decrypt multiple messages with PQ salt", async () => {
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

      await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

      // Send 3 messages Alice -> Bob
      for (let i = 0; i < 3; i++) {
        const plaintext = new TextEncoder().encode(`PQ message ${i}`);
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
        expect(new TextDecoder().decode(decrypted)).toBe(`PQ message ${i}`);
      }

      // Bob responds
      const response = new TextEncoder().encode("PQ response");
      const bobEncrypted = await messageEncrypt(response, aliceAddress, bobStore, bobStore);

      const aliceDecrypted = await messageDecrypt(
        bobEncrypted,
        bobAddress,
        aliceStore,
        aliceStore,
        aliceStore,
        aliceStore,
        rng,
      );
      expect(new TextDecoder().decode(aliceDecrypted)).toBe("PQ response");
    });
  });
});
