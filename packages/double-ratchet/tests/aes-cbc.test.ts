/**
 * AES-256-CBC tests with Signal's test vectors.
 *
 * Reference: libsignal/rust/crypto/src/aes_cbc.rs (test)
 */

import { describe, it, expect } from "vitest";
import { aes256CbcEncrypt, aes256CbcDecrypt } from "../src/crypto/aes-cbc.js";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("AES-256-CBC", () => {
  // Signal test vector from aes_cbc.rs
  const key = hexToBytes("4e22eb16d964779994222e82192ce9f747da72dc4abe49dfdeeb71d0ffe3796e");
  const iv = hexToBytes("6f8a557ddc0a140c878063a6d5f31d3d");
  const plaintext = hexToBytes("30736294a124482a4159");
  const expectedCiphertext = "dd3f573ab4508b9ed0e45e0baf5608f3";

  it("should encrypt matching Signal test vector", () => {
    const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
    expect(bytesToHex(ciphertext)).toBe(expectedCiphertext);
  });

  it("should decrypt matching Signal test vector", () => {
    const ciphertext = hexToBytes(expectedCiphertext);
    const decrypted = aes256CbcDecrypt(ciphertext, key, iv);
    expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
  });

  it("should round-trip encrypt/decrypt", () => {
    const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
    const decrypted = aes256CbcDecrypt(ciphertext, key, iv);
    expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
  });

  it("should handle empty plaintext", () => {
    const ciphertext = aes256CbcEncrypt(new Uint8Array(0), key, iv);
    expect(ciphertext.length).toBe(16); // One block of padding
    const decrypted = aes256CbcDecrypt(ciphertext, key, iv);
    expect(decrypted.length).toBe(0);
  });

  it("should handle plaintext that is exact block size", () => {
    const data = new Uint8Array(16).fill(0x42);
    const ciphertext = aes256CbcEncrypt(data, key, iv);
    expect(ciphertext.length).toBe(32); // Two blocks (one extra for padding)
    const decrypted = aes256CbcDecrypt(ciphertext, key, iv);
    expect(bytesToHex(decrypted)).toBe(bytesToHex(data));
  });

  it("should reject invalid key size", () => {
    expect(() => aes256CbcEncrypt(plaintext, new Uint8Array(16), iv)).toThrow();
  });

  it("should reject invalid IV size", () => {
    expect(() => aes256CbcEncrypt(plaintext, key, new Uint8Array(8))).toThrow();
  });

  it("should reject empty ciphertext on decrypt", () => {
    expect(() => aes256CbcDecrypt(new Uint8Array(0), key, iv)).toThrow();
  });

  it("should reject non-block-aligned ciphertext on decrypt", () => {
    expect(() => aes256CbcDecrypt(new Uint8Array(15), key, iv)).toThrow();
  });

  it("should detect bitflip in IV (Signal behavior)", () => {
    const ciphertext = hexToBytes(expectedCiphertext);
    const badIv = hexToBytes("ef8a557ddc0a140c878063a6d5f31d3d");
    const decrypted = aes256CbcDecrypt(ciphertext, key, badIv);
    // Bitflip in IV changes first block of decrypted text
    expect(bytesToHex(decrypted)).toBe("b0736294a124482a4159");
  });
});
