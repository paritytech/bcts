/**
 * Message keys derivation tests.
 */

import { describe, it, expect } from "vitest";
import { MessageKeys } from "../src/ratchet/message-keys.js";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

describe("MessageKeys", () => {
  it("should derive cipherKey (32), macKey (32), and iv (16)", () => {
    const seed = new Uint8Array(32).fill(0xab);
    const keys = MessageKeys.deriveFrom(seed, 42);

    expect(keys.cipherKey.length).toBe(32);
    expect(keys.macKey.length).toBe(32);
    expect(keys.iv.length).toBe(16);
    expect(keys.counter).toBe(42);
  });

  it("should produce deterministic output for same seed", () => {
    const seed = hexToBytes(
      "bf51e9d75e0e31031051f82a2491ffc084fa298b7793bd9db620056febf45217",
    );
    const keys1 = MessageKeys.deriveFrom(seed, 0);
    const keys2 = MessageKeys.deriveFrom(seed, 0);

    expect(keys1.cipherKey).toEqual(keys2.cipherKey);
    expect(keys1.macKey).toEqual(keys2.macKey);
    expect(keys1.iv).toEqual(keys2.iv);
  });

  it("should produce different output for different seeds", () => {
    const seed1 = new Uint8Array(32).fill(0x01);
    const seed2 = new Uint8Array(32).fill(0x02);
    const keys1 = MessageKeys.deriveFrom(seed1, 0);
    const keys2 = MessageKeys.deriveFrom(seed2, 0);

    expect(keys1.cipherKey).not.toEqual(keys2.cipherKey);
  });
});
