/**
 * WS-3: Session Hardening tests.
 *
 * Tests for:
 * - Stale session detection (unacknowledged pre-key older than 30 days)
 * - Self-session unlimited forward jumps
 * - SessionUsabilityRequirements
 * - Archived states max length cap at 40
 * - Kyber fields in PendingPreKey
 * - X3DH version rejection ordering
 * - Timestamp serialization round-trip
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
import { SessionRecord } from "../src/session/session-record.js";
import { SessionState, SessionUsabilityRequirements } from "../src/session/session-state.js";
import type { PendingPreKey } from "../src/session/session-state.js";
import { RootKey } from "../src/ratchet/root-key.js";
import { PqRatchetState } from "../src/ratchet/pq-ratchet.js";
import { SessionNotFoundError, InvalidMessageError } from "../src/error.js";
import {
  MAX_UNACKNOWLEDGED_SESSION_AGE_MS,
  ARCHIVED_STATES_MAX_LENGTH,
  MAX_FORWARD_JUMPS,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
} from "../src/constants.js";
import { createTestRng } from "./test-utils.js";

/**
 * Helper: create a full v4 prekey bundle and store all keys in the given store.
 */
function createBundleAndStore(
  identity: IdentityKeyPair,
  store: InMemorySignalProtocolStore,
  rng: ReturnType<typeof createTestRng>,
  registrationId: number,
  preKeyId = 1,
  signedPreKeyId = 1,
  kyberPreKeyId = 1,
) {
  const preKey = PreKeyRecord.generate(preKeyId, rng);
  const signedPreKey = SignedPreKeyRecord.generate(signedPreKeyId, identity, Date.now(), rng);
  const kyberPreKey = KyberPreKeyRecord.generate(kyberPreKeyId, identity, Date.now());

  store.storePreKey(preKey.id, preKey);
  store.storeSignedPreKey(signedPreKey.id, signedPreKey);
  store.storeKyberPreKey(kyberPreKey.id, kyberPreKey);

  const bundle = new PreKeyBundle({
    registrationId,
    deviceId: 1,
    preKeyId: preKey.id,
    preKey: preKey.keyPair.publicKey,
    signedPreKeyId: signedPreKey.id,
    signedPreKey: signedPreKey.keyPair.publicKey,
    signedPreKeySignature: signedPreKey.signature,
    identityKey: identity.identityKey,
    kyberPreKeyId: kyberPreKey.id,
    kyberPreKey: kyberPreKey.keyPair.publicKey,
    kyberPreKeySignature: kyberPreKey.signature,
  });

  return { bundle, signedPreKey, preKey, kyberPreKey };
}

/**
 * Helper to create a minimal SessionState for unit testing.
 */
function createMinimalSessionState(
  rng: ReturnType<typeof createTestRng>,
  opts: {
    version?: number;
    pendingPreKey?: PendingPreKey;
    withPqRatchet?: boolean;
    withSenderChain?: boolean;
  } = {},
): SessionState {
  const identity = IdentityKeyPair.generate(rng);
  const remoteIdentity = IdentityKeyPair.generate(rng);
  const state = new SessionState({
    sessionVersion: opts.version ?? CIPHERTEXT_MESSAGE_CURRENT_VERSION,
    localIdentityKey: identity.identityKey,
    remoteIdentityKey: remoteIdentity.identityKey,
    rootKey: new RootKey(rng.randomData(32)),
  });

  if (opts.pendingPreKey) {
    state.setPendingPreKey(opts.pendingPreKey);
  }

  if (opts.withPqRatchet) {
    state.setPqRatchetState(new PqRatchetState(rng.randomData(32)));
  }

  if (opts.withSenderChain) {
    const { KeyPair } = require("../src/keys/key-pair.js");
    const { ChainKey } = require("../src/ratchet/chain-key.js");
    const kp = KeyPair.generate(rng);
    const ck = new ChainKey(rng.randomData(32), 0);
    state.setSenderChain(kp, ck);
  }

  return state;
}

// ---------------------------------------------------------------------------
// 1. SessionUsabilityRequirements
// ---------------------------------------------------------------------------
describe("SessionUsabilityRequirements", () => {
  it("should define the correct flag values matching libsignal bitflags", () => {
    expect(SessionUsabilityRequirements.None).toBe(0);
    expect(SessionUsabilityRequirements.NotStale).toBe(1);
    expect(SessionUsabilityRequirements.EstablishedWithPqxdh).toBe(2);
    expect(SessionUsabilityRequirements.Spqr).toBe(4);
  });

  it("should support bitwise OR for combining requirements", () => {
    const combined =
      SessionUsabilityRequirements.NotStale | SessionUsabilityRequirements.EstablishedWithPqxdh;
    expect(combined).toBe(3);
    expect(combined & SessionUsabilityRequirements.NotStale).toBeTruthy();
    expect(combined & SessionUsabilityRequirements.EstablishedWithPqxdh).toBeTruthy();
    expect(combined & SessionUsabilityRequirements.Spqr).toBeFalsy();
  });

  describe("hasUsableSenderChain", () => {
    const rng = createTestRng();

    it("should return false if no sender chain exists", () => {
      const state = createMinimalSessionState(rng);
      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.None)).toBe(false);
    });

    it("should return true with None requirements if sender chain exists", () => {
      const state = createMinimalSessionState(rng, { withSenderChain: true });
      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.None)).toBe(true);
    });

    it("should detect stale session (NotStale requirement)", () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const state = createMinimalSessionState(rng, {
        withSenderChain: true,
        pendingPreKey: {
          preKeyId: 1,
          signedPreKeyId: 1,
          baseKey: rng.randomData(32),
          timestamp: thirtyOneDaysAgo,
        },
      });

      // With NotStale requirement, stale session is not usable
      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.NotStale)).toBe(
        false,
      );

      // Without NotStale requirement, it is still usable
      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.None)).toBe(true);
    });

    it("should allow fresh session with NotStale requirement", () => {
      const recentTimestamp = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago
      const state = createMinimalSessionState(rng, {
        withSenderChain: true,
        pendingPreKey: {
          preKeyId: 1,
          signedPreKeyId: 1,
          baseKey: rng.randomData(32),
          timestamp: recentTimestamp,
        },
      });

      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.NotStale)).toBe(
        true,
      );
    });

    it("should allow session with no pending pre-key as non-stale (acknowledged)", () => {
      const state = createMinimalSessionState(rng, { withSenderChain: true });
      // No pending pre-key means the session has been acknowledged
      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.NotStale)).toBe(
        true,
      );
    });

    it("should reject v3 session with EstablishedWithPqxdh requirement", () => {
      const state = createMinimalSessionState(rng, {
        version: CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
        withSenderChain: true,
      });

      expect(
        state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.EstablishedWithPqxdh),
      ).toBe(false);
    });

    it("should allow v4 session with EstablishedWithPqxdh requirement", () => {
      const state = createMinimalSessionState(rng, {
        version: CIPHERTEXT_MESSAGE_CURRENT_VERSION,
        withSenderChain: true,
      });

      expect(
        state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.EstablishedWithPqxdh),
      ).toBe(true);
    });

    it("should reject session without PQ ratchet state with Spqr requirement", () => {
      const state = createMinimalSessionState(rng, {
        withSenderChain: true,
        withPqRatchet: false,
      });

      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.Spqr)).toBe(false);
    });

    it("should allow session with PQ ratchet state with Spqr requirement", () => {
      const state = createMinimalSessionState(rng, {
        withSenderChain: true,
        withPqRatchet: true,
      });

      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.Spqr)).toBe(true);
    });

    it("should enforce combined requirements conjunctively", () => {
      // v4 session with PQ ratchet but stale
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const state = createMinimalSessionState(rng, {
        version: CIPHERTEXT_MESSAGE_CURRENT_VERSION,
        withSenderChain: true,
        withPqRatchet: true,
        pendingPreKey: {
          preKeyId: 1,
          signedPreKeyId: 1,
          baseKey: rng.randomData(32),
          timestamp: thirtyOneDaysAgo,
        },
      });

      // Passes individual checks except NotStale
      expect(
        state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.EstablishedWithPqxdh),
      ).toBe(true);
      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.Spqr)).toBe(true);
      expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.NotStale)).toBe(
        false,
      );

      // Combined fails because NotStale fails
      const allRequirements =
        SessionUsabilityRequirements.NotStale |
        SessionUsabilityRequirements.EstablishedWithPqxdh |
        SessionUsabilityRequirements.Spqr;
      expect(state.hasUsableSenderChain(Date.now(), allRequirements)).toBe(false);
    });
  });

  describe("SessionRecord.hasUsableSession", () => {
    const rng = createTestRng();

    it("should return false when no current session exists", () => {
      const record = SessionRecord.newFresh();
      expect(record.hasUsableSession(Date.now(), SessionUsabilityRequirements.None)).toBe(false);
    });

    it("should delegate to current session hasUsableSenderChain", () => {
      const state = createMinimalSessionState(rng, { withSenderChain: true });
      const record = new SessionRecord(state);
      expect(record.hasUsableSession(Date.now(), SessionUsabilityRequirements.None)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Stale Session Detection
// ---------------------------------------------------------------------------
describe("Stale session detection", () => {
  it("should have MAX_UNACKNOWLEDGED_SESSION_AGE_MS = 30 days in ms", () => {
    expect(MAX_UNACKNOWLEDGED_SESSION_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("should reject message encrypt on stale unacknowledged session", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    // Process bundle with a timestamp 31 days in the past
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng, thirtyOneDaysAgo);

    // Trying to encrypt should fail because the session is stale
    await expect(
      messageEncrypt(new TextEncoder().encode("hello"), bobAddress, aliceStore, aliceStore),
    ).rejects.toThrow(SessionNotFoundError);
  });

  it("should allow message encrypt on fresh unacknowledged session", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    // Process bundle with current timestamp (default)
    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Should succeed -- session is fresh
    const msg = await messageEncrypt(
      new TextEncoder().encode("hello"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    expect(msg).toBeDefined();
  });

  it("should allow message encrypt after session is acknowledged (no pending pre-key)", async () => {
    const rng = createTestRng();

    const aliceIdentity = IdentityKeyPair.generate(rng);
    const bobIdentity = IdentityKeyPair.generate(rng);

    const aliceStore = new InMemorySignalProtocolStore(aliceIdentity, 1);
    const bobStore = new InMemorySignalProtocolStore(bobIdentity, 2);

    const aliceAddress = new ProtocolAddress("alice", 1);
    const bobAddress = new ProtocolAddress("bob", 1);

    const { bundle: bobBundle } = createBundleAndStore(bobIdentity, bobStore, rng, 2);

    await processPreKeyBundle(bobBundle, bobAddress, aliceStore, aliceStore, rng);

    // Alice sends initial message
    const initial = await messageEncrypt(
      new TextEncoder().encode("init"),
      bobAddress,
      aliceStore,
      aliceStore,
    );

    // Bob decrypts -- this clears Alice's pending pre-key on next decrypt
    await messageDecrypt(
      initial,
      aliceAddress,
      bobStore,
      bobStore,
      bobStore,
      bobStore,
      rng,
      bobStore,
    );

    // Bob replies
    const reply = await messageEncrypt(
      new TextEncoder().encode("reply"),
      aliceAddress,
      bobStore,
      bobStore,
    );

    // Alice decrypts Bob's reply -- clears pending pre-key
    await messageDecrypt(reply, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

    // Now Alice can keep sending -- no stale check applies (no pending pre-key)
    const msg = await messageEncrypt(
      new TextEncoder().encode("follow-up"),
      bobAddress,
      aliceStore,
      aliceStore,
    );
    expect(msg).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Self-Session Unlimited Forward Jumps
// ---------------------------------------------------------------------------
describe("Self-session unlimited forward jumps", () => {
  it("should allow forward jumps > MAX_FORWARD_JUMPS for self-sessions", async () => {
    const rng = createTestRng();

    // Create a single identity for both sides (self-session)
    const selfIdentity = IdentityKeyPair.generate(rng);

    const senderStore = new InMemorySignalProtocolStore(selfIdentity, 1);
    const receiverStore = new InMemorySignalProtocolStore(selfIdentity, 1);

    const selfAddress = new ProtocolAddress("self", 1);

    const { bundle } = createBundleAndStore(selfIdentity, receiverStore, rng, 1);

    await processPreKeyBundle(bundle, selfAddress, senderStore, senderStore, rng);

    // Establish session
    const initial = await messageEncrypt(
      new TextEncoder().encode("init"),
      selfAddress,
      senderStore,
      senderStore,
    );
    await messageDecrypt(
      initial,
      selfAddress,
      receiverStore,
      receiverStore,
      receiverStore,
      receiverStore,
      rng,
      receiverStore,
    );

    // Receiver replies to complete ratchet
    const reply = await messageEncrypt(
      new TextEncoder().encode("reply"),
      selfAddress,
      receiverStore,
      receiverStore,
    );
    await messageDecrypt(
      reply,
      selfAddress,
      senderStore,
      senderStore,
      senderStore,
      senderStore,
      rng,
    );

    // Send MAX_FORWARD_JUMPS + 10 messages without decrypting
    // (only store the last one)
    let lastMsg;
    for (let i = 0; i < MAX_FORWARD_JUMPS + 10; i++) {
      lastMsg = await messageEncrypt(
        new TextEncoder().encode(`msg-${i}`),
        selfAddress,
        senderStore,
        senderStore,
      );
    }

    // For a self-session, this should succeed despite exceeding MAX_FORWARD_JUMPS
    const decrypted = await messageDecrypt(
      lastMsg!,
      selfAddress,
      receiverStore,
      receiverStore,
      receiverStore,
      receiverStore,
      rng,
    );
    expect(new TextDecoder().decode(decrypted)).toBe(`msg-${MAX_FORWARD_JUMPS + 9}`);
  });

  it("should still reject forward jumps > MAX_FORWARD_JUMPS for non-self sessions", async () => {
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
      bobStore,
    );

    // Bob replies
    const reply = await messageEncrypt(
      new TextEncoder().encode("reply"),
      aliceAddress,
      bobStore,
      bobStore,
    );
    await messageDecrypt(reply, bobAddress, aliceStore, aliceStore, aliceStore, aliceStore, rng);

    // Send MAX_FORWARD_JUMPS + 2 messages
    let lastMsg;
    for (let i = 0; i < MAX_FORWARD_JUMPS + 2; i++) {
      lastMsg = await messageEncrypt(
        new TextEncoder().encode(`msg-${i}`),
        bobAddress,
        aliceStore,
        aliceStore,
      );
    }

    // For non-self session, this should fail
    await expect(
      messageDecrypt(lastMsg!, aliceAddress, bobStore, bobStore, bobStore, bobStore, rng),
    ).rejects.toThrow(InvalidMessageError);
  });
});

// ---------------------------------------------------------------------------
// 4. Archived States Max Length
// ---------------------------------------------------------------------------
describe("Archived states max length", () => {
  it("should have ARCHIVED_STATES_MAX_LENGTH = 40", () => {
    expect(ARCHIVED_STATES_MAX_LENGTH).toBe(40);
  });

  it("should cap previous sessions at 40 when archiving", () => {
    const rng = createTestRng();
    const record = SessionRecord.newFresh();

    // Create and archive 50 sessions
    for (let i = 0; i < 50; i++) {
      const state = createMinimalSessionState(rng, { withSenderChain: true });
      record.promoteState(state);
    }

    // Should have exactly ARCHIVED_STATES_MAX_LENGTH previous sessions
    expect(record.previousSessionStates().length).toBeLessThanOrEqual(ARCHIVED_STATES_MAX_LENGTH);
    expect(record.previousSessionStates().length).toBe(ARCHIVED_STATES_MAX_LENGTH);
    // And one current session
    expect(record.sessionState()).toBeDefined();
  });

  it("should drop oldest sessions when cap is exceeded", () => {
    const rng = createTestRng();
    const record = SessionRecord.newFresh();

    // Create 45 sessions (more than the cap)
    for (let i = 0; i < 45; i++) {
      const state = createMinimalSessionState(rng, { withSenderChain: true });
      record.promoteState(state);
    }

    // Previous sessions should be capped at 40
    expect(record.previousSessionStates().length).toBe(ARCHIVED_STATES_MAX_LENGTH);
  });

  it("should clear pending pre-key when archiving", () => {
    const rng = createTestRng();
    const record = SessionRecord.newFresh();

    // Create a state with pending pre-key
    const stateWithPending = createMinimalSessionState(rng, {
      withSenderChain: true,
      pendingPreKey: {
        preKeyId: 42,
        signedPreKeyId: 1,
        baseKey: rng.randomData(32),
        timestamp: Date.now(),
      },
    });

    record.promoteState(stateWithPending);

    // Archive it by promoting a new state
    const newState = createMinimalSessionState(rng, { withSenderChain: true });
    record.promoteState(newState);

    // The archived state should have its pending pre-key cleared
    const archived = record.previousSessionStates();
    expect(archived.length).toBe(1);
    expect(archived[0].pendingPreKey()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Kyber Fields in PendingPreKey
// ---------------------------------------------------------------------------
describe("Kyber fields in PendingPreKey", () => {
  it("should store and retrieve kyberPreKeyId and kyberCiphertext", () => {
    const rng = createTestRng();
    const state = createMinimalSessionState(rng);
    const kyberCiphertext = rng.randomData(1088); // Kyber768 ciphertext size

    state.setPendingPreKey({
      preKeyId: 1,
      signedPreKeyId: 2,
      baseKey: rng.randomData(32),
      timestamp: Date.now(),
      kyberPreKeyId: 42,
      kyberCiphertext,
    });

    const pending = state.pendingPreKey();
    expect(pending).toBeDefined();
    expect(pending!.kyberPreKeyId).toBe(42);
    expect(pending!.kyberCiphertext).toEqual(kyberCiphertext);
  });

  it("should serialize and deserialize Kyber fields correctly", () => {
    const rng = createTestRng();
    const state = createMinimalSessionState(rng, { withSenderChain: true });
    const kyberCiphertext = rng.randomData(64);

    state.setPendingPreKey({
      preKeyId: 10,
      signedPreKeyId: 20,
      baseKey: rng.randomData(32),
      timestamp: 1700000000000,
      kyberPreKeyId: 99,
      kyberCiphertext,
    });

    // Serialize and deserialize
    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);

    const pending = restored.pendingPreKey();
    expect(pending).toBeDefined();
    expect(pending!.preKeyId).toBe(10);
    expect(pending!.signedPreKeyId).toBe(20);
    expect(pending!.kyberPreKeyId).toBe(99);
    expect(pending!.kyberCiphertext).toEqual(kyberCiphertext);
  });

  it("should handle PendingPreKey without Kyber fields", () => {
    const rng = createTestRng();
    const state = createMinimalSessionState(rng, { withSenderChain: true });

    state.setPendingPreKey({
      preKeyId: 1,
      signedPreKeyId: 2,
      baseKey: rng.randomData(32),
      timestamp: Date.now(),
    });

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);

    const pending = restored.pendingPreKey();
    expect(pending).toBeDefined();
    expect(pending!.kyberPreKeyId).toBeUndefined();
    expect(pending!.kyberCiphertext).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Timestamp Serialization Round-Trip
// ---------------------------------------------------------------------------
describe("PendingPreKey timestamp serialization", () => {
  it("should preserve timestamp through serialize/deserialize", () => {
    const rng = createTestRng();
    const state = createMinimalSessionState(rng, { withSenderChain: true });
    const timestamp = 1700000000000; // fixed timestamp

    state.setPendingPreKey({
      preKeyId: 1,
      signedPreKeyId: 2,
      baseKey: rng.randomData(32),
      timestamp,
    });

    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);

    expect(restored.pendingPreKey()!.timestamp).toBe(timestamp);
  });

  it("should preserve stale detection across serialization", () => {
    const rng = createTestRng();
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;

    const state = createMinimalSessionState(rng, {
      withSenderChain: true,
      pendingPreKey: {
        preKeyId: 1,
        signedPreKeyId: 2,
        baseKey: rng.randomData(32),
        timestamp: thirtyOneDaysAgo,
      },
    });

    // Verify stale before serialization
    expect(state.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.NotStale)).toBe(
      false,
    );

    // Serialize and deserialize
    const serialized = state.serialize();
    const restored = SessionState.deserialize(serialized);

    // Should still be stale after round-trip
    expect(restored.hasUsableSenderChain(Date.now(), SessionUsabilityRequirements.NotStale)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. X3DH Version Rejection Ordering
// ---------------------------------------------------------------------------
describe("X3DH version rejection", () => {
  it("should have CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION = 3", () => {
    expect(CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION).toBe(3);
  });

  it("should have CIPHERTEXT_MESSAGE_CURRENT_VERSION = 4", () => {
    expect(CIPHERTEXT_MESSAGE_CURRENT_VERSION).toBe(4);
  });
});
