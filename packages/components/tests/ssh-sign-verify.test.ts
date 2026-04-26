import { describe, it, expect } from "vitest";
import { SSHPrivateKey } from "../src/ssh/ssh-private-key.js";
import { SSHPublicKey } from "../src/ssh/ssh-public-key.js";
import { SSHSignature } from "../src/ssh/ssh-signature.js";

/**
 * End-to-end SSHSIG sign+verify round-trip — mirrors the assertions in
 * `bc-envelope-rust/tests/ssh_tests.rs::test_ssh_signed_plaintext`:
 *   1. Alice signs a message with her SSH key.
 *   2. The signature verifies against her public key.
 *   3. The signature does NOT verify against an unrelated public key.
 *
 * For Ed25519 we use the deterministic Rust fixture (same seed →
 * same signing key on both sides), so the signature bytes themselves
 * are deterministic too.
 */

const RUST_ED25519_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQAAAJA+TyZiPk8m
YgAAAAtzc2gtZWQyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQ
AAAECsX3CKi3hm5VrrU26ffa2FB2YrFogg45ucOVbIz4FQo1R7gUMbIYiAd/vnJV0TiFiX
2C6PTYV2whp2AsLTjM5tAAAADEtleSBjb21tZW50LgE=
-----END OPENSSH PRIVATE KEY-----
`;

const RUST_ECDSA_P256_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAaAAAABNlY2RzYS
1zaGEyLW5pc3RwMjU2AAAACG5pc3RwMjU2AAAAQQTtBE6+WTueAierXl/c/f83JAmoxm0k
YlGMVMofLOUFeKx3FqUW0VRVljx1wHL03faFhiTPVR9CNG5iZCUqa4eLAAAAqPC+XgXwvl
4FAAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBO0ETr5ZO54CJ6te
X9z9/zckCajGbSRiUYxUyh8s5QV4rHcWpRbRVFWWPHXAcvTd9oWGJM9VH0I0bmJkJSprh4
sAAAAgAVk1Bq0ILFsF/ADaUq8G5Tow0Xv+Qs8V21gfOBSWQDEAAAAMS2V5IGNvbW1lbnQu
AQIDBA==
-----END OPENSSH PRIVATE KEY-----
`;

const MESSAGE = new TextEncoder().encode(
  "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
);
const NAMESPACE = "test";

describe("SSHSIG sign + verify (Phase 7) — Rust round-trip parity", () => {
  it("ed25519: sign + verify round-trip succeeds", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const pub = priv.publicKey();
    const sig = priv.sign(NAMESPACE, "sha256", MESSAGE);
    expect(sig.namespace).toBe(NAMESPACE);
    expect(sig.hashAlgorithm).toBe("sha256");
    expect(sig.signatureBytes.length).toBe(64);
    expect(pub.verifySshSignature(NAMESPACE, MESSAGE, sig)).toBe(true);
  });

  it("ed25519: signature is deterministic for the same key/message", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const a = priv.sign(NAMESPACE, "sha256", MESSAGE);
    const b = priv.sign(NAMESPACE, "sha256", MESSAGE);
    expect(a.signatureBytes).toEqual(b.signatureBytes);
    expect(a.toPem()).toBe(b.toPem());
  });

  it("ed25519: verify rejects with wrong namespace", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const pub = priv.publicKey();
    const sig = priv.sign(NAMESPACE, "sha256", MESSAGE);
    expect(pub.verifySshSignature("other", MESSAGE, sig)).toBe(false);
  });

  it("ed25519: verify rejects with wrong message", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const pub = priv.publicKey();
    const sig = priv.sign(NAMESPACE, "sha256", MESSAGE);
    const tampered = new Uint8Array(MESSAGE);
    tampered[0] ^= 0x01;
    expect(pub.verifySshSignature(NAMESPACE, tampered, sig)).toBe(false);
  });

  it("ed25519: verify rejects when key doesn't match the signed-by key", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const sig = priv.sign(NAMESPACE, "sha256", MESSAGE);

    // A second, unrelated Ed25519 keypair. We just tweak one byte of the
    // public bytes to manufacture a non-matching key. `verifySshSignature`
    // compares OpenSSH text, so this returns false on the public-key
    // mismatch check before ever touching the curve verifier.
    const pubOther = priv.publicKey();
    const otherKeyBytes = new Uint8Array(pubOther.keyBytes);
    otherKeyBytes[0] ^= 0xff;
    const aliasedPub = SSHPublicKey.ed25519(otherKeyBytes);
    expect(aliasedPub.verifySshSignature(NAMESPACE, MESSAGE, sig)).toBe(false);
  });

  it("ed25519: SSHSignature parsed back from PEM also verifies", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ED25519_PRIVATE);
    const pub = priv.publicKey();
    const sig = priv.sign(NAMESPACE, "sha256", MESSAGE);
    const round = SSHSignature.fromPem(sig.toPem());
    expect(pub.verifySshSignature(NAMESPACE, MESSAGE, round)).toBe(true);
  });

  it("ecdsa-p256: sign + verify round-trip succeeds", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ECDSA_P256_PRIVATE);
    const pub = priv.publicKey();
    const sig = priv.sign(NAMESPACE, "sha256", MESSAGE);
    expect(sig.signatureBytes.length).toBe(64);
    expect(pub.verifySshSignature(NAMESPACE, MESSAGE, sig)).toBe(true);
    // Re-parse PEM and verify still works
    const round = SSHSignature.fromPem(sig.toPem());
    expect(pub.verifySshSignature(NAMESPACE, MESSAGE, round)).toBe(true);
  });

  it("ecdsa-p256: tampered signature fails verification", () => {
    const priv = SSHPrivateKey.fromOpenssh(RUST_ECDSA_P256_PRIVATE);
    const pub = priv.publicKey();
    const sig = priv.sign(NAMESPACE, "sha256", MESSAGE);
    const tampered = new Uint8Array(sig.signatureBytes);
    tampered[0] ^= 0x01;
    const tamperedSig = SSHSignature.fromParts(pub, NAMESPACE, "sha256", tampered);
    expect(pub.verifySshSignature(NAMESPACE, MESSAGE, tamperedSig)).toBe(false);
  });
});
