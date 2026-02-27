import { describe, it, expect } from "vitest";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import {
  KYBER_KEY_TYPE_BYTE,
  KYBER1024_RAW_LENGTH,
  KYBER1024_PREFIXED_LENGTH,
  stripKemPrefix,
  addKemPrefix,
} from "../src/constants.js";

// ---------------------------------------------------------------------------
// stripKemPrefix
// ---------------------------------------------------------------------------

describe("stripKemPrefix", () => {
  it("should strip 0x08 prefix from a 1569-byte input", () => {
    const raw = new Uint8Array(KYBER1024_RAW_LENGTH).fill(0xab);
    const prefixed = new Uint8Array(KYBER1024_PREFIXED_LENGTH);
    prefixed[0] = KYBER_KEY_TYPE_BYTE;
    prefixed.set(raw, 1);

    const result = stripKemPrefix(prefixed);

    expect(result.length).toBe(KYBER1024_RAW_LENGTH);
    expect(result).toEqual(raw);
  });

  it("should return raw 1568-byte input unchanged", () => {
    const raw = new Uint8Array(KYBER1024_RAW_LENGTH).fill(0xcd);

    const result = stripKemPrefix(raw);

    expect(result.length).toBe(KYBER1024_RAW_LENGTH);
    expect(result).toEqual(raw);
  });

  it("should throw for invalid length (not 1568 or 1569)", () => {
    expect(() => stripKemPrefix(new Uint8Array(100))).toThrow(/Invalid KEM data length/);
    expect(() => stripKemPrefix(new Uint8Array(1567))).toThrow(/Invalid KEM data length/);
    expect(() => stripKemPrefix(new Uint8Array(1570))).toThrow(/Invalid KEM data length/);
    expect(() => stripKemPrefix(new Uint8Array(0))).toThrow(/Invalid KEM data length/);
  });

  it("should throw for 1569-byte input without 0x08 prefix", () => {
    const bad = new Uint8Array(KYBER1024_PREFIXED_LENGTH).fill(0x00);
    // First byte is not KYBER_KEY_TYPE_BYTE
    expect(() => stripKemPrefix(bad)).toThrow(/Invalid KEM data length/);
  });
});

// ---------------------------------------------------------------------------
// addKemPrefix
// ---------------------------------------------------------------------------

describe("addKemPrefix", () => {
  it("should add 0x08 prefix to a 1568-byte raw input", () => {
    const raw = new Uint8Array(KYBER1024_RAW_LENGTH).fill(0xef);

    const result = addKemPrefix(raw);

    expect(result.length).toBe(KYBER1024_PREFIXED_LENGTH);
    expect(result[0]).toBe(KYBER_KEY_TYPE_BYTE);
    expect(result.slice(1)).toEqual(raw);
  });

  it("should return already-prefixed 1569-byte input unchanged", () => {
    const prefixed = new Uint8Array(KYBER1024_PREFIXED_LENGTH);
    prefixed[0] = KYBER_KEY_TYPE_BYTE;
    prefixed.fill(0x42, 1);

    const result = addKemPrefix(prefixed);

    expect(result).toBe(prefixed); // same reference — no copy
  });

  it("should not double-prefix", () => {
    const raw = new Uint8Array(KYBER1024_RAW_LENGTH).fill(0x11);
    const once = addKemPrefix(raw);
    const twice = addKemPrefix(once);

    expect(twice.length).toBe(KYBER1024_PREFIXED_LENGTH);
    expect(twice[0]).toBe(KYBER_KEY_TYPE_BYTE);
    expect(twice).toBe(once); // same reference — idempotent
  });
});

// ---------------------------------------------------------------------------
// stripKemPrefix ↔ addKemPrefix round-trip
// ---------------------------------------------------------------------------

describe("stripKemPrefix ↔ addKemPrefix round-trip", () => {
  it("addKemPrefix(raw) → stripKemPrefix → original raw", () => {
    const raw = new Uint8Array(KYBER1024_RAW_LENGTH).fill(0xaa);
    const prefixed = addKemPrefix(raw);
    const stripped = stripKemPrefix(prefixed);

    expect(stripped).toEqual(raw);
  });

  it("stripKemPrefix(prefixed) → addKemPrefix → original prefixed", () => {
    const prefixed = new Uint8Array(KYBER1024_PREFIXED_LENGTH);
    prefixed[0] = KYBER_KEY_TYPE_BYTE;
    prefixed.fill(0xbb, 1);

    const stripped = stripKemPrefix(prefixed);
    const reprefixed = addKemPrefix(stripped);

    expect(reprefixed).toEqual(prefixed);
  });
});

// ---------------------------------------------------------------------------
// ML-KEM-1024 encapsulate/decapsulate with prefix handling
// ---------------------------------------------------------------------------

describe("ML-KEM-1024 interop with KEM prefix", () => {
  it("encapsulate(raw pk) → addPrefix(ct) → stripPrefix → decapsulate produces same shared secret", () => {
    // Generate a real ML-KEM-1024 key pair
    const { publicKey, secretKey } = ml_kem1024.keygen();

    expect(publicKey.length).toBe(KYBER1024_RAW_LENGTH);

    // Alice encapsulates with raw public key
    const { cipherText: rawCt, sharedSecret: aliceSS } = ml_kem1024.encapsulate(publicKey);

    expect(rawCt.length).toBe(KYBER1024_RAW_LENGTH);

    // Prefix the ciphertext for wire (matches Rust behavior)
    const wireCt = addKemPrefix(rawCt);
    expect(wireCt.length).toBe(KYBER1024_PREFIXED_LENGTH);
    expect(wireCt[0]).toBe(KYBER_KEY_TYPE_BYTE);

    // Bob receives wire ciphertext, strips prefix, decapsulates
    const strippedCt = stripKemPrefix(wireCt);
    const bobSS = ml_kem1024.decapsulate(strippedCt, secretKey);

    // Both sides must derive the same shared secret
    expect(bobSS).toEqual(aliceSS);
  });

  it("prefixed public key → stripPrefix → encapsulate → addPrefix → wire round-trip", () => {
    const { publicKey: rawPk, secretKey } = ml_kem1024.keygen();

    // Simulate Rust-generated bundle: public key has 0x08 prefix
    const prefixedPk = addKemPrefix(rawPk);
    expect(prefixedPk.length).toBe(KYBER1024_PREFIXED_LENGTH);

    // Alice receives prefixed pk, strips for encapsulation
    const strippedPk = stripKemPrefix(prefixedPk);
    const { cipherText: rawCt, sharedSecret: aliceSS } = ml_kem1024.encapsulate(strippedPk);

    // Prefix ciphertext for wire
    const wireCt = addKemPrefix(rawCt);

    // Bob strips and decapsulates
    const strippedCt = stripKemPrefix(wireCt);
    const bobSS = ml_kem1024.decapsulate(strippedCt, secretKey);

    expect(bobSS).toEqual(aliceSS);
  });

  it("raw public key → encapsulate → raw ciphertext → decapsulate (no prefix, backward compat)", () => {
    const { publicKey, secretKey } = ml_kem1024.keygen();

    const { cipherText, sharedSecret: aliceSS } = ml_kem1024.encapsulate(publicKey);
    const bobSS = ml_kem1024.decapsulate(cipherText, secretKey);

    expect(bobSS).toEqual(aliceSS);
  });
});
