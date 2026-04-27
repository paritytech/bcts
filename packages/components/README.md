# Blockchain Commons Secure Components for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

A collection of useful primitives for cryptography, semantic graphs, and cryptocurrency, primarily for use in higher-level [Blockchain Commons](https://blockchaincommons.com) projects. All the types are [CBOR](https://cbor.io) serializable, and a number of them can also be serialized to and from [URs](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md).

Also includes a library of CBOR tags and UR types for use with these types.

## Rust Reference Implementation

This TypeScript implementation is based on [bc-components-rust](https://github.com/BlockchainCommons/bc-components-rust) **v0.31.1** ([commit](https://github.com/BlockchainCommons/bc-components-rust/tree/fe31ddd48c1a1b0dfa161e876f7ea5bbadfb5a8f)).

### SSH Support

OpenSSH text-format keys, signatures, and certificates round-trip byte-identically with Rust's `bc-components-rust`. They can be parsed, re-serialized, signed with, and verified directly via the `SSHPrivateKey`, `SSHPublicKey`, `SSHSignature`, and `SSHCertificate` classes, and they format correctly through the envelope summarizers (`tag(40800..40803)`).

Algorithms supported for direct sign/verify and round-trip:

- Ed25519 (`ssh-ed25519`)
- ECDSA P-256 (`ecdsa-sha2-nistp256`, SHA-256)
- ECDSA P-384 (`ecdsa-sha2-nistp384`, SHA-384)
- DSA (`ssh-dss`, 1024-bit p / 160-bit q / SHA-1) — RFC 6979 deterministic `k`, byte-identical to Rust's `dsa` crate. Cryptographically deprecated; supported only for legacy interop.

#### Deferred SSH features

The following are deferred and will throw a clear error when attempted:

- **SSH agent integration** — `SignatureScheme::SshEd25519` / `SshDsa` / `SshEcdsaP256` / `SshEcdsaP384` dispatch through `SigningPrivateKey.signWithOptions`, plus `SSHAgent` key-derivation. These require a platform-specific agent transport that is not yet wired up. Use the SSH classes directly, or use `Ed25519` / `Schnorr` / `Ecdsa` / `Sr25519` / `MLDSA*` schemes; for key derivation use `HKDF`, `PBKDF2`, `Scrypt`, or `Argon2id`.
- **Encrypted private keys** — `OPENSSH PRIVATE KEY` blocks with `ciphername != "none"` (bcrypt-pbkdf + AES-256-CTR) are rejected.
- **RSA-2048** (`ssh-rsa`) — pending Noble RSA primitives.
- **ECDSA P-521** (`ecdsa-sha2-nistp521`) — pending upstream fix in `ssh-key` ([RustCrypto/SSH#232](https://github.com/RustCrypto/SSH/issues/232)).
- **`cert-v01@openssh.com` validation** — `SSHCertificate` round-trips the OpenSSH text verbatim and uses the fixed summarizer string, matching Rust's placeholder-only state.

See `SSH_PLAN.md` at the repo root for the detailed parity history.

