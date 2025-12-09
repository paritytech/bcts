# Blockchain Commons - TypeScript

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Monorepo](https://img.shields.io/badge/Monorepo-Turborepo-blueviolet)](https://turbo.build/)
[![Package Manager](https://img.shields.io/badge/Package%20Manager-Bun-FFD700)](https://bun.sh/)
[![Status](https://img.shields.io/badge/Status-Early%20Development-orange)](#-disclaimer)

🔷 **Community Implementation:** This is an independent TypeScript monorepo implementing [Blockchain Commons](https://www.blockchaincommons.com/) open specifications. It is **not an official** Blockchain Commons repository.

> 🚧 **Disclaimer:** This repository is in early development stages. APIs and interfaces are subject to change and are not yet stable.

## Overview

This monorepo provides TypeScript implementations of Blockchain Commons specifications including deterministic CBOR encoding, Gordian Envelope, Uniform Resources (URs), Sharded Secret Key Reconstruction (SSKR), and other cryptographic standards. All implementations follow the Rust reference implementations as the source of truth and maintain compatibility with the official specifications.

## 📦 Packages

### Core Libraries

| Package | Description | Version | Reference |
|---------|-------------|---------|-----------|
| [**components**](packages/components) | Shared component utilities and helpers for the Blockchain Commons ecosystem. [📖 API Docs](https://dcbor.custodio.me/docs/components) | `1.0.0-alpha.5` | [bc-components-rust](https://github.com/BlockchainCommons/bc-components-rust) |
| [**crypto**](packages/crypto) | Cryptographic primitives including symmetric encryption (ChaCha20-Poly1305), hashing (SHA-256, BLAKE3), and key derivation (HKDF, PBKDF2). [📖 API Docs](https://dcbor.custodio.me/docs/crypto) | `1.0.0-alpha.5` | [bc-crypto-rust](https://github.com/BlockchainCommons/bc-crypto-rust) |
| [**dcbor**](packages/dcbor) | Deterministic CBOR encoding - a specification for serializing data in a canonical, reproducible format. Ensures identical byte sequences for cryptographic operations and blockchain applications. [📖 API Docs](https://dcbor.custodio.me/docs/dcbor) | `1.0.0-alpha.5` | [bc-dcbor-rust](https://github.com/BlockchainCommons/bc-dcbor-rust) |
| [**envelope**](packages/envelope) | Gordian Envelope - structured, privacy-focused data containers for secure information exchange. Supports encryption, elision, and cryptographic assertions. [📖 API Docs](https://dcbor.custodio.me/docs/envelope) | `1.0.0-alpha.5` | [bc-envelope-rust](https://github.com/BlockchainCommons/bc-envelope-rust) |
| [**known-values**](packages/known-values) | Known Values - compact, deterministic identifiers for ontological concepts. More efficient than URIs for representing predicates and relationships. [📖 API Docs](https://dcbor.custodio.me/docs/known-values) | `1.0.0-alpha.5` | [known-values-rust](https://github.com/BlockchainCommons/known-values-rust) |
| [**provenance-mark**](packages/provenance-mark) | Provenance Marks - cryptographically-secured system for establishing authenticity and provenance of digital works. Generates verifiable mark chains with configurable resolution levels. [📖 API Docs](https://dcbor.custodio.me/docs/provenance-mark) | `1.0.0-alpha.5` | [provenance-mark-rust](https://github.com/BlockchainCommons/provenance-mark-rust) |
| [**rand**](packages/rand) | Cryptographically secure random number generation utilities. Provides a consistent interface for random operations across all packages. [📖 API Docs](https://dcbor.custodio.me/docs/rand) | `1.0.0-alpha.5` | [bc-rand-rust](https://github.com/BlockchainCommons/bc-rand-rust) |
| [**shamir**](packages/shamir) | Shamir's Secret Sharing - split secrets into shares where any threshold can reconstruct the original. Implements GF(256) arithmetic for secure secret splitting. [📖 API Docs](https://dcbor.custodio.me/docs/shamir) | `1.0.0-alpha.5` | [bc-shamir-rust](https://github.com/BlockchainCommons/bc-shamir-rust) |
| [**sskr**](packages/sskr) | Sharded Secret Key Reconstruction (SSKR) - hierarchical secret sharing with groups and thresholds. Encodes shares in Bytewords for human-friendly backup. [📖 API Docs](https://dcbor.custodio.me/docs/sskr) | `1.0.0-alpha.5` | [bc-sskr-rust](https://github.com/BlockchainCommons/bc-sskr-rust) |
| [**tags**](packages/tags) | CBOR tag registry for Blockchain Commons specifications. Provides type-safe tag definitions for use across all packages. [📖 API Docs](https://dcbor.custodio.me/docs/tags) | `1.0.0-alpha.5` | [bc-tags-rust](https://github.com/BlockchainCommons/bc-tags-rust) |
| [**uniform-resources**](packages/uniform-resources) | Uniform Resources (UR) - a method for encoding binary data as URIs for transport in QR codes and other text-based channels. Includes Bytewords encoding and fountain codes for multi-part transmission. [📖 API Docs](https://dcbor.custodio.me/docs/uniform-resources) | `1.0.0-alpha.5` | [bc-ur-rust](https://github.com/BlockchainCommons/bc-ur-rust) |
| [**xid**](packages/xid) | Extensible Identifiers (XID) - decentralized digital identity documents supporting keys, delegates, services, and provenance. Enables self-sovereign identity management with cryptographic verification. [📖 API Docs](https://dcbor.custodio.me/docs/xid) | `1.0.0-alpha.5` | [bc-xid-rust](https://github.com/BlockchainCommons/bc-xid-rust) |

## 🎮 Applications

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

**Live Demo:** https://dcbor.custodio.me

## 🛠️ Development

This is a monorepo managed with Turborepo. Common commands:

```bash
# Build all packages
bun run build
# Run tests across all packages
bun run test
# Lint all packages
bun run lint
# Format code
bun run format
# Run tests for a specific package
bun run test --filter=@bcts/dcbor
```

## 📚 Specifications

Each package implements specifications from Blockchain Commons. The specifications are the source of truth:

| Specification | Link | BCR |
|---|---|---|
| **Deterministic CBOR (dCBOR)** | [IETF Internet Draft](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/) | Based on RFC-8949 |
| **Known Values** | [BCR-2023-002](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-002-known-value.md) | Compact ontological identifiers |
| **Uniform Resources (UR)** | [BCR-2020-005](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md) | Binary data encoding for QR codes |
| **Gordian Envelope** | [IETF Internet Draft](https://datatracker.ietf.org/doc/draft-mcnally-envelope/) | Privacy-focused data structures |
| **Shamir's Secret Sharing** | [BCR-2020-011 (SSKR)](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-011-sskr.md) | Secret sharing with threshold reconstruction |
| **SSKR (Sharded Secret Key Reconstruction)** | [BCR-2020-011](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-011-sskr.md) | Hierarchical secret sharing with groups |
| **Provenance Marks** | [White Paper](https://provemark.com) | Cryptographic authenticity marks |
| **XIDs (Extensible Identifiers)** | [Design Paper](https://hackmd.io/@bc-community/SkdxVyY11g) | Decentralized digital identity |

## 👥 Credits

This TypeScript implementation is a direct port from the work of [@ChristopherA](https://github.com/ChristopherA) and [@WolfMcNally](https://github.com/wolfmcnally).

Consider visiting [Blockchain Commons](https://www.blockchaincommons.com/) to learn more about the organization and their mission.
