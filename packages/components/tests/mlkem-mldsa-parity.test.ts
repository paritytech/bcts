/**
 * Structural parity tests for ML-KEM and ML-DSA.
 *
 * `@noble/post-quantum` and Rust's `pqcrypto-mlkem`/`pqcrypto-mldsa` both
 * implement NIST FIPS-203 / FIPS-204. As long as both libraries follow the
 * spec, key/ciphertext/signature encodings agree byte-for-byte. These tests
 * pin the CBOR-layout invariants the components port relies on:
 *
 *   • All ML-KEM/ML-DSA types serialize as `[level, raw-bytes]` arrays
 *     (untagged inside the CBOR tag wrapper).
 *   • Private/public/ciphertext/signature byte sizes match Rust constants.
 *   • Tagged CBOR uses tags 40100/40101/40102 (MLKEM)
 *     and 40103/40104/40105 (MLDSA).
 */

import { describe, it, expect } from "vitest";
import { MLKEMPrivateKey, MLKEMLevel, MLDSAPrivateKey, MLDSALevel } from "../src/index.js";

// CBOR major-6 (tag) encoding helper for the 40100-range tags:
//   tags 40100-40105 are 5-digit decimal numbers, encoded as 0xd9 (major-6
//   + 2-byte tag length) + 2-byte BE tag value.
function expectTaggedAt(bytes: Uint8Array, tag: number) {
  expect(bytes[0]).toBe(0xd9);
  expect(bytes[1]).toBe((tag >> 8) & 0xff);
  expect(bytes[2]).toBe(tag & 0xff);
}

describe("ML-KEM CBOR layout (matches Rust pqcrypto-mlkem)", () => {
  for (const level of [MLKEMLevel.MLKEM512, MLKEMLevel.MLKEM768, MLKEMLevel.MLKEM1024]) {
    it(`${String(level)} key generation produces correctly-sized keys`, () => {
      const priv = MLKEMPrivateKey.new(level);
      const pub = priv.publicKey();

      // Sizes match NIST FIPS-203 (and Rust pqcrypto-mlkem).
      const expectedPriv =
        level === MLKEMLevel.MLKEM512 ? 1632 : level === MLKEMLevel.MLKEM768 ? 2400 : 3168;
      const expectedPub =
        level === MLKEMLevel.MLKEM512 ? 800 : level === MLKEMLevel.MLKEM768 ? 1184 : 1568;

      expect(priv.data().length).toBe(expectedPriv);
      expect(pub.data().length).toBe(expectedPub);
    });

    it(`${String(level)} private key tagged CBOR begins with tag 40100`, () => {
      const priv = MLKEMPrivateKey.new(level);
      expectTaggedAt(priv.taggedCborData(), 40100);
    });

    it(`${String(level)} public key tagged CBOR begins with tag 40101`, () => {
      const priv = MLKEMPrivateKey.new(level);
      expectTaggedAt(priv.publicKey().taggedCborData(), 40101);
    });

    it(`${String(level)} encapsulation: ciphertext tagged with 40102`, () => {
      const priv = MLKEMPrivateKey.new(level);
      const { sharedSecret, ciphertext } = priv.publicKey().encapsulate();
      expect(sharedSecret.data().length).toBe(32);
      expectTaggedAt(ciphertext.taggedCborData(), 40102);

      // Round-trip
      const recovered = priv.decapsulate(ciphertext);
      expect(recovered.equals(sharedSecret)).toBe(true);
    });

    it(`${String(level)} private key roundtrips through tagged CBOR`, () => {
      const priv = MLKEMPrivateKey.new(level);
      const decoded = MLKEMPrivateKey.fromTaggedCborData(priv.taggedCborData());
      expect(decoded.data()).toEqual(priv.data());
    });
  }
});

describe("ML-DSA CBOR layout (matches Rust pqcrypto-mldsa)", () => {
  for (const level of [MLDSALevel.MLDSA44, MLDSALevel.MLDSA65, MLDSALevel.MLDSA87]) {
    it(`${String(level)} signs and verifies`, () => {
      const [priv, pub] = MLDSAPrivateKey.keypair(level);
      const message = new TextEncoder().encode("hello quantum world");

      const signature = priv.sign(message);
      expect(pub.verify(signature, message)).toBe(true);
      // Tampered message must fail.
      const tampered = new TextEncoder().encode("Hello quantum world");
      expect(pub.verify(signature, tampered)).toBe(false);
    });

    it(`${String(level)} private key tagged with 40103`, () => {
      const [priv] = MLDSAPrivateKey.keypair(level);
      expectTaggedAt(priv.taggedCborData(), 40103);
    });

    it(`${String(level)} public key tagged with 40104`, () => {
      const [, pub] = MLDSAPrivateKey.keypair(level);
      expectTaggedAt(pub.taggedCborData(), 40104);
    });

    it(`${String(level)} signature tagged with 40105`, () => {
      const [priv] = MLDSAPrivateKey.keypair(level);
      const sig = priv.sign(new TextEncoder().encode("data"));
      expectTaggedAt(sig.taggedCborData(), 40105);
    });
  }
});
