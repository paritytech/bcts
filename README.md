# Blockchain Commons - TypeScript

A comprehensive TypeScript monorepo implementing Blockchain Commons specifications for cryptographic data encoding, privacy-preserving envelopes, and secure information structures.

This repository contains TypeScript implementations of specifications developed by [Blockchain Commons](https://www.blockchaincommons.com/), a research and development cooperative of blockchain and digital asset developers.

## 📦 Packages

### Core Libraries

| Package | Description | Version |
|---------|-------------|---------|
| [**dcbor**](packages/dcbor) | Deterministic CBOR encoding - a specification for serializing data in a canonical, reproducible format. Ensures identical byte sequences for cryptographic operations and blockchain applications. [📖 API Docs](https://leonardocustodio.github.io/bc-dcbor-ts/) | `1.0.0-alpha.1` |
| [**envelope**](packages/envelope) | Gordian Envelope - privacy-preserving data structures with encryption, elision (selective redaction), and cryptographic signatures. Includes prelude submodule for advanced operations. | `1.0.0-alpha.1` |

## 🎮 Applications

### [Playground](apps/playground)
An interactive web application for experimenting with dCBOR encoding, Envelope creation, and cryptographic operations.

**Live Demo:** https://leonardocustodio.github.io/blockchain-commons

**Try it locally:**
```bash
bun dev
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- [Bun](https://bun.sh/) (>=1.2.22) - Package manager and runtime

### Installation

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run development servers
bun run dev

# Run linting
bun run lint

# Type checking
bun run check-types
```

## 📚 Specifications & Reference Implementations

This project implements open specifications maintained by Blockchain Commons:

- **[Deterministic CBOR (dCBOR)](https://github.com/BlockchainCommons/bc-dcbor-rust)** - A deterministic binary encoding format based on CBOR (RFC 7049)
- **[Gordian Envelope](https://github.com/BlockchainCommons/bc-envelope-rust)** - A privacy-preserving data structure specification with encryption, elision, and signature support

For complete specifications and reference implementations in other languages, visit:
- [Blockchain Commons GitHub](https://github.com/BlockchainCommons)
- [Blockchain Commons Documentation](https://www.blockchaincommons.com/)
