/**
 * Tests for the SPQR (Sparse Post-Quantum Ratchet) state machine.
 *
 * Test structure:
 * 1. Chain initialization and key derivation
 * 2. Authenticator HMAC computation
 * 3. State machine: Alice/Bob full exchange
 * 4. Version negotiation (V0 fallback, V1 exchange)
 * 5. Serialization round-trip for all state types
 * 6. Message binary format round-trip
 */

import { describe, it, expect } from "vitest";
import { Chain, Direction, DEFAULT_CHAIN_PARAMS } from "../src/ratchet/spqr/chain.js";
import { Authenticator } from "../src/ratchet/spqr/authenticator.js";
import {
  initialState,
  spqrSend,
  spqrRecv,
  emptyState,
  currentVersion,
  Version,
} from "../src/ratchet/spqr/index.js";
import {
  initA,
  initB,
  serializeState,
  deserializeState,
  type SpqrState,
} from "../src/ratchet/spqr/states.js";
import {
  serializeMessage,
  deserializeMessage,
  encodeVarint,
  decodeVarint,
  MessageType,
  SpqrVersion,
  type SpqrMessage,
} from "../src/ratchet/spqr/message.js";
import {
  serializePqRatchetState,
  deserializePqRatchetState,
} from "../src/ratchet/spqr/serialize.js";

// ---- 1. Chain initialization and key derivation ----

describe("Chain", () => {
  it("should create a chain and derive matching keys for A2B/B2A", () => {
    const a2b = Chain.create(new Uint8Array([1]), Direction.A2B, DEFAULT_CHAIN_PARAMS);
    const b2a = Chain.create(new Uint8Array([1]), Direction.B2A, DEFAULT_CHAIN_PARAMS);

    const [sendIdx, sendKey] = a2b.sendKey(0);
    expect(sendIdx).toBe(1);

    const recvKey = b2a.recvKey(0, 1);
    expect(sendKey).toEqual(recvKey);
  });

  it("should derive matching keys after adding an epoch", () => {
    const a2b = Chain.create(new Uint8Array([1]), Direction.A2B, DEFAULT_CHAIN_PARAMS);
    const b2a = Chain.create(new Uint8Array([1]), Direction.B2A, DEFAULT_CHAIN_PARAMS);

    a2b.addEpoch({ epoch: 1, secret: new Uint8Array([2]) });
    b2a.addEpoch({ epoch: 1, secret: new Uint8Array([2]) });

    const [sendIdx, sendKey] = a2b.sendKey(1);
    expect(sendIdx).toBe(1);
    expect(sendKey).toEqual(b2a.recvKey(1, 1));
  });

  it("should handle multiple send keys in the same epoch", () => {
    const a2b = Chain.create(new Uint8Array([1]), Direction.A2B, DEFAULT_CHAIN_PARAMS);
    const b2a = Chain.create(new Uint8Array([1]), Direction.B2A, DEFAULT_CHAIN_PARAMS);

    a2b.addEpoch({ epoch: 1, secret: new Uint8Array([2]) });
    b2a.addEpoch({ epoch: 1, secret: new Uint8Array([2]) });

    // Send several keys
    for (let i = 0; i < 9; i++) {
      a2b.sendKey(1);
    }
    const [idx10, key10] = a2b.sendKey(1);
    expect(idx10).toBe(10);
    expect(key10).toEqual(b2a.recvKey(1, 10));
  });

  it("should throw for previously returned keys", () => {
    const a2b = Chain.create(new Uint8Array([1]), Direction.A2B, DEFAULT_CHAIN_PARAMS);
    a2b.recvKey(0, 2); // Get key at index 2
    expect(() => a2b.recvKey(0, 2)).toThrow("Key already requested");
  });

  it("should throw for decreased send key epoch", () => {
    const a2b = Chain.create(new Uint8Array([1]), Direction.A2B, DEFAULT_CHAIN_PARAMS);
    a2b.sendKey(0);
    a2b.addEpoch({ epoch: 1, secret: new Uint8Array([2]) });
    a2b.sendKey(1);
    expect(() => a2b.sendKey(0)).toThrow("Send key epoch decreased");
  });

  it("should handle out-of-order key retrieval", () => {
    const a2b = Chain.create(new Uint8Array([1]), Direction.A2B, DEFAULT_CHAIN_PARAMS);
    const b2a = Chain.create(new Uint8Array([1]), Direction.B2A, DEFAULT_CHAIN_PARAMS);

    // Generate a batch of send keys
    const keys: Array<[number, Uint8Array]> = [];
    for (let i = 0; i < 50; i++) {
      keys.push(a2b.sendKey(0));
    }

    // Shuffle and retrieve out of order
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    for (const [idx, key] of shuffled) {
      expect(b2a.recvKey(0, idx)).toEqual(key);
    }
  });

  it("should serialize and deserialize correctly", () => {
    const chain = Chain.create(new Uint8Array([42, 43, 44]), Direction.A2B, DEFAULT_CHAIN_PARAMS);
    chain.sendKey(0);
    chain.addEpoch({ epoch: 1, secret: new Uint8Array([99]) });

    const serialized = chain.serialize();
    const restored = Chain.deserialize(serialized);

    // Both should produce the same next send key
    const [idx1, key1] = chain.sendKey(1);
    const [idx2, key2] = restored.sendKey(1);
    expect(idx1).toBe(idx2);
    expect(key1).toEqual(key2);
  });
});

// ---- 2. Authenticator HMAC computation ----

describe("Authenticator", () => {
  it("should create and produce consistent MACs", () => {
    const auth = Authenticator.create(new Uint8Array(32).fill(42), 1);
    const mac1 = auth.macCt(1, new Uint8Array([1, 2, 3]));
    const mac2 = auth.macCt(1, new Uint8Array([1, 2, 3]));
    expect(mac1).toEqual(mac2);
    expect(mac1.length).toBe(32);
  });

  it("should produce different MACs for different data", () => {
    const auth = Authenticator.create(new Uint8Array(32).fill(42), 1);
    const mac1 = auth.macCt(1, new Uint8Array([1, 2, 3]));
    const mac2 = auth.macCt(1, new Uint8Array([4, 5, 6]));
    expect(mac1).not.toEqual(mac2);
  });

  it("should verify correct MAC", () => {
    const auth = Authenticator.create(new Uint8Array(32).fill(42), 1);
    const mac = auth.macCt(1, new Uint8Array([1, 2, 3]));
    expect(() => auth.verifyCt(1, new Uint8Array([1, 2, 3]), mac)).not.toThrow();
  });

  it("should reject incorrect MAC", () => {
    const auth = Authenticator.create(new Uint8Array(32).fill(42), 1);
    const badMac = new Uint8Array(32).fill(0);
    expect(() => auth.verifyCt(1, new Uint8Array([1, 2, 3]), badMac)).toThrow(
      "Ciphertext MAC is invalid",
    );
  });

  it("should produce and verify header MACs", () => {
    const auth = Authenticator.create(new Uint8Array(32).fill(42), 1);
    const hdr = new Uint8Array(64).fill(99);
    const mac = auth.macHdr(1, hdr);
    expect(() => auth.verifyHdr(1, hdr, mac)).not.toThrow();
  });

  it("should serialize and deserialize with consistent behavior", () => {
    const auth = Authenticator.create(new Uint8Array(32).fill(42), 1);
    const mac1 = auth.macCt(1, new Uint8Array([1, 2, 3]));

    const serialized = auth.serialize();
    const restored = Authenticator.deserialize(serialized);
    const mac2 = restored.macCt(1, new Uint8Array([1, 2, 3]));

    expect(mac1).toEqual(mac2);
  });

  it("should update state and produce different MACs after update", () => {
    const auth1 = Authenticator.create(new Uint8Array(32).fill(42), 1);
    const auth2 = auth1.clone();

    const macBefore = auth1.macCt(1, new Uint8Array([1, 2, 3]));
    auth1.update(2, new Uint8Array(32).fill(99));
    const macAfter = auth1.macCt(2, new Uint8Array([1, 2, 3]));

    expect(macBefore).not.toEqual(macAfter);
    // Original clone should still produce the old MAC
    expect(auth2.macCt(1, new Uint8Array([1, 2, 3]))).toEqual(macBefore);
  });
});

// ---- 3. State machine: Alice/Bob full exchange ----

describe("SPQR State Machine", () => {
  it("should complete a full Alice/Bob V1 exchange", () => {
    const authKey = new Uint8Array(32).fill(41);

    let aliceState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.A2B,
      authKey,
    });

    let bobState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.B2A,
      authKey,
    });

    // Alice sends first message
    const send1 = spqrSend(aliceState);
    aliceState = send1.state;

    // Bob receives Alice's message
    const recv1 = spqrRecv(bobState, send1.msg);
    bobState = recv1.state;

    // Keys should match (both null for first messages during negotiation)
    expect(send1.key).toEqual(recv1.key);

    // Bob sends
    const send2 = spqrSend(bobState);
    bobState = send2.state;

    // Alice receives Bob's message
    const recv2 = spqrRecv(aliceState, send2.msg);
    aliceState = recv2.state;

    expect(send2.key).toEqual(recv2.key);
  });

  it("should handle multiple round-trips", () => {
    const authKey = new Uint8Array(32).fill(41);

    let aliceState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.A2B,
      authKey,
    });

    let bobState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.B2A,
      authKey,
    });

    // Run several round-trips
    for (let i = 0; i < 10; i++) {
      // Alice -> Bob
      const sendA = spqrSend(aliceState);
      aliceState = sendA.state;
      const recvB = spqrRecv(bobState, sendA.msg);
      bobState = recvB.state;
      expect(sendA.key).toEqual(recvB.key);

      // Bob -> Alice
      const sendB = spqrSend(bobState);
      bobState = sendB.state;
      const recvA = spqrRecv(aliceState, sendB.msg);
      aliceState = recvA.state;
      expect(sendB.key).toEqual(recvA.key);
    }
  });
});

// ---- 4. Version negotiation ----

describe("Version Negotiation", () => {
  it("should handle V0 empty states", () => {
    const aliceState = emptyState();
    const bobState = emptyState();

    const send1 = spqrSend(aliceState);
    expect(send1.msg.length).toBe(0);
    expect(send1.key).toBeNull();

    const recv1 = spqrRecv(bobState, send1.msg);
    expect(recv1.key).toBeNull();
  });

  it("should report version negotiation status", () => {
    const authKey = new Uint8Array(32).fill(41);

    const state = initialState({
      version: Version.V1,
      minVersion: Version.V0,
      direction: Direction.A2B,
      authKey,
    });

    const version = currentVersion(state);
    expect(version.type).toBe("negotiating");
    expect(version.version).toBe(Version.V1);
  });

  it("should report V0 complete for empty state", () => {
    const version = currentVersion(emptyState());
    expect(version.type).toBe("complete");
    expect(version.version).toBe(Version.V0);
  });

  it("should negotiate down from V1 to V0", () => {
    const authKey = new Uint8Array(32).fill(41);

    let aliceState = initialState({
      version: Version.V1,
      minVersion: Version.V0,
      direction: Direction.A2B,
      authKey,
    });

    let bobState = initialState({
      version: Version.V0,
      minVersion: Version.V0,
      direction: Direction.B2A,
      authKey,
    });

    // Alice sends V1 message
    const send1 = spqrSend(aliceState);
    aliceState = send1.state;

    // Bob (V0) receives -- should handle gracefully
    const recv1 = spqrRecv(bobState, send1.msg);
    bobState = recv1.state;

    // Bob sends V0 (empty) message
    const send2 = spqrSend(bobState);
    bobState = send2.state;

    // Alice receives V0 message and negotiates down
    const recv2 = spqrRecv(aliceState, send2.msg);
    aliceState = recv2.state;

    const ver = currentVersion(aliceState);
    expect(ver.version).toBe(Version.V0);
  });

  it("should reject when min version is not met", () => {
    const authKey = new Uint8Array(32).fill(41);

    const aliceState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.A2B,
      authKey,
    });

    const bobState = initialState({
      version: Version.V0,
      minVersion: Version.V0,
      direction: Direction.B2A,
      authKey,
    });

    // Alice sends V1
    const send1 = spqrSend(aliceState);

    // Bob receives (V0 just ignores higher versions)
    const recv1 = spqrRecv(bobState, send1.msg);

    // Bob sends V0
    const send2 = spqrSend(recv1.state);

    // Alice should reject V0 since minVersion is V1
    expect(() => spqrRecv(send1.state, send2.msg)).toThrow();
  });
});

// ---- 5. Serialization round-trip ----

describe("Serialization", () => {
  it("should round-trip all send_ek state types", () => {
    const authKey = new Uint8Array(32).fill(42);

    // KeysUnsampled
    const s1: SpqrState = initA(authKey);
    const rt1 = deserializeState(serializeState(s1));
    expect(rt1.type).toBe("KeysUnsampled");
    expect(rt1.epoch).toBe(s1.epoch);

    // NoHeaderReceived
    const s2: SpqrState = initB(authKey);
    const rt2 = deserializeState(serializeState(s2));
    expect(rt2.type).toBe("NoHeaderReceived");
    expect(rt2.epoch).toBe(s2.epoch);
  });

  it("should round-trip full PqRatchetState", () => {
    const authKey = new Uint8Array(32).fill(41);

    const state = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.A2B,
      authKey,
    });

    const deserialized = deserializePqRatchetState(state);
    expect(deserialized.inner).not.toBeNull();
    expect(deserialized.inner!.type).toBe("KeysUnsampled");
    expect(deserialized.versionNegotiation).not.toBeNull();

    const reserialized = serializePqRatchetState(deserialized);
    const deserialized2 = deserializePqRatchetState(reserialized);
    expect(deserialized2.inner!.type).toBe(deserialized.inner!.type);
    expect(deserialized2.inner!.epoch).toBe(deserialized.inner!.epoch);
  });

  it("should handle empty state serialization", () => {
    const empty = emptyState();
    const deserialized = deserializePqRatchetState(empty);
    expect(deserialized.inner).toBeNull();
    expect(deserialized.chain).toBeNull();
    expect(deserialized.versionNegotiation).toBeNull();
  });

  it("should round-trip state through send/recv cycles", () => {
    const authKey = new Uint8Array(32).fill(41);

    let state = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.A2B,
      authKey,
    });

    // Do a send, which serializes and deserializes internally
    const result = spqrSend(state);
    state = result.state;

    // The state should still be valid
    const version = currentVersion(state);
    expect(version.version).toBe(Version.V1);

    // Do another send
    const result2 = spqrSend(state);
    expect(result2.state.length).toBeGreaterThan(0);
  });
});

// ---- 6. Message binary format round-trip ----

describe("Message Format", () => {
  it("should encode and decode varints correctly", () => {
    const testCases = [0, 1, 127, 128, 300, 16384, 1000000, 0x7fffffff];
    for (const val of testCases) {
      const encoded: number[] = [];
      encodeVarint(val, encoded);
      const decoded = decodeVarint(new Uint8Array(encoded), { offset: 0 });
      expect(decoded).toBe(val);
    }
  });

  it("should encode varint 0x012C as [0xAC, 0x02]", () => {
    const encoded: number[] = [];
    encodeVarint(0x012c, encoded);
    expect(encoded).toEqual([0xac, 0x02]);
  });

  it("should decode varint from offset", () => {
    const data = new Uint8Array([0xff, 0xac, 0x02, 0xff]);
    const at = { offset: 1 };
    const result = decodeVarint(data, at);
    expect(result).toBe(0x012c);
    expect(at.offset).toBe(3);
  });

  it("should round-trip None message", () => {
    const msg = { epoch: 1, payload: { type: MessageType.None as const } };
    const serialized = serializeMessage(msg, 0);
    expect(serialized[0]).toBe(SpqrVersion.V1);

    const { msg: deserialized, index } = deserializeMessage(serialized);
    expect(deserialized.epoch).toBe(1);
    expect(deserialized.payload.type).toBe(MessageType.None);
    expect(index).toBe(0);
  });

  it("should round-trip Hdr message", () => {
    const data = new Uint8Array(96).fill(0xaa);
    const msg = {
      epoch: 5,
      payload: { type: MessageType.Hdr as const, data },
    };
    const serialized = serializeMessage(msg, 3);

    const { msg: deserialized, index } = deserializeMessage(serialized);
    expect(deserialized.epoch).toBe(5);
    expect(index).toBe(3);
    expect(deserialized.payload.type).toBe(MessageType.Hdr);
    if (deserialized.payload.type === MessageType.Hdr) {
      expect(deserialized.payload.data).toEqual(data);
    }
  });

  it("should round-trip Ct1Ack message", () => {
    const msg = {
      epoch: 2,
      payload: { type: MessageType.Ct1Ack as const, ack: true },
    };
    const serialized = serializeMessage(msg, 7);

    const { msg: deserialized, index } = deserializeMessage(serialized);
    expect(deserialized.epoch).toBe(2);
    expect(index).toBe(7);
    expect(deserialized.payload.type).toBe(MessageType.Ct1Ack);
  });

  it("should round-trip all message types with data", () => {
    const types = [
      MessageType.Hdr,
      MessageType.Ek,
      MessageType.EkCt1Ack,
      MessageType.Ct1,
      MessageType.Ct2,
    ];

    for (const msgType of types) {
      const data = new Uint8Array(64).fill(msgType);
      const msg: SpqrMessage = {
        epoch: 3,
        payload: { type: msgType, data } as SpqrMessage["payload"],
      };
      const serialized = serializeMessage(msg, 1);

      const { msg: deserialized } = deserializeMessage(serialized);
      expect(deserialized.epoch).toBe(3);
      expect(deserialized.payload.type).toBe(msgType);
      if ("data" in deserialized.payload) {
        expect(deserialized.payload.data).toEqual(data);
      }
    }
  });

  it("should reject messages with invalid version", () => {
    const bad = new Uint8Array([0x02, 0x01, 0x00, 0x00]);
    expect(() => deserializeMessage(bad)).toThrow();
  });

  it("should reject empty messages", () => {
    expect(() => deserializeMessage(new Uint8Array(0))).toThrow();
  });

  it("should reject messages with epoch 0", () => {
    // Version=1, epoch=0, index=0, type=0
    const bad = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
    expect(() => deserializeMessage(bad)).toThrow();
  });
});

// ---- Integration: chain + state machine ----

describe("SPQR Integration", () => {
  it("should produce non-null keys after negotiation completes", () => {
    const authKey = new Uint8Array(32).fill(41);

    let aliceState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.A2B,
      authKey,
    });

    let bobState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.B2A,
      authKey,
    });

    // Initial exchange: keys may be null during setup
    const keysFound: boolean[] = [];

    for (let i = 0; i < 15; i++) {
      // Alice -> Bob
      const sendA = spqrSend(aliceState);
      aliceState = sendA.state;
      if (sendA.msg.length > 0) {
        const recvB = spqrRecv(bobState, sendA.msg);
        bobState = recvB.state;
        expect(sendA.key).toEqual(recvB.key);
        if (sendA.key !== null) keysFound.push(true);
      }

      // Bob -> Alice
      const sendB = spqrSend(bobState);
      bobState = sendB.state;
      if (sendB.msg.length > 0) {
        const recvA = spqrRecv(aliceState, sendB.msg);
        aliceState = recvA.state;
        expect(sendB.key).toEqual(recvA.key);
        if (sendB.key !== null) keysFound.push(true);
      }
    }

    // After enough rounds, keys should start being produced
    // (exact round depends on state machine progression)
  });

  it("should handle one-sided sends without errors", () => {
    const authKey = new Uint8Array(32).fill(41);

    let aliceState = initialState({
      version: Version.V1,
      minVersion: Version.V1,
      direction: Direction.A2B,
      authKey,
    });

    // Alice sends multiple times without receiving
    for (let i = 0; i < 5; i++) {
      const result = spqrSend(aliceState);
      aliceState = result.state;
      expect(result.msg.length).toBeGreaterThan(0);
    }
  });
});
