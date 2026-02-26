/**
 * Chain key tests with Signal's test vectors.
 *
 * Reference: libsignal/rust/protocol/src/ratchet/keys.rs (test_chain_key_derivation)
 */

import { describe, it, expect } from "vitest";
import { ChainKey } from "../src/ratchet/chain-key.js";
import { MessageKeys } from "../src/ratchet/message-keys.js";

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

describe("ChainKey", () => {
  // Signal test vectors from keys.rs
  const seed = hexToBytes("8ab72d6f4cc5ac0d387eaf463378ddb28edd07385b1cb01250c715982e7ad48f");
  const expectedMessageKey = "bf51e9d75e0e31031051f82a2491ffc084fa298b7793bd9db620056febf45217";
  const expectedMacKey = "c6c77d6a73a354337a56435e34607dfe48e3ace14e77314dc6abc172e7a7030b";
  const expectedNextChainKey = "28e8f8fee54b801eef7c5cfb2f17f32c7b334485bbb70fac6ec10342a246d15d";

  it("should have correct key and index", () => {
    const chainKey = new ChainKey(seed, 0);
    expect(bytesToHex(chainKey.key)).toBe(bytesToHex(seed));
    expect(chainKey.index).toBe(0);
  });

  it("should derive message keys matching Signal test vector", () => {
    const chainKey = new ChainKey(seed, 0);
    const messageKeySeed = chainKey.messageKeySeed();
    const messageKeys = MessageKeys.deriveFrom(messageKeySeed, 0);

    expect(bytesToHex(messageKeys.cipherKey)).toBe(expectedMessageKey);
    expect(bytesToHex(messageKeys.macKey)).toBe(expectedMacKey);
    expect(messageKeys.counter).toBe(0);
  });

  it("should advance chain key matching Signal test vector", () => {
    const chainKey = new ChainKey(seed, 0);
    const next = chainKey.nextChainKey();
    expect(bytesToHex(next.key)).toBe(expectedNextChainKey);
    expect(next.index).toBe(1);
  });

  it("should maintain correct counter through multiple advances", () => {
    const chainKey = new ChainKey(seed, 0);
    const next1 = chainKey.nextChainKey();
    const next2 = next1.nextChainKey();
    expect(next1.index).toBe(1);
    expect(next2.index).toBe(2);

    // Next chain key at index 1 should derive message keys with counter 1
    const messageKeys = MessageKeys.deriveFrom(next1.messageKeySeed(), 1);
    expect(messageKeys.counter).toBe(1);
  });
});
