/**
 * S4: Session usability and staleness tests.
 *
 * Tests hasUsableTripleRatchetSession() with various requirement flags:
 *   - TripleRatchetSessionUsability.None
 *   - TripleRatchetSessionUsability.NotStale
 *   - TripleRatchetSessionUsability.EstablishedWithPqxdh
 *   - TripleRatchetSessionUsability.Spqr
 *
 * Reference: libsignal/rust/protocol/src/session.rs (SessionUsability)
 */

import { describe, it, expect } from "vitest";
import { IdentityKeyPair, KeyPair, SessionState, RootKey, ChainKey } from "@bcts/double-ratchet";
import * as spqr from "@bcts/spqr";

import {
  TripleRatchetSessionState,
  TripleRatchetSessionUsability,
  hasUsableTripleRatchetSession,
} from "../src/session-state.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function createTripleState(options: {
  version?: number;
  hasSenderChain?: boolean;
  pendingPreKeyTimestamp?: number;
  pqRatchetEmpty?: boolean;
}): TripleRatchetSessionState {
  const rng = new TestRng(1);
  const localIdentity = IdentityKeyPair.generate(rng);
  const remoteIdentity = IdentityKeyPair.generate(rng);
  const version = options.version ?? 4;

  const rootKey = new RootKey(new Uint8Array(32).fill(0x01));
  const chainKey = new ChainKey(new Uint8Array(32).fill(0x02), 0);

  let inner = new SessionState({
    sessionVersion: version,
    localIdentityKey: localIdentity.identityKey,
    remoteIdentityKey: remoteIdentity.identityKey,
    rootKey,
  });

  if (options.hasSenderChain !== false) {
    const senderKey = KeyPair.generate(rng);
    inner = inner.withSenderChain(senderKey, chainKey);
  }

  if (options.pendingPreKeyTimestamp !== undefined) {
    const baseKey = KeyPair.generate(rng);
    inner.setPendingPreKey({
      preKeyId: 1,
      signedPreKeyId: 1,
      baseKey: baseKey.publicKey,
      timestamp: options.pendingPreKeyTimestamp,
    });
  }

  const pqState = options.pqRatchetEmpty
    ? new Uint8Array(0)
    : spqr.initialState({
        authKey: new Uint8Array(32).fill(0xaa),
        version: spqr.Version.V1,
        direction: spqr.Direction.A2B,
        minVersion: spqr.Version.V0,
        chainParams: { maxJump: 25000, maxOooKeys: 2000 },
      });

  return new TripleRatchetSessionState(inner, pqState);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("hasUsableTripleRatchetSession", () => {
  describe("TripleRatchetSessionUsability.None", () => {
    it("should be usable with a sender chain", () => {
      const state = createTripleState({});
      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.None),
      ).toBe(true);
    });

    it("should NOT be usable without a sender chain", () => {
      const state = createTripleState({ hasSenderChain: false });
      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.None),
      ).toBe(false);
    });
  });

  describe("TripleRatchetSessionUsability.NotStale", () => {
    it("should be usable with no pending prekey", () => {
      const state = createTripleState({});
      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.NotStale),
      ).toBe(true);
    });

    it("should be usable with a fresh pending prekey (1 day old)", () => {
      const nowSecs = Math.floor(Date.now() / 1000);
      const oneDayAgo = nowSecs - 86400;
      const state = createTripleState({ pendingPreKeyTimestamp: oneDayAgo });

      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.NotStale),
      ).toBe(true);
    });

    it("should be usable at exactly 29 days", () => {
      const nowSecs = Math.floor(Date.now() / 1000);
      const twentyNineDays = nowSecs - 29 * 86400;
      const state = createTripleState({ pendingPreKeyTimestamp: twentyNineDays });

      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.NotStale),
      ).toBe(true);
    });

    it("should NOT be usable at 31 days (stale)", () => {
      const nowSecs = Math.floor(Date.now() / 1000);
      const thirtyOneDays = nowSecs - 31 * 86400;
      const state = createTripleState({ pendingPreKeyTimestamp: thirtyOneDays });

      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.NotStale),
      ).toBe(false);
    });
  });

  describe("TripleRatchetSessionUsability.EstablishedWithPqxdh", () => {
    it("should be usable with v4 session", () => {
      const state = createTripleState({ version: 4 });
      expect(
        hasUsableTripleRatchetSession(
          state,
          Date.now(),
          TripleRatchetSessionUsability.EstablishedWithPqxdh,
        ),
      ).toBe(true);
    });

    it("should NOT be usable with v3 session", () => {
      const state = createTripleState({ version: 3 });
      expect(
        hasUsableTripleRatchetSession(
          state,
          Date.now(),
          TripleRatchetSessionUsability.EstablishedWithPqxdh,
        ),
      ).toBe(false);
    });
  });

  describe("TripleRatchetSessionUsability.Spqr", () => {
    it("should be usable with non-empty SPQR state", () => {
      const state = createTripleState({ pqRatchetEmpty: false });
      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.Spqr),
      ).toBe(true);
    });

    it("should NOT be usable with empty SPQR state", () => {
      const state = createTripleState({ pqRatchetEmpty: true });
      expect(
        hasUsableTripleRatchetSession(state, Date.now(), TripleRatchetSessionUsability.Spqr),
      ).toBe(false);
    });
  });

  describe("combined requirements", () => {
    it("should satisfy all flags when all conditions are met", () => {
      const state = createTripleState({ version: 4, pqRatchetEmpty: false });
      const all =
        TripleRatchetSessionUsability.NotStale |
        TripleRatchetSessionUsability.EstablishedWithPqxdh |
        TripleRatchetSessionUsability.Spqr;

      expect(hasUsableTripleRatchetSession(state, Date.now(), all)).toBe(true);
    });

    it("should fail if any flag is not met", () => {
      // v3 session fails EstablishedWithPqxdh even if SPQR and NotStale are OK
      const state = createTripleState({ version: 3, pqRatchetEmpty: false });
      const all =
        TripleRatchetSessionUsability.NotStale |
        TripleRatchetSessionUsability.EstablishedWithPqxdh |
        TripleRatchetSessionUsability.Spqr;

      expect(hasUsableTripleRatchetSession(state, Date.now(), all)).toBe(false);
    });
  });
});

describe("TripleRatchetSessionUsability constants", () => {
  it("None should be 0", () => {
    expect(TripleRatchetSessionUsability.None).toBe(0);
  });

  it("NotStale should be bit 0", () => {
    expect(TripleRatchetSessionUsability.NotStale).toBe(1);
  });

  it("EstablishedWithPqxdh should be bit 1", () => {
    expect(TripleRatchetSessionUsability.EstablishedWithPqxdh).toBe(2);
  });

  it("Spqr should be bit 2", () => {
    expect(TripleRatchetSessionUsability.Spqr).toBe(4);
  });
});
