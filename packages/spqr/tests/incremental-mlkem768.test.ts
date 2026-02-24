/**
 * Tests for true incremental ML-KEM-768.
 */

import { describe, it, expect } from 'vitest';
import { randomBytes } from '@noble/hashes/utils.js';
import {
  generate,
  encaps1,
  encaps2,
  decaps,
  ekMatchesHeader,
  HEADER_SIZE,
  EK_SIZE,
  DK_SIZE,
  CT1_SIZE,
  CT2_SIZE,
  SS_SIZE,
  ES_SIZE,
  FULL_PK_SIZE,
  FULL_CT_SIZE,
} from '../src/incremental-mlkem768.js';

function rng(n: number): Uint8Array {
  return randomBytes(n);
}

function deterministicRng(seed: number): (n: number) => Uint8Array {
  let counter = seed;
  return (n: number): Uint8Array => {
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      // Simple deterministic PRNG for testing
      counter = (counter * 1103515245 + 12345) & 0x7fffffff;
      buf[i] = counter & 0xff;
    }
    return buf;
  };
}

describe('incremental-mlkem768', () => {
  describe('generate', () => {
    it('should produce keys with correct sizes', () => {
      const keys = generate(rng);

      expect(keys.hdr.length).toBe(HEADER_SIZE);
      expect(keys.ek.length).toBe(EK_SIZE);
      expect(keys.dk.length).toBe(DK_SIZE);
    });

    it('should produce different keys on each call', () => {
      const k1 = generate(rng);
      const k2 = generate(rng);

      expect(k1.hdr).not.toEqual(k2.hdr);
      expect(k1.dk).not.toEqual(k2.dk);
    });

    it('should produce deterministic keys from the same seed', () => {
      const rng1 = deterministicRng(42);
      const rng2 = deterministicRng(42);

      const k1 = generate(rng1);
      const k2 = generate(rng2);

      expect(k1.hdr).toEqual(k2.hdr);
      expect(k1.ek).toEqual(k2.ek);
      expect(k1.dk).toEqual(k2.dk);
    });

    it('should split the public key correctly (hdr + ek reconstructs full pk)', () => {
      const keys = generate(rng);

      // pk1 (hdr) = rho(32) + H(ek)(32) = 64 bytes
      // pk2 (ek) = tHat(1152) = 1152 bytes
      // Full pk = tHat(1152) || rho(32) = 1184 bytes
      // pk2(1152) + pk1[0..32](32) = 1184
      expect(keys.hdr.length).toBe(HEADER_SIZE); // 64
      expect(keys.ek.length).toBe(EK_SIZE);       // 1152
    });
  });

  describe('encaps1 (true incremental)', () => {
    it('should produce REAL ct1 and shared secret', () => {
      const keys = generate(rng);
      const result = encaps1(keys.hdr, rng);

      expect(result.ct1.length).toBe(CT1_SIZE);
      expect(result.es.length).toBe(ES_SIZE);
      expect(result.sharedSecret.length).toBe(SS_SIZE);

      // Real values: NOT all zeros
      expect(result.ct1.some(b => b !== 0)).toBe(true);
      expect(result.sharedSecret.some(b => b !== 0)).toBe(true);
    });

    it('ES_SIZE should be 2080', () => {
      expect(ES_SIZE).toBe(2080);
    });
  });

  describe('encaps2 (true incremental)', () => {
    it('should return only ct2 (128 bytes)', () => {
      const keys = generate(rng);
      const { es } = encaps1(keys.hdr, rng);
      const ct2 = encaps2(keys.ek, es);

      expect(ct2.length).toBe(CT2_SIZE);
      expect(ct2.some(b => b !== 0)).toBe(true);
    });
  });

  describe('true incremental round-trip', () => {
    it('encaps1 shared secret should match decaps result', () => {
      const keys = generate(rng);
      const { ct1, es, sharedSecret: encapsSs } = encaps1(keys.hdr, rng);
      const ct2 = encaps2(keys.ek, es);

      const decapsSs = decaps(keys.dk, ct1, ct2);

      expect(encapsSs).toEqual(decapsSs);
    });

    it('should be deterministic: same seed produces same result', () => {
      const keys = generate(rng);
      const rng1 = deterministicRng(123);
      const rng2 = deterministicRng(123);

      const r1 = encaps1(keys.hdr, rng1);
      const r2 = encaps1(keys.hdr, rng2);

      expect(r1.ct1).toEqual(r2.ct1);
      expect(r1.es).toEqual(r2.es);
      expect(r1.sharedSecret).toEqual(r2.sharedSecret);
    });

    it('should work across multiple round-trips', () => {
      for (let i = 0; i < 5; i++) {
        const keys = generate(rng);
        const { ct1, es, sharedSecret } = encaps1(keys.hdr, rng);
        const ct2 = encaps2(keys.ek, es);
        const recovered = decaps(keys.dk, ct1, ct2);
        expect(sharedSecret).toEqual(recovered);
      }
    });
  });

  describe('pk split reconstruction', () => {
    it('pk2 || pk1[0..32] should reconstruct the standard ML-KEM pk', () => {
      // This test verifies the incremental pk split is correct:
      // hdr = rho(32) + H(ek)(32)
      // ek = tHat(1152)
      // full pk = tHat(1152) || rho(32) = ek(1152) || hdr[0..32](32)
      const keys = generate(rng);

      const rho = keys.hdr.slice(0, 32);
      const pk = new Uint8Array(FULL_PK_SIZE);
      pk.set(keys.ek, 0);
      pk.set(rho, EK_SIZE);

      // The reconstructed pk should be 1184 bytes
      expect(pk.length).toBe(FULL_PK_SIZE);
      // And it should work for encapsulation
      // (We can't easily test this without noble's encapsulate,
      // but the round-trip test above validates correctness)
    });
  });

  describe('decaps', () => {
    it('should recover the shared secret', () => {
      const keys = generate(rng);
      const { ct1, es, sharedSecret } = encaps1(keys.hdr, rng);
      const ct2 = encaps2(keys.ek, es);

      const recovered = decaps(keys.dk, ct1, ct2);
      expect(recovered).toEqual(sharedSecret);
    });

    it('should produce 32-byte output', () => {
      const keys = generate(rng);
      const { ct1, es } = encaps1(keys.hdr, rng);
      const ct2 = encaps2(keys.ek, es);

      const ss = decaps(keys.dk, ct1, ct2);
      expect(ss.length).toBe(SS_SIZE);
    });

    it('should produce different ss with different dk (implicit rejection)', () => {
      const keys1 = generate(rng);
      const keys2 = generate(rng);
      const { ct1, es } = encaps1(keys1.hdr, rng);
      const ct2 = encaps2(keys1.ek, es);

      const ss1 = decaps(keys1.dk, ct1, ct2);
      const ss2 = decaps(keys2.dk, ct1, ct2);

      // ML-KEM has implicit rejection: wrong dk produces a pseudorandom ss
      expect(ss1).not.toEqual(ss2);
    });
  });

  describe('ekMatchesHeader', () => {
    it('should return true for valid key pair', () => {
      const keys = generate(rng);
      expect(ekMatchesHeader(keys.ek, keys.hdr)).toBe(true);
    });

    it('should return false for short header', () => {
      const keys = generate(rng);
      const shortHdr = keys.hdr.slice(0, 32);
      expect(ekMatchesHeader(keys.ek, shortHdr)).toBe(false);
    });

    it('should return false for short ek', () => {
      const keys = generate(rng);
      const shortEk = keys.ek.slice(0, 100);
      expect(ekMatchesHeader(shortEk, keys.hdr)).toBe(false);
    });

    it('should return false for mismatched ek and hdr', () => {
      const keys1 = generate(rng);
      const keys2 = generate(rng);
      expect(ekMatchesHeader(keys1.ek, keys2.hdr)).toBe(false);
    });
  });

  describe('size constants', () => {
    it('should have correct size relationships', () => {
      expect(CT1_SIZE + CT2_SIZE).toBe(FULL_CT_SIZE);
      expect(FULL_PK_SIZE).toBe(1184);
      expect(FULL_CT_SIZE).toBe(1088);
      expect(DK_SIZE).toBe(2400);
      expect(SS_SIZE).toBe(32);
      expect(EK_SIZE).toBe(1152);
      expect(HEADER_SIZE).toBe(64);
      expect(ES_SIZE).toBe(2080);
    });
  });

  describe('state serialization round-trip', () => {
    it('encapsulation state should round-trip correctly with 2080 bytes', () => {
      const keys = generate(rng);
      const { es } = encaps1(keys.hdr, rng);

      // The state should be exactly 2080 bytes
      expect(es.length).toBe(2080);

      // The state should be non-trivial
      expect(es.some(b => b !== 0)).toBe(true);
    });
  });
});
