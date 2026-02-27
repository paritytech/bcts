import { describe, it, expect } from "vitest";
import { deriveKeys, spqrChainParams } from "../src/session-init.js";

describe("deriveKeys", () => {
  it("should produce rootKey, chainKey, and pqrAuthKey each of 32 bytes", () => {
    const input = new Uint8Array(64).fill(0xab);
    const { rootKey, chainKey, pqrAuthKey } = deriveKeys(input);

    expect(rootKey).toBeInstanceOf(Uint8Array);
    expect(chainKey).toBeInstanceOf(Uint8Array);
    expect(pqrAuthKey).toBeInstanceOf(Uint8Array);

    expect(rootKey.length).toBe(32);
    expect(chainKey.length).toBe(32);
    expect(pqrAuthKey.length).toBe(32);
  });

  it("should be deterministic: same input produces identical output", () => {
    const input = new Uint8Array(48).fill(0x42);

    const first = deriveKeys(input);
    const second = deriveKeys(input);

    expect(first.rootKey).toEqual(second.rootKey);
    expect(first.chainKey).toEqual(second.chainKey);
    expect(first.pqrAuthKey).toEqual(second.pqrAuthKey);
  });

  it("should produce different outputs for different inputs", () => {
    const inputA = new Uint8Array(32).fill(0x01);
    const inputB = new Uint8Array(32).fill(0x02);

    const keysA = deriveKeys(inputA);
    const keysB = deriveKeys(inputB);

    expect(keysA.rootKey).not.toEqual(keysB.rootKey);
    expect(keysA.chainKey).not.toEqual(keysB.chainKey);
    expect(keysA.pqrAuthKey).not.toEqual(keysB.pqrAuthKey);
  });

  it("should produce three mutually distinct keys from the same derivation", () => {
    const input = new Uint8Array(32).fill(0xcc);
    const { rootKey, chainKey, pqrAuthKey } = deriveKeys(input);

    expect(rootKey).not.toEqual(chainKey);
    expect(rootKey).not.toEqual(pqrAuthKey);
    expect(chainKey).not.toEqual(pqrAuthKey);
  });

  it("should produce a deterministic result for an all-zeros 32-byte input", () => {
    const input = new Uint8Array(32); // all zeros

    const first = deriveKeys(input);
    const second = deriveKeys(input);

    expect(first.rootKey).toEqual(second.rootKey);
    expect(first.chainKey).toEqual(second.chainKey);
    expect(first.pqrAuthKey).toEqual(second.pqrAuthKey);

    // Verify the output is not degenerate (not all zeros)
    const allZero32 = new Uint8Array(32);
    expect(first.rootKey).not.toEqual(allZero32);
    expect(first.chainKey).not.toEqual(allZero32);
    expect(first.pqrAuthKey).not.toEqual(allZero32);
  });

  it("should produce valid 96 bytes of output even for an empty input", () => {
    const input = new Uint8Array(0);
    const { rootKey, chainKey, pqrAuthKey } = deriveKeys(input);

    expect(rootKey.length).toBe(32);
    expect(chainKey.length).toBe(32);
    expect(pqrAuthKey.length).toBe(32);

    // Output must still be deterministic
    const again = deriveKeys(new Uint8Array(0));
    expect(rootKey).toEqual(again.rootKey);
    expect(chainKey).toEqual(again.chainKey);
    expect(pqrAuthKey).toEqual(again.pqrAuthKey);
  });
});

describe("spqrChainParams", () => {
  it("should return maxJump=25000 and maxOooKeys=2000 for a non-self-session", () => {
    const params = spqrChainParams(false);

    expect(params.maxJump).toBe(25_000);
    expect(params.maxOooKeys).toBe(2_000);
  });

  it("should return maxJump=0xFFFFFFFF (4294967295) and maxOooKeys=2000 for a self-session", () => {
    const params = spqrChainParams(true);

    expect(params.maxJump).toBe(0xFFFFFFFF);
    expect(params.maxJump).toBe(4_294_967_295);
    expect(params.maxOooKeys).toBe(2_000);
  });
});
