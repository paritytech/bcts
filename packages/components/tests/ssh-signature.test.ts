import { describe, it, expect } from "vitest";
import { SSHSignature } from "../src/ssh/ssh-signature.js";
import { SSHPublicKey } from "../src/ssh/ssh-public-key.js";

const RUST_ED25519_PUBLIC =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFR7gUMbIYiAd/vnJV0TiFiX2C6PTYV2whp2AsLTjM5t Key comment.";

describe("SSHSignature — SSHSIG parser/serializer parity", () => {
  it("ed25519: round-trips a synthetic SSHSIG byte-identically (PEM)", () => {
    const pub = SSHPublicKey.fromOpenssh(RUST_ED25519_PUBLIC);
    const sigBytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) sigBytes[i] = i + 1;
    const sig = SSHSignature.fromParts(pub, "test", "sha256", sigBytes);
    const pem = sig.toPem();
    expect(pem.startsWith("-----BEGIN SSH SIGNATURE-----\n")).toBe(true);
    expect(pem.endsWith("-----END SSH SIGNATURE-----\n")).toBe(true);

    const round = SSHSignature.fromPem(pem);
    expect(round.namespace).toBe("test");
    expect(round.hashAlgorithm).toBe("sha256");
    // SSH wire-format pubkey blob does NOT carry the comment (only the
    // OpenSSH single-line text format does). Round-tripped public keys
    // therefore have an empty comment.
    expect(round.publicKey.toOpenssh()).toBe(RUST_ED25519_PUBLIC.split(" ").slice(0, 2).join(" "));
    expect(round.publicKey.keyBytes).toEqual(pub.keyBytes);
    expect(round.signatureBytes).toEqual(sigBytes);
    expect(round.toPem()).toBe(pem);
    expect(round.toString()).toBe("SSHSignature");
  });

  it("ecdsa-p256: round-trips a synthetic SSHSIG with r || s mpint encoding", () => {
    const pub = SSHPublicKey.fromOpenssh(
      "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBO0ETr5ZO54CJ6teX9z9/zckCajGbSRiUYxUyh8s5QV4rHcWpRbRVFWWPHXAcvTd9oWGJM9VH0I0bmJkJSprh4s= Key comment.",
    );
    // r has high bit set (will get sign byte) — exercises the mpint path
    // s has low bit set (no sign byte)
    const r = new Uint8Array(32);
    const s = new Uint8Array(32);
    r[0] = 0xfe; // high bit set
    s[0] = 0x01;
    for (let i = 1; i < 32; i++) {
      r[i] = i;
      s[i] = i;
    }
    const sigBytes = new Uint8Array(64);
    sigBytes.set(r, 0);
    sigBytes.set(s, 32);

    const sig = SSHSignature.fromParts(pub, "git", "sha512", sigBytes);
    const pem = sig.toPem();
    const round = SSHSignature.fromPem(pem);

    expect(round.namespace).toBe("git");
    expect(round.hashAlgorithm).toBe("sha512");
    expect(round.signatureBytes).toEqual(sigBytes);
    expect(round.toPem()).toBe(pem);
  });

  it("PEM body is wrapped at 76 columns", () => {
    const pub = SSHPublicKey.fromOpenssh(RUST_ED25519_PUBLIC);
    const sig = SSHSignature.fromParts(pub, "test", "sha256", new Uint8Array(64));
    const lines = sig.toPem().split("\n");
    // Skip BEGIN/END header lines (first and second-to-last); body lines (except last)
    // must be exactly 76 chars wide per PROTOCOL.sshsig encoding rubric.
    const bodyLines = lines.slice(1, -2);
    for (const line of bodyLines.slice(0, -1)) {
      expect(line.length).toBe(76);
    }
    const last = bodyLines[bodyLines.length - 1] ?? "";
    expect(last.length).toBeLessThanOrEqual(76);
  });

  it("rejects unknown SSHSIG version", () => {
    const pub = SSHPublicKey.fromOpenssh(RUST_ED25519_PUBLIC);
    const sig = SSHSignature.fromParts(pub, "test", "sha256", new Uint8Array(64));
    const blob = sig.toBlob();
    // Bytes 6..10 (after "SSHSIG" magic) hold version big-endian. Bump it.
    const corrupted = new Uint8Array(blob);
    corrupted[6 + 3] = 2;
    expect(() => SSHSignature.fromBlob(corrupted)).toThrow(/version 2/);
  });

  it("rejects missing magic", () => {
    expect(() => SSHSignature.fromBlob(new Uint8Array([0, 1, 2, 3]))).toThrow(/SSHSIG/);
  });

  it("rejects unsupported hash algorithm", () => {
    const pub = SSHPublicKey.fromOpenssh(RUST_ED25519_PUBLIC);
    const sig = SSHSignature.fromParts(pub, "test", "sha256", new Uint8Array(64));
    const blob = sig.toBlob();
    // Find the hash_algorithm string ("sha256" → bytes 73 73 68 61 32 35 36) and patch
    // it to "sha999" of the same length so the parser rejects on value, not on length.
    const utf8 = new TextEncoder().encode("sha256");
    const replacement = new TextEncoder().encode("sha999");
    let idx = -1;
    outer: for (let i = 0; i + utf8.length <= blob.length; i++) {
      for (let j = 0; j < utf8.length; j++) if (blob[i + j] !== utf8[j]) continue outer;
      idx = i;
      break;
    }
    expect(idx).toBeGreaterThan(0);
    const corrupted = new Uint8Array(blob);
    corrupted.set(replacement, idx);
    expect(() => SSHSignature.fromBlob(corrupted)).toThrow(/hash algorithm 'sha999'/);
  });
});
