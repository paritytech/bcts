/**
 * Cross-impl test vector for `PrivateKeyBase` derivation.
 *
 * Mirrors `bc-components-rust/src/private_key_base.rs::test_private_key_base`
 * (`SEED = 59f2293a5bce7d4de59e71b4207ac5d2`). The expected hex values come
 * from the Rust suite — divergence here means the HKDF-based derivation
 * chain has drifted from `bc-rand` / `bc-crypto`.
 */

import { describe, it, expect } from "vitest";
import { PrivateKeyBase } from "../src/index.js";
import { bytesToHex, hexToBytes } from "../src/utils.js";

const SEED = hexToBytes("59f2293a5bce7d4de59e71b4207ac5d2");

describe("PrivateKeyBase — Rust SEED parity vector", () => {
  it("ECDSA signing private key matches Rust", () => {
    const pkb = PrivateKeyBase.fromData(SEED);
    const ecKey = pkb.ecdsaSigningPrivateKey().toEcdsa();
    if (ecKey === null) throw new Error("expected ECDSA private key");
    expect(bytesToHex(ecKey.data())).toBe(
      "9505a44aaf385ce633cf0e2bc49e65cc88794213bdfbf8caf04150b9c4905f5a",
    );
  });

  it("Schnorr signing public key matches Rust", () => {
    const pkb = PrivateKeyBase.fromData(SEED);
    const pub = pkb.schnorrSigningPrivateKey().publicKey().toSchnorr();
    if (pub === null) throw new Error("expected Schnorr public key");
    expect(bytesToHex(pub.data())).toBe(
      "fd4d22f9e8493da52d730aa402ac9e661deca099ef4db5503f519a73c3493e18",
    );
  });

  it("X25519 private key matches Rust", () => {
    const pkb = PrivateKeyBase.fromData(SEED);
    expect(bytesToHex(pkb.x25519PrivateKey().data())).toBe(
      "77ff838285a0403d3618aa8c30491f99f55221be0b944f50bfb371f43b897485",
    );
  });

  it("X25519 public key matches Rust", () => {
    const pkb = PrivateKeyBase.fromData(SEED);
    expect(bytesToHex(pkb.x25519PrivateKey().publicKey().data())).toBe(
      "863cf3facee3ba45dc54e5eedecb21d791d64adfb0a1c63bfb6fea366c1ee62b",
    );
  });
});
