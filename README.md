# Blockchain Commons - TypeScript

> Disclaimer: This whole repository is still in its early stages and under heavy development. Please note that the APIs and interfaces are subject to change and are not yet stable.

A comprehensive TypeScript monorepo implementing [Blockchain Commons](https://www.blockchaincommons.com/) specifications for cryptographic data encoding, uniform resources, and secure information structures.

## 📦 Packages

### Core Libraries

| Package | Description | Version | Reference |
|---------|-------------|---------|-----------|
| [**dcbor**](packages/dcbor) | Deterministic CBOR encoding - a specification for serializing data in a canonical, reproducible format. Ensures identical byte sequences for cryptographic operations and blockchain applications. [📖 API Docs](https://dcbor.custodio.me/docs/dcbor) | `1.0.0-alpha.4` | [bc-dcbor-rust](https://github.com/BlockchainCommons/bc-dcbor-rust) |
| [**envelope**](packages/envelope) | Gordian Envelope - structured, privacy-focused data containers for secure information exchange. Supports encryption, elision, and cryptographic assertions. [📖 API Docs](https://dcbor.custodio.me/docs/envelope) | `1.0.0-alpha.4` | [bc-envelope-rust](https://github.com/BlockchainCommons/bc-envelope-rust) |
| [**uniform-resources**](packages/uniform-resources) | Uniform Resources (UR) - a method for encoding binary data as URIs for transport in QR codes and other text-based channels. Includes Bytewords encoding and fountain codes for multi-part transmission. [📖 API Docs](https://dcbor.custodio.me/docs/uniform-resources) | `1.0.0-alpha.4` | [bc-ur-rust](https://github.com/BlockchainCommons/bc-ur-rust) |
| [**tags**](packages/tags) | CBOR tag registry for Blockchain Commons specifications. Provides type-safe tag definitions for use across all packages. [📖 API Docs](https://dcbor.custodio.me/docs/tags) | `1.0.0-alpha.4` | [bc-tags-rust](https://github.com/BlockchainCommons/bc-tags-rust) |
| [**known-values**](packages/known-values) | Known Values - compact, deterministic identifiers for ontological concepts. More efficient than URIs for representing predicates and relationships. [📖 API Docs](https://dcbor.custodio.me/docs/known-values) | `1.0.0-alpha.4` | [known-values-rust](https://github.com/BlockchainCommons/known-values-rust) |
| [**rand**](packages/rand) | Cryptographically secure random number generation utilities. Provides a consistent interface for random operations across all packages. [📖 API Docs](https://dcbor.custodio.me/docs/rand) | `1.0.0-alpha.4` | [bc-rand-rust](https://github.com/BlockchainCommons/bc-rand-rust) |
|| [**crypto**](packages/crypto) | Cryptographic primitives including symmetric encryption (ChaCha20-Poly1305), hashing (SHA-256, BLAKE3), and key derivation (HKDF, PBKDF2). [📖 API Docs](https://dcbor.custodio.me/docs/crypto) | `1.0.0-alpha.4` | [bc-crypto-rust](https://github.com/BlockchainCommons/bc-crypto-rust) |
| [**components**](packages/components) | Shared component utilities and helpers for the Blockchain Commons ecosystem. [📖 API Docs](https://dcbor.custodio.me/docs/components) | `1.0.0-alpha.4` | [bc-components-rust](https://github.com/BlockchainCommons/bc-components-rust) |
|| [**shamir**](packages/shamir) | Shamir's Secret Sharing - split secrets into shares where any threshold can reconstruct the original. Implements GF(256) arithmetic for secure secret splitting. [📖 API Docs](https://dcbor.custodio.me/docs/shamir) | `1.0.0-alpha.4` | [bc-shamir-rust](https://github.com/BlockchainCommons/bc-shamir-rust) |
|| [**sskr**](packages/sskr) | Sharded Secret Key Reconstruction (SSKR) - hierarchical secret sharing with groups and thresholds. Encodes shares in Bytewords for human-friendly backup. [📖 API Docs](https://dcbor.custodio.me/docs/sskr) | `1.0.0-alpha.4` | [bc-sskr-rust](https://github.com/BlockchainCommons/bc-sskr-rust) |
|| [**provenance-mark**](packages/provenance-mark) | Provenance Marks - cryptographically-secured system for establishing authenticity and provenance of digital works. Generates verifiable mark chains with configurable resolution levels. [📖 API Docs](https://dcbor.custodio.me/docs/provenance-mark) | `1.0.0-alpha.4` | [provenance-mark-rust](https://github.com/BlockchainCommons/provenance-mark-rust) |
|| [**xid**](packages/xid) | Extensible Identifiers (XID) - decentralized digital identity documents supporting keys, delegates, services, and provenance. Enables self-sovereign identity management with cryptographic verification. [📖 API Docs](https://dcbor.custodio.me/docs/xid) | `1.0.0-alpha.4` | [bc-xid-rust](https://github.com/BlockchainCommons/bc-xid-rust) |

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
bun run test --filter=@blockchain-commons/dcbor
```

## 📚 Specifications & Reference Implementations

This TypeScript implementation follows the Rust reference implementations as the source of truth:

- **[Deterministic CBOR (dCBOR)](https://github.com/BlockchainCommons/bc-dcbor-rust)** - A deterministic binary encoding format based on CBOR (RFC 8949)
- **[CBOR Tags](https://github.com/BlockchainCommons/bc-tags-rust)** - Registry of CBOR tags for Blockchain Commons
- **[Known Values](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-002-known-value.md)** - Compact ontological identifiers (BCR-2023-002)
- **[Uniform Resources (UR)](https://github.com/BlockchainCommons/bc-ur-rust)** - Binary data encoding optimized for QR codes and URIs (BCR-2020-005)
- **[Gordian Envelope](https://github.com/BlockchainCommons/bc-envelope-rust)** - Privacy-focused structured data containers with support for encryption, elision, and signatures
- **[Shamir's Secret Sharing](https://github.com/BlockchainCommons/bc-shamir-rust)** - Split secrets into shares with threshold reconstruction
- **[SSKR](https://github.com/BlockchainCommons/bc-sskr-rust)** - Sharded Secret Key Reconstruction with hierarchical groups (BCR-2020-011)
- **[Provenance Mark](https://github.com/BlockchainCommons/provenance-mark-rust)** - Cryptographic provenance marks for digital authenticity
- **[XID](https://github.com/BlockchainCommons/bc-xid-rust)** - Extensible Identifiers for decentralized digital identity

For complete specifications and reference implementations in other languages, visit:
- [BlockchainCommons GitHub](https://github.com/BlockchainCommons)
- [BlockchainCommons Documentation](https://www.blockchaincommons.com/)
- [Research Papers](https://github.com/BlockchainCommons/Research)
