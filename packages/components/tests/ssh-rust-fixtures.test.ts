/**
 * Copyright © 2025-2026 Parity Technologies
 *
 * Byte-identical parity tests against Rust `bc-components-rust v0.31.1`
 * SSH fixtures.
 *
 * Mirrors `bc-components-rust/src/lib.rs::test_ssh_signing` (line 263)
 * which derives an `SSHPrivateKey` from
 *   `PrivateKeyBase::from_data(hex!("59f2293a5bce7d4de59e71b4207ac5d2"))`
 *   `.ssh_signing_private_key(algorithm, "Key comment.")`
 * and asserts the OpenSSH PEM + public-key text are byte-identical.
 *
 * Tests covered here:
 *   - **Ed25519**: full byte-identical PEM + public-key fixture
 *     (Rust active test, `lib.rs:460`).
 *   - **DSA**: load Rust-generated PEM, derive matching public key,
 *     sign/verify round-trip, and PEM round-trip
 *     (Rust active test, `lib.rs:307` — TS does not yet support
 *     DSA-1024 keygen, so we cannot exercise the keygen path here).
 *   - **ECDSA P-256 / P-384**: sign/verify + PEM round-trip via
 *     `PrivateKeyBase.sshSigningPrivateKey`. Rust's matching
 *     byte-deterministic tests are `#[ignore]`'d (`lib.rs:345, 372`),
 *     so we don't enforce fixture equality here.
 */

import { describe, it, expect } from "vitest";
import {
  PrivateKeyBase,
  SignatureScheme,
  SigningPrivateKey,
  SigningPublicKey,
  SSHPrivateKey,
} from "../src";

// Mirror `bc-components-rust/src/lib.rs:268` — `SEED = hex!("59f2293a5bce7d4de59e71b4207ac5d2")`.
const RUST_SEED = new Uint8Array([
  0x59, 0xf2, 0x29, 0x3a, 0x5b, 0xce, 0x7d, 0x4d, 0xe5, 0x9e, 0x71, 0xb4, 0x20, 0x7a, 0xc5, 0xd2,
]);

const RUST_COMMENT = "Key comment.";

const RUST_MESSAGE = new TextEncoder().encode(
  "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
);

const RUST_NAMESPACE = "test";

// --- Ed25519 fixture (Rust `lib.rs:464-470, 473`) -----------------------------

const RUST_ED25519_PRIVATE_PEM = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQAAAJA+TyZiPk8m
YgAAAAtzc2gtZWQyNTUxOQAAACBUe4FDGyGIgHf75yVdE4hYl9guj02FdsIadgLC04zObQ
AAAECsX3CKi3hm5VrrU26ffa2FB2YrFogg45ucOVbIz4FQo1R7gUMbIYiAd/vnJV0TiFiX
2C6PTYV2whp2AsLTjM5tAAAADEtleSBjb21tZW50LgE=
-----END OPENSSH PRIVATE KEY-----
`;

const RUST_ED25519_PUBLIC_OPENSSH =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFR7gUMbIYiAd/vnJV0TiFiX2C6PTYV2whp2AsLTjM5t Key comment.";

// --- DSA fixture (Rust `lib.rs:310-330, 334`) ---------------------------------

const RUST_DSA_PRIVATE_PEM = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABsgAAAAdzc2gtZH
NzAAAAgQCWG4f7r8FAMT/IL11w9OfM/ZduIQ8vEq1Ub+uMdyJS8wS/jXL5OB2/dPnXCNSt
L4vjSqpDzMs+Dtd5wJy6baSQ3zGEbYv71mkIRJB/AtSVmd8FZe5AEjLFvHxYMSlO0jpi1Y
/1nLM7vLQu4QByDCLhYYjPxgrZKXB3cLxtjvly5wAAABUA4fIZLivnDVcg9PXzwcb5m07H
9k0AAACBAJK5Vm6t1Sg7n+C63wrNgDA6LTNyGzxqRVM2unI16jisCOzuC98Dgs+IbAkLhT
qWSY+nI+U9HBHc7sr+KKdWCzR76NLK5eSilXvtt8g+LfHIXvCjD4Q2puowtjDoXSEQAJYd
c1gtef21KZ2eoKoyAwzQIehCbvLpwYbxnhap5usVAAAAgGCrsbfReaDZo1Cw4/dFlJWBDP
sMGeG04/2hCThNmU+zLiKCwsEg0X6onOTMTonCXve3fVb5lNjIU92iTmt5QkmOj2hjsbgo
q/0sa0lALHp7UcK/W4IdU4Abtc4m0SUflgJcds1nsy2rKUNEtAfRa/WwtDResWOa4T7L+3
FEUdavAAAB6F0RJ3hdESd4AAAAB3NzaC1kc3MAAACBAJYbh/uvwUAxP8gvXXD058z9l24h
Dy8SrVRv64x3IlLzBL+Ncvk4Hb90+dcI1K0vi+NKqkPMyz4O13nAnLptpJDfMYRti/vWaQ
hEkH8C1JWZ3wVl7kASMsW8fFgxKU7SOmLVj/Wcszu8tC7hAHIMIuFhiM/GCtkpcHdwvG2O
+XLnAAAAFQDh8hkuK+cNVyD09fPBxvmbTsf2TQAAAIEAkrlWbq3VKDuf4LrfCs2AMDotM3
IbPGpFUza6cjXqOKwI7O4L3wOCz4hsCQuFOpZJj6cj5T0cEdzuyv4op1YLNHvo0srl5KKV
e+23yD4t8che8KMPhDam6jC2MOhdIRAAlh1zWC15/bUpnZ6gqjIDDNAh6EJu8unBhvGeFq
nm6xUAAACAYKuxt9F5oNmjULDj90WUlYEM+wwZ4bTj/aEJOE2ZT7MuIoLCwSDRfqic5MxO
icJe97d9VvmU2MhT3aJOa3lCSY6PaGOxuCir/SxrSUAsentRwr9bgh1TgBu1zibRJR+WAl
x2zWezLaspQ0S0B9Fr9bC0NF6xY5rhPsv7cURR1q8AAAAVANWljfuxQcmJ/T7wSmAUXmXo
6ZI0AAAADEtleSBjb21tZW50LgECAwQF
-----END OPENSSH PRIVATE KEY-----
`;

const RUST_DSA_PUBLIC_OPENSSH =
  "ssh-dss AAAAB3NzaC1kc3MAAACBAJYbh/uvwUAxP8gvXXD058z9l24hDy8SrVRv64x3IlLzBL+Ncvk4Hb90+dcI1K0vi+NKqkPMyz4O13nAnLptpJDfMYRti/vWaQhEkH8C1JWZ3wVl7kASMsW8fFgxKU7SOmLVj/Wcszu8tC7hAHIMIuFhiM/GCtkpcHdwvG2O+XLnAAAAFQDh8hkuK+cNVyD09fPBxvmbTsf2TQAAAIEAkrlWbq3VKDuf4LrfCs2AMDotM3IbPGpFUza6cjXqOKwI7O4L3wOCz4hsCQuFOpZJj6cj5T0cEdzuyv4op1YLNHvo0srl5KKVe+23yD4t8che8KMPhDam6jC2MOhdIRAAlh1zWC15/bUpnZ6gqjIDDNAh6EJu8unBhvGeFqnm6xUAAACAYKuxt9F5oNmjULDj90WUlYEM+wwZ4bTj/aEJOE2ZT7MuIoLCwSDRfqic5MxOicJe97d9VvmU2MhT3aJOa3lCSY6PaGOxuCir/SxrSUAsentRwr9bgh1TgBu1zibRJR+WAlx2zWezLaspQ0S0B9Fr9bC0NF6xY5rhPsv7cURR1q8= Key comment.";

describe("SSH fixture parity with Rust `bc-components-rust v0.31.1`", () => {
  describe("Ed25519 — byte-identical keygen + sign/verify round-trip", () => {
    it("derives the Rust Ed25519 fixture byte-for-byte from SEED", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const privateKey = base.sshSigningPrivateKey({ kind: "ed25519" }, RUST_COMMENT);

      expect(privateKey).toBeInstanceOf(SigningPrivateKey);
      expect(privateKey.scheme()).toBe(SignatureScheme.SshEd25519);

      // Byte-identical with Rust's `to_openssh(LineEnding::LF)`.
      expect(privateKey.toSshOpenssh()).toBe(RUST_ED25519_PRIVATE_PEM);

      const publicKey = privateKey.publicKey();
      expect(publicKey.scheme()).toBe(SignatureScheme.SshEd25519);
      expect(publicKey.toSshOpenssh()).toBe(RUST_ED25519_PUBLIC_OPENSSH);
    });

    it("signs and verifies via SignatureScheme dispatch", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const privateKey = base.sshSigningPrivateKey({ kind: "ed25519" }, RUST_COMMENT);
      const publicKey = privateKey.publicKey();
      const sig = privateKey.signWithOptions(RUST_MESSAGE, {
        type: "Ssh",
        namespace: RUST_NAMESPACE,
        hashAlg: "sha256",
      });
      expect(publicKey.verify(sig, RUST_MESSAGE)).toBe(true);
    });
  });

  describe("DSA — load Rust fixture, sign/verify, PEM round-trip", () => {
    // TS does not (yet) implement DSA-1024 keygen byte-for-byte with the
    // upstream `dsa` crate's FIPS 186-4 prime search; see
    // `SSH_V2_PLAN.md` A.1. We therefore exercise the loaded-key path.

    it("round-trips the Rust DSA fixture PEM byte-for-byte", () => {
      const sshKey = SSHPrivateKey.fromOpenssh(RUST_DSA_PRIVATE_PEM);
      expect(sshKey.toOpenssh()).toBe(RUST_DSA_PRIVATE_PEM);
      const privateKey = SigningPrivateKey.fromSsh(sshKey);
      expect(privateKey.scheme()).toBe(SignatureScheme.SshDsa);
      expect(privateKey.toSshOpenssh()).toBe(RUST_DSA_PRIVATE_PEM);
    });

    it("derives the Rust DSA public-key fixture byte-for-byte from the loaded private key", () => {
      const sshKey = SSHPrivateKey.fromOpenssh(RUST_DSA_PRIVATE_PEM);
      const privateKey = SigningPrivateKey.fromSsh(sshKey);
      const publicKey = privateKey.publicKey();
      expect(publicKey.scheme()).toBe(SignatureScheme.SshDsa);
      expect(publicKey.toSshOpenssh()).toBe(RUST_DSA_PUBLIC_OPENSSH);
    });

    it("signs and verifies a message via SignatureScheme dispatch", () => {
      const sshKey = SSHPrivateKey.fromOpenssh(RUST_DSA_PRIVATE_PEM);
      const privateKey = SigningPrivateKey.fromSsh(sshKey);
      const publicKey = privateKey.publicKey();
      const sig = privateKey.signWithOptions(RUST_MESSAGE, {
        type: "Ssh",
        namespace: RUST_NAMESPACE,
        hashAlg: "sha256",
      });
      expect(publicKey.verify(sig, RUST_MESSAGE)).toBe(true);
    });
  });

  describe("ECDSA P-256 — keygen + sign/verify (no Rust fixture: Rust test is `#[ignore]`'d)", () => {
    it("derives a P-256 SSH key from SEED and round-trips through OpenSSH", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const privateKey = base.sshSigningPrivateKey(
        { kind: "ecdsa", curve: "nistp256" },
        RUST_COMMENT,
      );
      expect(privateKey.scheme()).toBe(SignatureScheme.SshEcdsaP256);
      const pem = privateKey.toSshOpenssh();
      const reloaded = SigningPrivateKey.fromSsh(SSHPrivateKey.fromOpenssh(pem));
      expect(reloaded.toSshOpenssh()).toBe(pem);
    });

    it("signs and verifies via SignatureScheme dispatch", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const privateKey = base.sshSigningPrivateKey(
        { kind: "ecdsa", curve: "nistp256" },
        RUST_COMMENT,
      );
      const publicKey = privateKey.publicKey();
      const sig = privateKey.signWithOptions(RUST_MESSAGE, {
        type: "Ssh",
        namespace: RUST_NAMESPACE,
        hashAlg: "sha256",
      });
      expect(publicKey.verify(sig, RUST_MESSAGE)).toBe(true);
    });
  });

  describe("ECDSA P-384 — keygen + sign/verify (no Rust fixture: Rust test is `#[ignore]`'d)", () => {
    it("derives a P-384 SSH key from SEED and round-trips through OpenSSH", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const privateKey = base.sshSigningPrivateKey(
        { kind: "ecdsa", curve: "nistp384" },
        RUST_COMMENT,
      );
      expect(privateKey.scheme()).toBe(SignatureScheme.SshEcdsaP384);
      const pem = privateKey.toSshOpenssh();
      const reloaded = SigningPrivateKey.fromSsh(SSHPrivateKey.fromOpenssh(pem));
      expect(reloaded.toSshOpenssh()).toBe(pem);
    });

    it("signs and verifies via SignatureScheme dispatch", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const privateKey = base.sshSigningPrivateKey(
        { kind: "ecdsa", curve: "nistp384" },
        RUST_COMMENT,
      );
      const publicKey = privateKey.publicKey();
      const sig = privateKey.signWithOptions(RUST_MESSAGE, {
        type: "Ssh",
        namespace: RUST_NAMESPACE,
        hashAlg: "sha512",
      });
      expect(publicKey.verify(sig, RUST_MESSAGE)).toBe(true);
    });
  });

  describe("CBOR round-trip for SSH SigningPrivateKey / SigningPublicKey / Signature", () => {
    it("Ed25519: SigningPrivateKey CBOR round-trip", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const sk = base.sshSigningPrivateKey({ kind: "ed25519" }, RUST_COMMENT);
      const data = sk.taggedCborData();
      const decoded = SigningPrivateKey.fromTaggedCborData(data);
      expect(decoded.scheme()).toBe(SignatureScheme.SshEd25519);
      expect(decoded.toSshOpenssh()).toBe(sk.toSshOpenssh());
    });

    it("Ed25519: SigningPublicKey CBOR round-trip", () => {
      const base = PrivateKeyBase.fromData(RUST_SEED);
      const sk = base.sshSigningPrivateKey({ kind: "ed25519" }, RUST_COMMENT);
      const pk = sk.publicKey();
      const data = pk.taggedCborData();
      const decoded = SigningPublicKey.fromTaggedCborData(data);
      expect(decoded.scheme()).toBe(SignatureScheme.SshEd25519);
      expect(decoded.toSshOpenssh()).toBe(pk.toSshOpenssh());
    });
  });
});
