/**
 * Tests for the unchunked send_ek / send_ct state machines.
 *
 * These tests simulate a full SPQR V1 epoch exchange between two peers:
 *   Alice (send_ek side) and Bob (send_ct side).
 *
 * Flow (true incremental ML-KEM):
 *   1. Alice: KeysUnsampled.sendHeader(rng) -> HeaderSent + (hdr, mac)
 *   2. Bob:   NoHeaderReceived.recvHeader(epoch, hdr, mac) -> HeaderReceived
 *   3. Bob:   HeaderReceived.sendCt1(rng) -> Ct1Sent + REAL ct1 + EpochSecret
 *   4. Alice: HeaderSent.sendEk() -> EkSent + ek
 *   5. Bob:   Ct1Sent.recvEk(ek) -> Ct1SentEkReceived (validates ek)
 *   6. Alice: EkSent.recvCt1(ct1) -> EkSentCt1Received  (uses REAL ct1 from step 3)
 *   7. Bob:   Ct1SentEkReceived.sendCt2() -> Ct2Sent + (ct2, mac)
 *   8. Alice: EkSentCt1Received.recvCt2(ct2, mac) -> RecvCt2Result + EpochSecret
 *
 * Both epoch secrets must match for key agreement.
 */

import { describe, it, expect } from "vitest";
import { randomBytes } from "@noble/hashes/utils.js";
import { Authenticator } from "../src/authenticator.js";
import {
  KeysUnsampled,
  HeaderSent,
  EkSent,
  EkSentCt1Received,
} from "../src/v1/unchunked/send-ek.js";
import {
  NoHeaderReceived,
  HeaderReceived,
  Ct1Sent,
  Ct1SentEkReceived,
  Ct2Sent,
} from "../src/v1/unchunked/send-ct.js";
import { EK_SIZE } from "../src/incremental-mlkem768.js";
import type { Epoch } from "../src/types.js";

function rng(n: number): Uint8Array {
  return randomBytes(n);
}

/** Create a fresh authenticator pair with the same root key for both sides. */
function createAuthPair(epoch: Epoch): [Authenticator, Authenticator] {
  const rootKey = randomBytes(32);
  return [Authenticator.create(rootKey, epoch), Authenticator.create(rootKey, epoch)];
}

describe("unchunked state machine", () => {
  describe("send_ek states", () => {
    it("KeysUnsampled should produce header and mac", () => {
      const [authA] = createAuthPair(0n);
      const state = new KeysUnsampled(0n, authA);

      const [headerSent, hdr, mac] = state.sendHeader(rng);

      expect(headerSent).toBeInstanceOf(HeaderSent);
      expect(hdr.length).toBe(64);
      expect(mac.length).toBe(32);
    });

    it("HeaderSent should produce ek (1152 bytes)", () => {
      const [authA] = createAuthPair(0n);
      const state = new KeysUnsampled(0n, authA);
      const [headerSent] = state.sendHeader(rng);

      const [ekSent, ek] = headerSent.sendEk();

      expect(ekSent).toBeInstanceOf(EkSent);
      expect(ek.length).toBe(EK_SIZE); // 1152
    });

    it("EkSent should accept ct1 and transition", () => {
      const [authA] = createAuthPair(0n);
      const state = new KeysUnsampled(0n, authA);
      const [headerSent] = state.sendHeader(rng);
      const [ekSent] = headerSent.sendEk();

      const ct1 = randomBytes(960);
      const ekSentCt1 = ekSent.recvCt1(ct1);

      expect(ekSentCt1).toBeInstanceOf(EkSentCt1Received);
      expect(ekSentCt1.ct1).toEqual(ct1);
    });
  });

  describe("send_ct states", () => {
    it("NoHeaderReceived should verify header mac", () => {
      const [authA, authB] = createAuthPair(0n);
      const alice = new KeysUnsampled(0n, authA);
      const bob = new NoHeaderReceived(0n, authB);

      const [, hdr, mac] = alice.sendHeader(rng);
      const headerReceived = bob.recvHeader(0n, hdr, mac);

      expect(headerReceived).toBeInstanceOf(HeaderReceived);
    });

    it("NoHeaderReceived should reject invalid header mac", () => {
      const [authA, authB] = createAuthPair(0n);
      const alice = new KeysUnsampled(0n, authA);
      const bob = new NoHeaderReceived(0n, authB);

      const [, hdr] = alice.sendHeader(rng);
      const badMac = randomBytes(32);

      expect(() => bob.recvHeader(0n, hdr, badMac)).toThrow();
    });

    it("HeaderReceived should produce REAL ct1 and epoch secret", () => {
      const [authA, authB] = createAuthPair(0n);
      const alice = new KeysUnsampled(0n, authA);
      const bob = new NoHeaderReceived(0n, authB);

      const [, hdr, mac] = alice.sendHeader(rng);
      const headerReceived = bob.recvHeader(0n, hdr, mac);

      const [ct1Sent, ct1, epochSecret] = headerReceived.sendCt1(rng);

      expect(ct1Sent).toBeInstanceOf(Ct1Sent);
      expect(ct1.length).toBe(960);
      // ct1 should be REAL (non-zero) in true incremental mode
      expect(ct1.some((b) => b !== 0)).toBe(true);
      // epoch secret should be real
      expect(epochSecret.secret.length).toBe(32);
      expect(epochSecret.secret.some((b) => b !== 0)).toBe(true);
    });

    it("Ct1Sent.recvEk should validate ek and return Ct1SentEkReceived", () => {
      const [authA, authB] = createAuthPair(0n);
      const alice = new KeysUnsampled(0n, authA);
      const bob = new NoHeaderReceived(0n, authB);

      const [headerSent, hdr, mac] = alice.sendHeader(rng);
      const headerReceived = bob.recvHeader(0n, hdr, mac);
      const [ct1Sent] = headerReceived.sendCt1(rng);
      const [, ek] = headerSent.sendEk();

      // recvEk now returns just the next state (not a tuple)
      const ct1SentEkReceived = ct1Sent.recvEk(ek);

      expect(ct1SentEkReceived).toBeInstanceOf(Ct1SentEkReceived);
    });
  });

  describe("full epoch exchange", () => {
    it("should complete a full exchange with matching epoch secrets", () => {
      const epoch = 0n;
      const [authA, authB] = createAuthPair(epoch);

      // Alice = send_ek side
      const aliceStart = new KeysUnsampled(epoch, authA);
      // Bob = send_ct side
      const bobStart = new NoHeaderReceived(epoch, authB);

      // Step 1: Alice generates keypair and sends header
      const [aliceHeaderSent, hdr, hdrMac] = aliceStart.sendHeader(rng);

      // Step 2: Bob receives header, verifies MAC
      const bobHeaderReceived = bobStart.recvHeader(epoch, hdr, hdrMac);

      // Step 3: Bob produces REAL ct1 and derives epoch secret
      const [bobCt1Sent, realCt1, bobEpochSecret] = bobHeaderReceived.sendCt1(rng);

      // Step 4: Alice sends encapsulation key
      const [aliceEkSent, ek] = aliceHeaderSent.sendEk();

      // Step 5: Bob receives ek, validates it
      const bobCt1SentEkRecv = bobCt1Sent.recvEk(ek);

      // Step 6: Alice receives REAL ct1 (from Bob's encaps1 result)
      const aliceEkSentCt1Recv = aliceEkSent.recvCt1(realCt1);

      // Step 7: Bob sends ct2 + MAC
      const { state: bobCt2Sent, ct2, mac: ctMac } = bobCt1SentEkRecv.sendCt2();

      // Step 8: Alice receives ct2, verifies MAC, derives epoch secret
      const aliceResult = aliceEkSentCt1Recv.recvCt2(ct2, ctMac);

      // Verify: both sides derived the same epoch secret
      expect(aliceResult.epochSecret.epoch).toBe(bobEpochSecret.epoch);
      expect(aliceResult.epochSecret.secret).toEqual(bobEpochSecret.secret);
      expect(aliceResult.nextEpoch).toBe(1n);

      // Verify terminal states
      expect(bobCt2Sent).toBeInstanceOf(Ct2Sent);
      expect(bobCt2Sent.nextEpoch).toBe(1n);
    });

    it("should reject ct2 with invalid MAC", () => {
      const epoch = 0n;
      const [authA, authB] = createAuthPair(epoch);

      const aliceStart = new KeysUnsampled(epoch, authA);
      const bobStart = new NoHeaderReceived(epoch, authB);

      const [aliceHeaderSent, hdr, hdrMac] = aliceStart.sendHeader(rng);
      const bobHeaderReceived = bobStart.recvHeader(epoch, hdr, hdrMac);
      const [bobCt1Sent, realCt1] = bobHeaderReceived.sendCt1(rng);
      const [aliceEkSent, ek] = aliceHeaderSent.sendEk();
      const bobCt1SentEkRecv = bobCt1Sent.recvEk(ek);
      const aliceEkSentCt1Recv = aliceEkSent.recvCt1(realCt1);
      const { ct2 } = bobCt1SentEkRecv.sendCt2();

      const badMac = randomBytes(32);
      expect(() => aliceEkSentCt1Recv.recvCt2(ct2, badMac)).toThrow();
    });

    it("should reject tampered ct2", () => {
      const epoch = 0n;
      const [authA, authB] = createAuthPair(epoch);

      const aliceStart = new KeysUnsampled(epoch, authA);
      const bobStart = new NoHeaderReceived(epoch, authB);

      const [aliceHeaderSent, hdr, hdrMac] = aliceStart.sendHeader(rng);
      const bobHeaderReceived = bobStart.recvHeader(epoch, hdr, hdrMac);
      const [bobCt1Sent, realCt1] = bobHeaderReceived.sendCt1(rng);
      const [aliceEkSent, ek] = aliceHeaderSent.sendEk();
      const bobCt1SentEkRecv = bobCt1Sent.recvEk(ek);
      const aliceEkSentCt1Recv = aliceEkSent.recvCt1(realCt1);
      const { ct2, mac } = bobCt1SentEkRecv.sendCt2();

      // Tamper with ct2
      const tamperedCt2 = new Uint8Array(ct2);
      tamperedCt2[0] ^= 0xff;

      expect(() => aliceEkSentCt1Recv.recvCt2(tamperedCt2, mac)).toThrow();
    });

    it("should work across multiple consecutive epochs", () => {
      let epoch = 0n;
      const rootKey = randomBytes(32);
      let authA = Authenticator.create(rootKey, epoch);
      let authB = Authenticator.create(rootKey, epoch);

      for (let i = 0; i < 3; i++) {
        const aliceStart = new KeysUnsampled(epoch, authA);
        const bobStart = new NoHeaderReceived(epoch, authB);

        const [aliceHeaderSent, hdr, hdrMac] = aliceStart.sendHeader(rng);
        const bobHeaderReceived = bobStart.recvHeader(epoch, hdr, hdrMac);
        const [bobCt1Sent, realCt1, bobEpochSecret] = bobHeaderReceived.sendCt1(rng);
        const [aliceEkSent, ek] = aliceHeaderSent.sendEk();
        const bobCt1SentEkRecv = bobCt1Sent.recvEk(ek);
        const aliceEkSentCt1Recv = aliceEkSent.recvCt1(realCt1);
        const { state: bobCt2Sent, ct2, mac: ctMac } = bobCt1SentEkRecv.sendCt2();
        const aliceResult = aliceEkSentCt1Recv.recvCt2(ct2, ctMac);

        // Verify epoch secrets match
        expect(aliceResult.epochSecret.epoch).toBe(bobEpochSecret.epoch);
        expect(aliceResult.epochSecret.secret).toEqual(bobEpochSecret.secret);

        // Advance to next epoch
        epoch = aliceResult.nextEpoch;
        authA = aliceResult.auth;
        authB = bobCt2Sent.auth;
      }

      expect(epoch).toBe(3n);
    });
  });

  describe("state properties", () => {
    it("KeysUnsampled should expose epoch and auth", () => {
      const [auth] = createAuthPair(5n);
      const state = new KeysUnsampled(5n, auth);

      expect(state.epoch).toBe(5n);
      expect(state.auth).toBe(auth);
    });

    it("Ct2Sent.nextEpoch should be epoch + 1", () => {
      const [auth] = createAuthPair(10n);
      const state = new Ct2Sent(10n, auth);

      expect(state.nextEpoch).toBe(11n);
    });

    it("Ct1Sent should expose ct1 (the real ct1)", () => {
      const epoch = 0n;
      const [authA, authB] = createAuthPair(epoch);

      const aliceStart = new KeysUnsampled(epoch, authA);
      const bobStart = new NoHeaderReceived(epoch, authB);

      const [aliceHeaderSent, hdr, hdrMac] = aliceStart.sendHeader(rng);
      const bobHeaderReceived = bobStart.recvHeader(epoch, hdr, hdrMac);
      const [bobCt1Sent, ct1] = bobHeaderReceived.sendCt1(rng);

      // Real ct1 should be 960 bytes and non-trivial
      expect(ct1.length).toBe(960);
      expect(ct1.some((b) => b !== 0)).toBe(true);
      // The Ct1Sent state should also store the ct1
      expect(bobCt1Sent.ct1.length).toBe(960);
    });
  });
});
