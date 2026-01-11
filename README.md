# Blockchain Commons - TypeScript

[![Version](https://img.shields.io/badge/version-1.0.0--alpha.14-green)](https://github.com/leonardocustodio/bcts/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Monorepo](https://img.shields.io/badge/Monorepo-Turborepo-blueviolet)](https://turbo.build/)
[![Package Manager](https://img.shields.io/badge/Package%20Manager-Bun-FFD700)](https://bun.sh/)
[![Status](https://img.shields.io/badge/Status-Early%20Development-orange)](#-disclaimer)

🔷 **Community Implementation:** This is an independent TypeScript monorepo implementing Blockchain Commons' open specifications and implementations. It is **not an official** Blockchain Commons repository.

> 🚧 **Disclaimer:** This repository is in early development stages. APIs and interfaces are subject to change.

## Overview

This monorepo provides TypeScript implementations of Blockchain Commons specifications, including deterministic CBOR encoding, Gordian Envelope, Uniform Resources (URs), Sharded Secret Key Reconstruction (SSKR), and other cryptographic standards. All implementations follow the Rust reference implementations as the source of truth and maintain compatibility with the official specifications.

## 📚 Resources

- [CBOR Book](https://cborbook.com/) - Comprehensive guide to CBOR, dCBOR and Gordian Envelope
- [BC YouTube Channel](https://www.youtube.com/@blockchaincommons) - A YouTube channel with many lectures and tutorials
- [BC Developer Docs](https://developer.blockchaincommons.com/) - BC's developer documentation
- [JSON vs CBOR](https://hackmd.io/@leonardocustodio/json-vs-cbor) - Comparison of JSON and CBOR formats
- [Deterministic Data: Intro to dCBOR](https://hackmd.io/@leonardocustodio/deterministic-data-intro-to-dcbor) - Introduction to deterministic CBOR

## 📦 Packages

| Package | Description |
|---------|-------------|
| [**components**](packages/components) | Shared component utilities and helpers for the Blockchain Commons ecosystem. [📖 Docs](https://docs.bcts.dev/api/components) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-components-rust) |
| [**crypto**](packages/crypto) | Cryptographic primitives including symmetric encryption (ChaCha20-Poly1305), hashing (SHA-256, BLAKE3), and key derivation (HKDF, PBKDF2). [📖 Docs](https://docs.bcts.dev/api/crypto) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-crypto-rust) |
| [**dcbor**](packages/dcbor) | Deterministic CBOR encoding - a specification for serializing data in a canonical, reproducible format. Ensures identical byte sequences for cryptographic operations and blockchain applications. [📖 Docs](https://docs.bcts.dev/api/dcbor) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-rust) |
| [**dcbor-parse**](packages/dcbor-parse) | dCBOR Diagnostic Parser - parse and compose CBOR diagnostic notation into dCBOR data items. Supports booleans, numbers, strings, byte strings (hex/base64), tagged values, arrays, maps, URs, known values, and date literals. [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-parse-rust) |
| [**dcbor-pattern**](packages/dcbor-pattern) | Pattern matching for dCBOR - a powerful query language for matching and extracting data from dCBOR structures. Supports value, structure, and meta patterns with named captures and VM-based execution. [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-pattern-rust) |
| [**envelope**](packages/envelope) | Gordian Envelope - structured, privacy-focused data containers for secure information exchange. Supports encryption, elision, and cryptographic assertions. [📖 Docs](https://docs.bcts.dev/api/envelope) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-envelope-rust) |
| [**envelope-pattern**](packages/envelope-pattern) | Pattern matching for Gordian Envelope - query and extract data from Envelope structures. Supports leaf, structure, and meta patterns with subject/predicate/object matching and tree traversal. [🦀 Rust](https://github.com/BlockchainCommons/bc-envelope-pattern-rust) |
| [**gstp**](packages/gstp) | Gordian Sealed Transaction Protocol - a secure, authenticated, transport-agnostic data exchange protocol with distributed state management via Encrypted State Continuations (ESC). [📖 Docs](https://docs.bcts.dev/api/gstp) |
| [**known-values**](packages/known-values) | Known Values - compact, deterministic identifiers for ontological concepts. More efficient than URIs for representing predicates and relationships. [📖 Docs](https://docs.bcts.dev/api/known-values) \| [🦀 Rust](https://github.com/BlockchainCommons/known-values-rust) |
| [**provenance-mark**](packages/provenance-mark) | Provenance Marks - cryptographically-secured system for establishing authenticity and provenance of digital works. Generates verifiable mark chains with configurable resolution levels. [📖 Docs](https://docs.bcts.dev/api/provenance-mark) \| [🦀 Rust](https://github.com/BlockchainCommons/provenance-mark-rust) |
| [**rand**](packages/rand) | Cryptographically secure random number generation utilities. Provides a consistent interface for random operations across all packages. [📖 Docs](https://docs.bcts.dev/api/rand) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-rand-rust) |
| [**shamir**](packages/shamir) | Shamir's Secret Sharing - split secrets into shares where any threshold can reconstruct the original. Implements GF(256) arithmetic for secure secret splitting. [📖 Docs](https://docs.bcts.dev/api/shamir) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-shamir-rust) |
| [**sskr**](packages/sskr) | Sharded Secret Key Reconstruction (SSKR) - hierarchical secret sharing with groups and thresholds. Encodes shares in Bytewords for human-friendly backup. [📖 Docs](https://docs.bcts.dev/api/sskr) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-sskr-rust) |
| [**tags**](packages/tags) | CBOR tag registry for Blockchain Commons specifications. Provides type-safe tag definitions for use across all packages. [📖 Docs](https://docs.bcts.dev/api/tags) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-tags-rust) |
| [**uniform-resources**](packages/uniform-resources) | Uniform Resources (UR) - a method for encoding binary data as URIs for transport in QR codes and other text-based channels. Includes Bytewords encoding and fountain codes for multi-part transmission. [📖 Docs](https://docs.bcts.dev/api/uniform-resources) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-ur-rust) |
| [**xid**](packages/xid) | Extensible Identifiers (XID) - decentralized digital identity documents supporting keys, delegates, services, and provenance. Enables self-sovereign identity management with cryptographic verification. [📖 Docs](https://docs.bcts.dev/api/xid) \| [🦀 Rust](https://github.com/BlockchainCommons/bc-xid-rust) |

## 💻 CLI Tools

| CLI                                                  | Description |
|------------------------------------------------------|-------------|
| [**dcbor-cli**](tools/dcbor-cli)                     | Command-line tool for working with dCBOR data. Parse, encode, and convert between hex, diagnostic notation, and other formats. [🦀 Rust](https://github.com/BlockchainCommons/bc-dcbor-rust) |
| [**envelope-cli**](tools/envelope-cli)               | Command-line tool for creating and manipulating Gordian Envelopes. Supports encryption, signing, elision, and format conversion. [🦀 Rust](https://github.com/BlockchainCommons/bc-envelope-cli-rust) |
| [**provenance-mark-cli**](tools/provenance-mark-cli) | Command-line tool for generating and verifying Provenance Marks. Create mark chains for establishing authenticity of digital works. [🦀 Rust](https://github.com/BlockchainCommons/provenance-mark-cli-rust) |
| [**seedtool-cli**](tools/seedtool-cli)               | Command-line tool for generating and managing cryptographic seeds. Supports multiple output formats including hex, Bytewords, SSKR shares, and Gordian Envelope. [🦀 Rust](https://github.com/BlockchainCommons/seedtool-cli-rust) |

## 🎮 Applications

### [Examples](apps/examples)

A collection of runnable TypeScript examples demonstrating the capabilities of this library.

### [Playground](apps/playground)
An interactive web application for experimenting with dCBOR encoding, Uniform Resources decoding, and Gordian Envelope visualization.

**Features:**
- Parse and visualize dCBOR data with annotated hex and diagnostic notation
- Decode Uniform Resources (UR) with support for envelope URs
- View Gordian Envelope tree format
- Convert between hex, UR, and Bytewords formats
- Live examples and interactive editing

**Try it locally:**
```bash
bun playground
```

**Live Demo:** https://bcts.dev

## 👥 Credits

This TypeScript implementation is a direct port from the work of [@ChristopherA](https://github.com/ChristopherA) and [@WolfMcNally](https://github.com/wolfmcnally).

Consider visiting [Blockchain Commons](https://www.blockchaincommons.com/) to learn more about the organization and their mission.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the BSD-2-Clause-Patent License – see the [LICENSE](./LICENSE) file for details.
