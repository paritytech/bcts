/**
 * Tests for the chunked state machine (V1).
 *
 * These tests validate:
 *   a. Message serialization round-trip
 *   b. Full epoch exchange (lockstep)
 *   c. Erasure recovery (with dropped messages)
 *   d. Multi-epoch exchange
 *   e. Out-of-order delivery
 *   f. State transitions
 */

import { describe, it, expect } from "vitest";
import {
  type States,
  type Message,
  type SendResult,
  type RecvResult,
  initA,
  initB,
  send,
  recv,
  serializeMessage,
  deserializeMessage,
} from "../src/v1/chunked/index.js";
import type { Chunk } from "../src/encoding/polynomial.js";
import type { EpochSecret } from "../src/types.js";
import { encodeVarint, decodeVarint } from "../src/v1/chunked/message.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rng = (n: number): Uint8Array => {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
};

function defined<T>(value: T | undefined | null): T {
  if (value == null) throw new Error("Expected value to be defined");
  return value;
}

const AUTH_KEY = new Uint8Array(32).fill(41);

/**
 * Run a lockstep exchange between Alice (send_ek) and Bob (send_ct)
 * until both produce an epoch secret, or the iteration limit is reached.
 *
 * Returns the two epoch secrets and the final states.
 */
function runLockstepExchange(
  alice: States,
  bob: States,
  maxRounds = 500,
): {
  aliceSecret: EpochSecret | null;
  bobSecret: EpochSecret | null;
  alice: States;
  bob: States;
  rounds: number;
} {
  let aliceSecret: EpochSecret | null = null;
  let bobSecret: EpochSecret | null = null;
  let round = 0;

  for (; round < maxRounds; round++) {
    // Alice sends
    const aliceSend: SendResult = send(alice, rng);
    alice = aliceSend.state;
    if (aliceSend.key !== null && aliceSecret === null) {
      aliceSecret = aliceSend.key;
    }

    // Bob receives Alice's message
    const bobRecv: RecvResult = recv(bob, aliceSend.msg);
    bob = bobRecv.state;
    if (bobRecv.key !== null && bobSecret === null) {
      bobSecret = bobRecv.key;
    }

    // Bob sends
    const bobSend: SendResult = send(bob, rng);
    bob = bobSend.state;
    if (bobSend.key !== null && bobSecret === null) {
      bobSecret = bobSend.key;
    }

    // Alice receives Bob's message
    const aliceRecv: RecvResult = recv(alice, bobSend.msg);
    alice = aliceRecv.state;
    if (aliceRecv.key !== null && aliceSecret === null) {
      aliceSecret = aliceRecv.key;
    }

    // Check if both secrets have been derived
    if (aliceSecret !== null && bobSecret !== null) {
      round++;
      break;
    }
  }

  return { aliceSecret, bobSecret, alice, bob, rounds: round };
}

// ---------------------------------------------------------------------------
// a. Message serialization round-trip
// ---------------------------------------------------------------------------

describe("message serialization", () => {
  it("should round-trip a None message", () => {
    const msg: Message = { epoch: 42n, payload: { type: "none" } };
    const bytes = serializeMessage(msg, 7);
    const { msg: decoded, index, bytesRead } = deserializeMessage(bytes);

    expect(decoded.epoch).toBe(42n);
    expect(decoded.payload.type).toBe("none");
    expect(index).toBe(7);
    expect(bytesRead).toBe(bytes.length);
  });

  it("should round-trip a Hdr message", () => {
    const chunk: Chunk = { index: 3, data: new Uint8Array(32).fill(0xab) };
    const msg: Message = { epoch: 1n, payload: { type: "hdr", chunk } };
    const bytes = serializeMessage(msg, 0);
    const { msg: decoded, index } = deserializeMessage(bytes);

    expect(decoded.epoch).toBe(1n);
    expect(decoded.payload.type).toBe("hdr");
    if (decoded.payload.type === "hdr") {
      expect(decoded.payload.chunk.index).toBe(3);
      expect(decoded.payload.chunk.data).toEqual(chunk.data);
    }
    expect(index).toBe(0);
  });

  it("should round-trip an Ek message", () => {
    const chunk: Chunk = { index: 100, data: new Uint8Array(32).fill(0xcd) };
    const msg: Message = { epoch: 5n, payload: { type: "ek", chunk } };
    const bytes = serializeMessage(msg, 42);
    const { msg: decoded, index } = deserializeMessage(bytes);

    expect(decoded.epoch).toBe(5n);
    expect(decoded.payload.type).toBe("ek");
    if (decoded.payload.type === "ek") {
      expect(decoded.payload.chunk.index).toBe(100);
      expect(decoded.payload.chunk.data).toEqual(chunk.data);
    }
    expect(index).toBe(42);
  });

  it("should round-trip an EkCt1Ack message", () => {
    const chunk: Chunk = { index: 0, data: new Uint8Array(32).fill(0xff) };
    const msg: Message = {
      epoch: 3n,
      payload: { type: "ekCt1Ack", chunk },
    };
    const bytes = serializeMessage(msg, 1);
    const { msg: decoded } = deserializeMessage(bytes);

    expect(decoded.payload.type).toBe("ekCt1Ack");
    if (decoded.payload.type === "ekCt1Ack") {
      expect(decoded.payload.chunk.index).toBe(0);
    }
  });

  it("should round-trip a Ct1Ack message", () => {
    const msg: Message = {
      epoch: 10n,
      payload: { type: "ct1Ack" },
    };
    const bytes = serializeMessage(msg, 5);
    const { msg: decoded } = deserializeMessage(bytes);

    expect(decoded.payload.type).toBe("ct1Ack");
    expect(decoded.epoch).toBe(10n);
  });

  it("should serialize Ct1Ack with no value byte (Rust wire compat)", () => {
    const msg: Message = {
      epoch: 1n,
      payload: { type: "ct1Ack" },
    };
    const bytes = serializeMessage(msg, 0);
    // Wire format: [0x01 version][0x01 epoch=1][0x00 index=0][0x04 Ct1Ack]
    // No value byte after 0x04
    expect(bytes.length).toBe(4);
    expect(bytes[0]).toBe(0x01); // V1
    expect(bytes[3]).toBe(0x04); // MessageType.Ct1Ack
  });

  it("should deserialize Ct1Ack from Rust wire format (no trailing byte)", () => {
    // Rust produces: [version=0x01][epoch varint][index varint][type=0x04]
    // epoch=1 (varint 0x01), index=0 (varint 0x00)
    const rustBytes = new Uint8Array([0x01, 0x01, 0x00, 0x04]);
    const { msg: decoded, index } = deserializeMessage(rustBytes);

    expect(decoded.epoch).toBe(1n);
    expect(index).toBe(0);
    expect(decoded.payload.type).toBe("ct1Ack");
  });

  it("should reject epoch=0 messages (matches Rust)", () => {
    // Rust rejects epoch=0 in Message::deserialize (serialize.rs:255-257)
    const epoch0Bytes = new Uint8Array([0x01, 0x00, 0x00, 0x00]); // version=1, epoch=0, index=0, type=None
    expect(() => deserializeMessage(epoch0Bytes)).toThrow("epoch must be > 0");
  });

  it("should round-trip Ct1 and Ct2 messages", () => {
    for (const type of ["ct1", "ct2"] as const) {
      const chunk: Chunk = {
        index: 12345,
        data: new Uint8Array(32).fill(type === "ct1" ? 0x11 : 0x22),
      };
      const msg: Message = { epoch: 7n, payload: { type, chunk } };
      const bytes = serializeMessage(msg, 99);
      const { msg: decoded, index } = deserializeMessage(bytes);

      expect(decoded.epoch).toBe(7n);
      expect(decoded.payload.type).toBe(type);
      expect(index).toBe(99);
    }
  });
});

describe("varint encoding", () => {
  it("should encode and decode zero", () => {
    const out: number[] = [];
    encodeVarint(0n, out);
    const decoded = decodeVarint(new Uint8Array(out), { offset: 0 });
    expect(decoded).toBe(0n);
  });

  it("should encode and decode 127 (single byte max)", () => {
    const out: number[] = [];
    encodeVarint(127n, out);
    expect(out.length).toBe(1);
    const decoded = decodeVarint(new Uint8Array(out), { offset: 0 });
    expect(decoded).toBe(127n);
  });

  it("should encode and decode 128 (two bytes)", () => {
    const out: number[] = [];
    encodeVarint(128n, out);
    expect(out.length).toBe(2);
    const decoded = decodeVarint(new Uint8Array(out), { offset: 0 });
    expect(decoded).toBe(128n);
  });

  it("should encode and decode 300", () => {
    const out: number[] = [];
    encodeVarint(300n, out);
    const decoded = decodeVarint(new Uint8Array(out), { offset: 0 });
    expect(decoded).toBe(300n);
  });

  it("should encode and decode 65535", () => {
    const out: number[] = [];
    encodeVarint(65535n, out);
    const decoded = decodeVarint(new Uint8Array(out), { offset: 0 });
    expect(decoded).toBe(65535n);
  });

  it("should encode and decode 2^32", () => {
    const val = 1n << 32n;
    const out: number[] = [];
    encodeVarint(val, out);
    const decoded = decodeVarint(new Uint8Array(out), { offset: 0 });
    expect(decoded).toBe(val);
  });

  it("should encode and decode 2^63", () => {
    const val = 1n << 63n;
    const out: number[] = [];
    encodeVarint(val, out);
    const decoded = decodeVarint(new Uint8Array(out), { offset: 0 });
    expect(decoded).toBe(val);
  });
});

// ---------------------------------------------------------------------------
// b. Full epoch exchange (lockstep)
// ---------------------------------------------------------------------------

describe("full epoch exchange (lockstep)", () => {
  it("should complete one epoch with matching secrets", () => {
    const alice = initA(AUTH_KEY);
    const bob = initB(AUTH_KEY);

    const result = runLockstepExchange(alice, bob);

    expect(result.aliceSecret).not.toBeNull();
    expect(result.bobSecret).not.toBeNull();

    // Both sides should derive the same epoch secret
    expect(defined(result.aliceSecret).epoch).toBe(defined(result.bobSecret).epoch);
    expect(defined(result.aliceSecret).secret).toEqual(defined(result.bobSecret).secret);

    // Secret should be non-trivial
    expect(defined(result.aliceSecret).secret.length).toBe(32);
    expect(defined(result.aliceSecret).secret.some((b: number) => b !== 0)).toBe(true);
  }, 30_000);

  it("should start at epoch 1 and produce secret at epoch 1", () => {
    const alice = initA(AUTH_KEY);
    const bob = initB(AUTH_KEY);

    const result = runLockstepExchange(alice, bob);

    expect(result.aliceSecret).not.toBeNull();
    // True incremental: epoch secret carries the current state epoch (1n)
    expect(defined(result.aliceSecret).epoch).toBe(1n);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// c. Erasure recovery (dropped messages)
// ---------------------------------------------------------------------------

describe("erasure recovery", () => {
  it("should complete exchange even with 30% message drops", () => {
    let alice = initA(AUTH_KEY);
    let bob = initB(AUTH_KEY);

    let aliceSecret: EpochSecret | null = null;
    let bobSecret: EpochSecret | null = null;

    let dropCount = 0;
    let totalMessages = 0;

    // Use a seeded counter for deterministic "random" drops
    let counter = 0;
    const shouldDrop = () => {
      counter++;
      // Drop roughly 30% of messages using a simple pattern
      return counter % 10 < 3;
    };

    for (let round = 0; round < 1500; round++) {
      // Alice sends
      const aliceSend = send(alice, rng);
      alice = aliceSend.state;
      if (aliceSend.key !== null && aliceSecret === null) {
        aliceSecret = aliceSend.key;
      }

      totalMessages++;
      // Maybe drop Alice's message to Bob
      if (!shouldDrop()) {
        const bobRecv = recv(bob, aliceSend.msg);
        bob = bobRecv.state;
        if (bobRecv.key !== null && bobSecret === null) {
          bobSecret = bobRecv.key;
        }
      } else {
        dropCount++;
      }

      // Bob sends
      const bobSend = send(bob, rng);
      bob = bobSend.state;
      if (bobSend.key !== null && bobSecret === null) {
        bobSecret = bobSend.key;
      }

      totalMessages++;
      // Maybe drop Bob's message to Alice
      if (!shouldDrop()) {
        const aliceRecv = recv(alice, bobSend.msg);
        alice = aliceRecv.state;
        if (aliceRecv.key !== null && aliceSecret === null) {
          aliceSecret = aliceRecv.key;
        }
      } else {
        dropCount++;
      }

      if (aliceSecret !== null && bobSecret !== null) break;
    }

    expect(aliceSecret).not.toBeNull();
    expect(bobSecret).not.toBeNull();
    expect(defined(aliceSecret).secret).toEqual(defined(bobSecret).secret);
    expect(dropCount).toBeGreaterThan(0);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// d. Multi-epoch exchange
// ---------------------------------------------------------------------------

describe("multi-epoch exchange", () => {
  it("should complete 3 consecutive epochs", () => {
    let alice = initA(AUTH_KEY);
    let bob = initB(AUTH_KEY);

    const secrets: Array<{ alice: EpochSecret; bob: EpochSecret }> = [];

    for (let epochIdx = 0; epochIdx < 3; epochIdx++) {
      const result = runLockstepExchange(alice, bob, 500);

      expect(result.aliceSecret).not.toBeNull();
      expect(result.bobSecret).not.toBeNull();
      expect(defined(result.aliceSecret).secret).toEqual(defined(result.bobSecret).secret);

      secrets.push({
        alice: defined(result.aliceSecret),
        bob: defined(result.bobSecret),
      });

      alice = result.alice;
      bob = result.bob;
    }

    // Verify each epoch produced a different secret
    expect(secrets.length).toBe(3);
    for (let i = 1; i < secrets.length; i++) {
      expect(defined(secrets[i]).alice.epoch).toBeGreaterThan(defined(secrets[i - 1]).alice.epoch);
      // Secrets should be different across epochs
      expect(defined(secrets[i]).alice.secret).not.toEqual(defined(secrets[i - 1]).alice.secret);
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------
// e. Out-of-order delivery
// ---------------------------------------------------------------------------

describe("out-of-order delivery", () => {
  it("should handle reordered messages within a batch", () => {
    let alice = initA(AUTH_KEY);
    let bob = initB(AUTH_KEY);

    let aliceSecret: EpochSecret | null = null;
    let bobSecret: EpochSecret | null = null;

    // Collect batches of messages and deliver them shuffled
    const BATCH_SIZE = 4;

    for (let round = 0; round < 2000; round++) {
      // Collect a batch from Alice
      const aliceMsgs: Message[] = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const aliceSend = send(alice, rng);
        alice = aliceSend.state;
        if (aliceSend.key !== null && aliceSecret === null) {
          aliceSecret = aliceSend.key;
        }
        aliceMsgs.push(aliceSend.msg);
      }

      // Deliver to Bob in reverse order
      for (let i = aliceMsgs.length - 1; i >= 0; i--) {
        const bobRecv = recv(bob, defined(aliceMsgs[i]));
        bob = bobRecv.state;
        if (bobRecv.key !== null && bobSecret === null) {
          bobSecret = bobRecv.key;
        }
      }

      // Collect a batch from Bob
      const bobMsgs: Message[] = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const bobSend = send(bob, rng);
        bob = bobSend.state;
        if (bobSend.key !== null && bobSecret === null) {
          bobSecret = bobSend.key;
        }
        bobMsgs.push(bobSend.msg);
      }

      // Deliver to Alice in reverse order
      for (let i = bobMsgs.length - 1; i >= 0; i--) {
        const aliceRecv = recv(alice, defined(bobMsgs[i]));
        alice = aliceRecv.state;
        if (aliceRecv.key !== null && aliceSecret === null) {
          aliceSecret = aliceRecv.key;
        }
      }

      if (aliceSecret !== null && bobSecret !== null) break;
    }

    expect(aliceSecret).not.toBeNull();
    expect(bobSecret).not.toBeNull();
    expect(defined(aliceSecret).secret).toEqual(defined(bobSecret).secret);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// f. State transitions
// ---------------------------------------------------------------------------

describe("state transitions", () => {
  it("should start Alice as keysUnsampled", () => {
    const alice = initA(AUTH_KEY);
    expect(alice.tag).toBe("keysUnsampled");
  });

  it("should start Bob as noHeaderReceived", () => {
    const bob = initB(AUTH_KEY);
    expect(bob.tag).toBe("noHeaderReceived");
  });

  it("Alice should transition keysUnsampled -> keysSampled on first send", () => {
    let alice = initA(AUTH_KEY);
    const result = send(alice, rng);
    alice = result.state;

    expect(alice.tag).toBe("keysSampled");
    expect(result.msg.payload.type).toBe("hdr");
  });

  it("Bob should transition noHeaderReceived on receiving hdr chunks", () => {
    let alice = initA(AUTH_KEY);
    let bob = initB(AUTH_KEY);

    // Send many header chunks from Alice to Bob until Bob transitions
    for (let i = 0; i < 50; i++) {
      const aliceSend = send(alice, rng);
      alice = aliceSend.state;

      const bobRecv = recv(bob, aliceSend.msg);
      bob = bobRecv.state;

      if (bob.tag !== "noHeaderReceived") {
        expect(bob.tag).toBe("headerReceived");
        return;
      }
    }

    // Should have transitioned within 50 rounds (3 chunks for 96 bytes minimum)
    expect(bob.tag).toBe("headerReceived");
  });

  it("send_ek states should produce correct message types", () => {
    let alice = initA(AUTH_KEY);

    // First send: keysUnsampled -> keysSampled with hdr chunk
    const r1 = send(alice, rng);
    expect(r1.msg.payload.type).toBe("hdr");
    expect(r1.state.tag).toBe("keysSampled");
    alice = r1.state;

    // Subsequent sends from keysSampled produce hdr chunks
    const r2 = send(alice, rng);
    expect(r2.msg.payload.type).toBe("hdr");
    expect(r2.state.tag).toBe("keysSampled");
  });

  it("send_ct states should produce correct message types", () => {
    const bob = initB(AUTH_KEY);

    // noHeaderReceived sends None (nothing to send yet)
    const r1 = send(bob, rng);
    expect(r1.msg.payload.type).toBe("none");
    expect(r1.state.tag).toBe("noHeaderReceived");
  });
});
