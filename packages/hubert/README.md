# Hubert - Distributed Infrastructure for Secure Multiparty Transactions

> Disclaimer: This package is under active development and APIs may change.

## Introduction

Hubert provides distributed infrastructure for secure multiparty transactions, designed to support FROST threshold signature protocols. It enables distributed key-value storage using ARID (Apparently Random Identifier) addressing with multiple storage backends.

**Key Features:**
- **ARID-based Addressing**: Cryptographic identifiers that appear random but are deterministically derived
- **Multiple Storage Backends**: Mainline DHT, IPFS, Hybrid (DHT+IPFS), and Server modes
- **Write-once Semantics**: Content-addressed storage that cannot be modified once written
- **Data Obfuscation**: ChaCha20 encryption using ARID-derived keys
- **Gordian Envelope**: All data is stored as Gordian Envelope structures

## Rust Reference Implementation

This TypeScript implementation is based on [hubert-rust](https://github.com/BlockchainCommons/hubert-rust) **v0.5.0** ([commit](https://github.com/BlockchainCommons/hubert-rust/tree/main)).
