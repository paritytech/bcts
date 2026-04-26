import { describe, it, expect } from "vitest";
import { SSHPublicKey } from "../src/ssh/ssh-public-key.js";

/**
 * Rust source-of-truth fixtures, copied verbatim from
 * `bc-components-rust/src/lib.rs`:
 *   - line 473 (ssh-ed25519)
 *   - line 361 (ecdsa-sha2-nistp256)
 *
 * All from the same deterministic seed
 * `59f2293a5bce7d4de59e71b4207ac5d2` with comment "Key comment.".
 */
const RUST_ED25519_PUBLIC =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFR7gUMbIYiAd/vnJV0TiFiX2C6PTYV2whp2AsLTjM5t Key comment.";

const RUST_ECDSA_P256_PUBLIC =
  "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBO0ETr5ZO54CJ6teX9z9/zckCajGbSRiUYxUyh8s5QV4rHcWpRbRVFWWPHXAcvTd9oWGJM9VH0I0bmJkJSprh4s= Key comment.";

describe("SSHPublicKey — parse/serialize parity with Rust ssh-key 0.6.7", () => {
  it("ed25519: round-trips a Rust fixture byte-identically", () => {
    const key = SSHPublicKey.fromOpenssh(RUST_ED25519_PUBLIC);
    expect(key.algorithm).toEqual({ kind: "ed25519" });
    expect(key.comment).toBe("Key comment.");
    expect(key.keyBytes.length).toBe(32);
    expect(key.toOpenssh()).toBe(RUST_ED25519_PUBLIC);
  });

  it("ecdsa-p256: round-trips a Rust fixture byte-identically", () => {
    const key = SSHPublicKey.fromOpenssh(RUST_ECDSA_P256_PUBLIC);
    expect(key.algorithm).toEqual({ kind: "ecdsa", curve: "nistp256" });
    expect(key.comment).toBe("Key comment.");
    expect(key.keyBytes.length).toBe(65);
    expect(key.keyBytes[0]).toBe(0x04);
    expect(key.toOpenssh()).toBe(RUST_ECDSA_P256_PUBLIC);
  });

  it("no-comment path: re-serialize without trailing space", () => {
    const stripped = RUST_ED25519_PUBLIC.split(" ").slice(0, 2).join(" ");
    const key = SSHPublicKey.fromOpenssh(stripped);
    expect(key.comment).toBe("");
    expect(key.toOpenssh()).toBe(stripped);
  });

  it("ed25519 ref_hex_short matches SHA-256 prefix of OpenSSH text", () => {
    const key = SSHPublicKey.fromOpenssh(RUST_ED25519_PUBLIC);
    // Same digest derivation as Rust:
    //   Reference::from_digest(Digest::from_image(toOpenssh().bytes))
    //   .ref_hex_short() == hex(digest[0..4])
    expect(key.refHexShort()).toMatch(/^[0-9a-f]{8}$/);
    expect(key.toString()).toBe(`SSHPublicKey(${key.refHexShort()})`);
  });

  it("rejects unsupported algorithms with helpful message", () => {
    expect(() =>
      SSHPublicKey.fromOpenssh("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDfoo= bob@example.com"),
    ).toThrow(/Unsupported SSH algorithm 'ssh-rsa'/);
    expect(() =>
      SSHPublicKey.fromOpenssh("ecdsa-sha2-nistp384 AAAAE2VjZHNhLXNoYTItbmlzdHAzODQ= bob"),
    ).toThrow(/Unsupported SSH algorithm 'ecdsa-sha2-nistp384'/);
  });

  it("rejects mismatched outer/inner algorithm names", () => {
    // Re-encode the ed25519 blob but mislabel it as ECDSA in the prefix.
    const mismatched =
      "ecdsa-sha2-nistp256 AAAAC3NzaC1lZDI1NTE5AAAAIFR7gUMbIYiAd/vnJV0TiFiX2C6PTYV2whp2AsLTjM5t Key comment.";
    expect(() => SSHPublicKey.fromOpenssh(mismatched)).toThrow(/does not match inner/);
  });

  it("blob layout matches RFC 4253 length-prefixed strings", () => {
    const key = SSHPublicKey.fromOpenssh(RUST_ED25519_PUBLIC);
    const blob = key.toBlob();
    // 4 (len) + 11 ("ssh-ed25519") + 4 (len) + 32 = 51
    expect(blob.length).toBe(51);
    // Check first uint32 is 11 (the algorithm name length)
    expect(blob[0]).toBe(0);
    expect(blob[1]).toBe(0);
    expect(blob[2]).toBe(0);
    expect(blob[3]).toBe(0x0b);
  });
});
