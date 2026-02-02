# Blockchain Commons FROST Hubert for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

FROST Hubert implements FROST (Flexible Round-Optimized Schnorr Threshold) signatures using Hubert as the distributed substrate. It enables threshold signing operations where a configurable subset of participants can collaboratively sign messages without any single party having access to the complete private key.

Key features:

- **Distributed Key Generation (DKG)**: Securely generate threshold signing keys across multiple participants
- **Threshold Signing**: Create valid signatures with only t-of-n participants
- **Ed25519 Signatures**: Uses the FROST-ED25519-SHA512-v1 ciphersuite
- **Hubert Integration**: Built on top of the Hubert distributed storage protocol

## Security Considerations

> ⚠️ **WARNING: NOT PRODUCTION READY**
>
> This package is intended for **testing and experimentation purposes only**.

Unlike other `@bcts` packages that use audited cryptographic libraries from the [@noble](https://paulmillr.com/noble/) family, this package relies on:

- `@frosts/core` - FROST protocol implementation
- `@frosts/ed25519` - Ed25519 ciphersuite for FROST

The `@noble` libraries were not used because they are intentionally minimal implementations focused on core cryptographic primitives. FROST threshold signatures require additional functionality (Distributed Key Generation, threshold signing coordination, secret sharing schemes) that is beyond the scope of `@noble`.

**These `@frosts` packages are unaudited** and have not undergone the same level of security review as the `@noble` libraries. Do not use this package in production environments or for securing real assets.

For more details, see the [frosTS](https://github.com/leonardocustodio/frosts).

## Rust Reference Implementation

This TypeScript implementation is based on [frost-hubert-rust](https://github.com/BlockchainCommons/frost-hubert-rust) **v0.1.0** ([commit](https://github.com/BlockchainCommons/frost-hubert-rust/tree/d04850aea6d84f751920a86f867ca7d0defdad7e)).
