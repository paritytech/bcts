# Blockchain Commons Crypto Interfaces for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/crypto` exposes a uniform API for the cryptographic primitives used in higher-level [Blockchain Commons](https://blockchaincommons.com) projects such as Gordian Envelope.

## Features

- **Hash Functions**: SHA-256, SHA-512, HMAC, PBKDF2, HKDF, CRC32
- **Symmetric Encryption**: ChaCha20-Poly1305 AEAD
- **Public Key Cryptography**:
  - X25519 (key agreement)
  - ECDSA (secp256k1 signing/verification)
  - Schnorr signatures (BIP-340)
  - Ed25519 (signing/verification)
- **Key Derivation**: Scrypt, Argon2id
- **Memory Security**: Best-effort memory zeroing utilities

## Security Considerations

### Memory Zeroing (`memzero`)

⚠️ **IMPORTANT SECURITY LIMITATION**

The `memzero()` function provides **best-effort** memory clearing in JavaScript/TypeScript, but **cannot guarantee** that sensitive data is fully erased from memory.

**Why this limitation exists:**

- JavaScript/TypeScript lacks volatile memory writes (unlike the Rust reference implementation which uses `std::ptr::write_volatile()`)
- JavaScript engines and JIT compilers may optimize away zeroing operations
- The garbage collector may have made copies of sensitive data
- Swapped pages or memory dumps may contain copies

**What `memzero()` does:**

- ✅ Overwrites memory with zeros to reduce exposure time
- ✅ Makes a verification check to prevent some optimizations
- ❌ Cannot guarantee complete erasure from physical memory

**Best practices for sensitive operations:**

1. **Use Web Crypto API when possible**: For truly sensitive cryptographic operations, use `crypto.subtle` with non-extractable keys
2. **Minimize exposure time**: Call `memzero()` immediately after sensitive operations
3. **Understand the limitations**: This is defense-in-depth, not a security guarantee
4. **Consider your threat model**: Evaluate if JavaScript is appropriate for your security requirements

**Example:**

```typescript
import { memzero } from '@bcts/crypto';

const sensitiveKey = new Uint8Array(32);
// ... use the key ...

// Clear from memory (best effort)
memzero(sensitiveKey);
```

For more details, see the [implementation comments](./src/memzero.ts).

## Rust Reference Implementation

This TypeScript implementation is based on [bc-crypto-rust](https://github.com/BlockchainCommons/bc-crypto-rust) **v0.14.0** ([commit](https://github.com/BlockchainCommons/bc-crypto-rust/tree/4f2b791320730578b04943c833c4a9e6c232fc4d)).
