# BCTS - Blockchain Commons for TypeScript

[![Version](https://img.shields.io/badge/version-1.0.0--alpha.21-green)](https://github.com/paritytech/bcts/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Monorepo](https://img.shields.io/badge/Monorepo-Turborepo-blueviolet)](https://turbo.build/)
[![Package Manager](https://img.shields.io/badge/Package%20Manager-Bun-FFD700)](https://bun.sh/)
[![Status](https://img.shields.io/badge/Status-Early%20Development-orange)](#-disclaimer)

🔷 **Community Implementation:** This is a TypeScript port of the Blockchain Commons' open specifications and implementations.

> ⚠️ **Disclaimer:** This is a project in active development. It has not been audited, APIs and interfaces are subject to change.

## Overview

This repository includes 19 packages covering deterministic CBOR encoding (dCBOR), Gordian Envelope for privacy-preserving data containers, Uniform Resources (URs) for QR code transport, cryptographic primitives (ChaCha20-Poly1305, BLAKE3, HKDF), secret sharing (Shamir/SSKR), decentralized identity (XID), provenance verification, visual hashing (LifeHash), and distributed infrastructure for threshold signatures (FROST/Hubert). The suite also provides 5 CLI tools and an interactive web IDE. All implementations follow the Rust reference implementations as the source of truth.

## 📚 Resources

- [CBOR Book](https://cborbook.com/) - Comprehensive guide to CBOR, dCBOR, and Gordian Envelope
- [BC YouTube Channel](https://www.youtube.com/@blockchaincommons) - A YouTube channel with many lectures and tutorials
- [BC Developer Docs](https://developer.blockchaincommons.com/) - BC's developer documentation
- [JSON vs CBOR](https://hackmd.io/@leonardocustodio/json-vs-cbor) - Comparison of JSON and CBOR formats
- [Deterministic Data: Intro to dCBOR](https://hackmd.io/@leonardocustodio/deterministic-data-intro-to-dcbor) - Introduction to deterministic CBOR
- [dCBOR Deep Dive](https://hackmd.io/@leonardocustodio/deep-dive-dcbor) - Why "almost" deterministic isn't enough

## 🎮 Applications

### [BCTS IDE](apps/playground)
An interactive web application for experimenting with dCBOR encoding, Uniform Resources decoding, and Gordian Envelope visualization.

**Features:**

- **Data Playground** - Parse and visualize data with multiple input formats (Hex, UR, Bytewords) and output views (JSON, dCBOR, Diagnostic, Envelope tree)
- **Envelope Builder** - Visual tree builder for creating Gordian Envelopes with signing, encryption, compression, elision, and salting transformations
- **Registry Browser** - Browse CBOR tags, Known Values, and live IANA registry with category filtering and search
- **QR Code Support** - Generate QR codes from UR output, scan via camera (including animated/fountain codes), and upload QR images
- **Key Management** - Create and manage signing keys, encryption keys, and multi-recipient public keys
- **Selective Disclosure** - Elide assertions while maintaining cryptographic integrity for privacy-preserving data sharing
- **Templates & Examples** - Pre-built envelope patterns and example data for common use cases

**Try it locally:**
```bash
bun playground
```

**Live Demo:** https://bcts.dev

## 📦 Packages

| Package | Description |
|---------|-------------|
| [**components**](packages/components) | Shared component utilities and helpers for the Blockchain Commons ecosystem. [📖 Docs](https://docs.bcts.dev/api/components) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-components-rust) |
| [**crypto**](packages/crypto) | Cryptographic primitives including symmetric encryption (ChaCha20-Poly1305), hashing (SHA-256, BLAKE3), and key derivation (HKDF, PBKDF2). [📖 Docs](https://docs.bcts.dev/api/crypto) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-crypto-rust) |
| [**dcbor**](packages/dcbor) | Deterministic CBOR encoding - a specification for serializing data in a canonical, reproducible format. Ensures identical byte sequences for cryptographic operations and blockchain applications. [📖 Docs](https://docs.bcts.dev/api/dcbor) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-rust) |
| [**dcbor-parse**](packages/dcbor-parse) | dCBOR Diagnostic Parser - parse and compose CBOR diagnostic notation into dCBOR data items. Supports booleans, numbers, strings, byte strings (hex/base64), tagged values, arrays, maps, URs, known values, and date literals. [📖 Docs](https://docs.bcts.dev/api/dcbor-parse) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-parse-rust) |
| [**dcbor-pattern**](packages/dcbor-pattern) | Pattern matching for dCBOR - a powerful query language for matching and extracting data from dCBOR structures. Supports value, structure, and meta patterns with named captures and VM-based execution. [📖 Docs](https://docs.bcts.dev/api/dcbor-pattern) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-pattern-rust) |
| [**envelope**](packages/envelope) | Gordian Envelope - structured, privacy-focused data containers for secure information exchange. Supports encryption, elision, and cryptographic assertions. [📖 Docs](https://docs.bcts.dev/api/envelope) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-envelope-rust) |
| [**envelope-pattern**](packages/envelope-pattern) | Pattern matching for Gordian Envelope - query and extract data from Envelope structures. Supports leaf, structure, and meta patterns with subject/predicate/object matching and tree traversal. [📖 Docs](https://docs.bcts.dev/api/envelope-pattern) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-envelope-pattern-rust) |
| [**frost-hubert**](packages/frost-hubert) | FROST DKG and signing using Hubert as the distributed substrate. Implements threshold signatures with distributed key generation for secure multiparty cryptographic operations. [📖 Docs](https://docs.bcts.dev/api/frost-hubert) \| [🦀 Rust](https://github.com/BlockchainCommons/frost-hubert-rust) |
| [**gstp**](packages/gstp) | Gordian Sealed Transaction Protocol - a secure, authenticated, transport-agnostic data exchange protocol with distributed state management via Encrypted State Continuations (ESC). [📖 Docs](https://docs.bcts.dev/api/gstp) \| [🦀 Rust](https://github.com/BlockchainCommons/gstp-rust) |
| [**hubert**](packages/hubert) | Hubert - Distributed infrastructure for secure multiparty transactions using Gordian Envelope. Supports IPFS, Mainline DHT, server, and hybrid storage modes. [📖 Docs](https://docs.bcts.dev/api/hubert) \| [🦀 Rust](https://github.com/BlockchainCommons/hubert-rust) |
| [**known-values**](packages/known-values) | Known Values - compact, deterministic identifiers for ontological concepts. More efficient than URIs for representing predicates and relationships. [📖 Docs](https://docs.bcts.dev/api/known-values) \| [🦀 Rust](https://github.com/BlockchainCommons/known-values-rust) |
| [**lifehash**](packages/lifehash) | LifeHash - visual hash algorithm that generates beautiful, deterministic icons from data using cellular automata. Useful for visual verification of cryptographic hashes and identities. [📖 Docs](https://docs.bcts.dev/api/lifehash) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-lifehash) |
| [**provenance-mark**](packages/provenance-mark) | Provenance Marks - cryptographically-secured system for establishing authenticity and provenance of digital works. Generates verifiable mark chains with configurable resolution levels. [📖 Docs](https://docs.bcts.dev/api/provenance-mark) \| [🦀 Rust](https://github.com/BlockchainCommons/provenance-mark-rust) |
| [**rand**](packages/rand) | Cryptographically secure random number generation utilities. Provides a consistent interface for random operations across all packages. [📖 Docs](https://docs.bcts.dev/api/rand) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-rand-rust) |
| [**shamir**](packages/shamir) | Shamir's Secret Sharing - split secrets into shares where any threshold can reconstruct the original. Implements GF(256) arithmetic for secure secret splitting. [📖 Docs](https://docs.bcts.dev/api/shamir) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-shamir-rust) |
| [**sskr**](packages/sskr) | Sharded Secret Key Reconstruction (SSKR) - hierarchical secret sharing with groups and thresholds. Encodes shares in Bytewords for human-friendly backup. [📖 Docs](https://docs.bcts.dev/api/sskr) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-sskr-rust) |
| [**tags**](packages/tags) | CBOR tag registry for Blockchain Commons specifications. Provides type-safe tag definitions for use across all packages. [📖 Docs](https://docs.bcts.dev/api/tags) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-tags-rust) |
| [**uniform-resources**](packages/uniform-resources) | Uniform Resources (UR) - a method for encoding binary data as URIs for transport in QR codes and other text-based channels. Includes Bytewords encoding and fountain codes for multi-part transmission. [📖 Docs](https://docs.bcts.dev/api/uniform-resources) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-ur-rust) |
| [**xid**](packages/xid) | Extensible Identifiers (XID) - decentralized digital identity documents supporting keys, delegates, services, and provenance. Enables self-sovereign identity management with cryptographic verification. [📖 Docs](https://docs.bcts.dev/api/xid) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-xid-rust) |

## 📡 Signal Protocol

| Package | Description |
|---------|-------------|
| [**double-ratchet**](packages/double-ratchet) | Signal Protocol Double Ratchet implementation — X3DH key agreement, session management, group messaging (Sender Keys), sealed sender, and incremental MAC. [📖 Docs](https://docs.bcts.dev/api/double-ratchet) \| [🦀 Rust](https://github.com/signalapp/libsignal/tree/main/rust) |
| [**spqr**](packages/spqr) | Signal's Sparse Post-Quantum Ratchet (SPQR) — ML-KEM based post-quantum key encapsulation with erasure coding for ratchet upgrades. [📖 Docs](https://docs.bcts.dev/api/spqr) \| [🦀 Rust](https://github.com/signalapp/SparsePostQuantumRatchet) |
| [**triple-ratchet**](packages/triple-ratchet) | Triple Ratchet protocol — extends the Double Ratchet with SPQR post-quantum ratchet steps for quantum-resistant end-to-end encryption. [📖 Docs](https://docs.bcts.dev/api/triple-ratchet) \| [🦀 Rust](https://github.com/signalapp/libsignal/tree/main/rust) |

## 💻 CLI Tools

| CLI                                                  | Description |
|------------------------------------------------------|-------------|
| [**dcbor-cli**](tools/dcbor-cli)                     | Command-line tool for working with dCBOR data. Parse, encode, and convert between hex, diagnostic notation, and other formats. [📖 Docs](https://docs.bcts.dev/api/dcbor-cli) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-rust) |
| [**envelope-cli**](tools/envelope-cli)               | Command-line tool for creating and manipulating Gordian Envelopes. Supports encryption, signing, elision, and format conversion. [📖 Docs](https://docs.bcts.dev/api/envelope-cli) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-envelope-cli-rust) |
| [**lifehash-cli**](tools/lifehash-cli)               | Command-line tool for generating LifeHash visual hash images as PNG files. Create deterministic icons from any input data. [📖 Docs](https://docs.bcts.dev/api/lifehash-cli) \| [🦀 Rust](https://github.com/BlockchainCommons/lifehash-cli) |
| [**provenance-mark-cli**](tools/provenance-mark-cli) | Command-line tool for generating and verifying Provenance Marks. Create mark chains for establishing authenticity of digital works. [📖 Docs](https://docs.bcts.dev/api/provenance-mark-cli) \| [🦀 Rust](https://github.com/BlockchainCommons/provenance-mark-cli-rust) |
| [**seedtool-cli**](tools/seedtool-cli)               | Command-line tool for generating and managing cryptographic seeds. Supports multiple output formats including hex, Bytewords, SSKR shares, and Gordian Envelope. [📖 Docs](https://docs.bcts.dev/api/seedtool-cli) \| [🦀 Rust](https://github.com/BlockchainCommons/seedtool-cli-rust) |

## 👥 Credits

This TypeScript implementation is a direct port from the work of [@ChristopherA](https://github.com/ChristopherA), [@WolfMcNally](https://github.com/wolfmcnally) and [@shannona](https://github.com/shannona).

Consider visiting [Blockchain Commons](https://www.blockchaincommons.com/) to learn more about the organization and their mission.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 🔐 Security Disclosure

Found a vulnerability? We'd really appreciate you letting us know privately at **security@parity.io** - please avoid opening public issues for security concerns.

## 📄 License

This project is licensed under the BSD-2-Clause-Patent License - see the [LICENSE](./LICENSE) file for details.
