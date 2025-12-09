# Components Package Refactoring Plan

## Overview

This document outlines the plan to refactor `@blockchain-commons/components` to achieve a 1:1 port of `bc-components-rust`.

## Current State Analysis

### Rust Implementation (bc-components-rust)
- **Total Files:** ~78 source files
- **Total Lines:** ~17,050 lines
- **Modules:** 15+ major modules

### TypeScript Implementation (@blockchain-commons/components)
- **Total Files:** 20 source files
- **Total Lines:** ~2,050 lines
- **Coverage:** ~12% of Rust implementation

---

## File-by-File Comparison

### Legend
- ✅ Implemented (full parity)
- ⚠️ Partial implementation
- ❌ Missing

---

## Module: Root Level

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `lib.rs` | `index.ts` | ⚠️ | Partial exports |
| `error.rs` | `error.ts` | ⚠️ | Basic error types |
| `digest.rs` | `digest.ts` | ⚠️ | Missing CBOR/UR serialization |
| `digest_provider.rs` | - | ❌ | DigestProvider trait |
| `nonce.rs` | `nonce.ts` | ⚠️ | Missing CBOR/UR serialization |
| `salt.rs` | `salt.ts` | ⚠️ | Missing CBOR/UR serialization |
| `seed.rs` | `seed.ts` | ⚠️ | Missing CBOR/UR serialization |
| `compressed.rs` | - | ❌ | Compressed data type |
| `json.rs` | - | ❌ | JSON wrapper type |
| `reference.rs` | `reference.ts` | ⚠️ | Partial implementation |
| `hkdf_rng.rs` | - | ❌ | HKDF-based RNG |
| `encrypter.rs` | - | ❌ | Encrypter/Decrypter traits |
| `private_key_base.rs` | - | ❌ | PrivateKeyBase type |
| `private_key_data_provider.rs` | - | ❌ | Provider trait |
| `private_keys.rs` | - | ❌ | PrivateKeys container |
| `public_keys.rs` | - | ❌ | PublicKeys container |
| `keypair.rs` | - | ❌ | Keypair utilities |
| `tags_registry.rs` | - | ❌ | CBOR tags registration |
| `sskr_mod.rs` | - | ❌ | SSKR integration |

---

## Module: id/ (Identifiers)

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `id/mod.rs` | - | ❌ | Module definition |
| `id/arid.rs` | `arid.ts` | ⚠️ | Missing CBOR/UR |
| `id/uri.rs` | `uri.ts` | ⚠️ | Missing CBOR/UR |
| `id/uuid.rs` | `uuid.ts` | ⚠️ | Missing CBOR/UR |
| `id/xid.rs` | `xid.ts` | ⚠️ | Partial, missing XIDProvider |

---

## Module: symmetric/ (Symmetric Encryption)

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `symmetric/mod.rs` | - | ❌ | Module definition + tests |
| `symmetric/symmetric_key.rs` | `symmetric-key.ts` | ⚠️ | Missing encrypt/decrypt |
| `symmetric/authentication_tag.rs` | `authentication-tag.ts` | ⚠️ | Basic only |
| `symmetric/encrypted_message.rs` | `encrypted-message.ts` | ⚠️ | Missing CBOR/UR |

---

## Module: signing/ (Digital Signatures)

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `signing/mod.rs` | - | ❌ | Full module + tests |
| `signing/signature.rs` | - | ❌ | Signature type |
| `signing/signature_scheme.rs` | - | ❌ | SignatureScheme enum |
| `signing/signing_private_key.rs` | - | ❌ | SigningPrivateKey |
| `signing/signing_public_key.rs` | - | ❌ | SigningPublicKey |
| `signing/signer.rs` | - | ❌ | Signer/Verifier traits |

---

## Module: x25519/ (Key Agreement)

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `x25519/mod.rs` | - | ❌ | Module definition |
| `x25519/x25519_private_key.rs` | `x25519-private-key.ts` | ⚠️ | Missing derive_from_key_material |
| `x25519/x25519_public_key.rs` | `x25519-public-key.ts` | ⚠️ | Basic only |

---

## Module: ed25519/ (Ed25519 Signatures)

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `ed25519/mod.rs` | - | ❌ | Module definition |
| `ed25519/ed25519_private_key.rs` | `ed25519-private-key.ts` | ⚠️ | Missing CBOR/UR |
| `ed25519/ed25519_public_key.rs` | `ed25519-public-key.ts` | ⚠️ | Missing CBOR/UR |

---

## Module: ec_key/ (secp256k1 EC Keys) - Feature: secp256k1

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `ec_key/mod.rs` | - | ❌ | Full module |
| `ec_key/ec_key_base.rs` | - | ❌ | ECKey/ECKeyBase traits |
| `ec_key/ec_public_key_base.rs` | - | ❌ | ECPublicKeyBase trait |
| `ec_key/ec_private_key.rs` | - | ❌ | ECPrivateKey |
| `ec_key/ec_public_key.rs` | - | ❌ | ECPublicKey (compressed) |
| `ec_key/ec_uncompressed_public_key.rs` | - | ❌ | ECUncompressedPublicKey |
| `ec_key/schnorr_public_key.rs` | - | ❌ | SchnorrPublicKey |

---

## Module: sr25519/ (Substrate SR25519) - Feature: sr25519

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `sr25519/mod.rs` | - | ❌ | Full module |
| `sr25519/sr25519_private_key.rs` | - | ❌ | Sr25519PrivateKey |
| `sr25519/sr25519_public_key.rs` | - | ❌ | Sr25519PublicKey |

---

## Module: mldsa/ (Post-Quantum ML-DSA) - Feature: pqcrypto

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `mldsa/mod.rs` | - | ❌ | Full module |
| `mldsa/mldsa_level.rs` | - | ❌ | MLDSA security levels |
| `mldsa/mldsa_private_key.rs` | - | ❌ | MLDSAPrivateKey |
| `mldsa/mldsa_public_key.rs` | - | ❌ | MLDSAPublicKey |
| `mldsa/mldsa_signature.rs` | - | ❌ | MLDSASignature |

---

## Module: mlkem/ (Post-Quantum ML-KEM) - Feature: pqcrypto

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `mlkem/mod.rs` | - | ❌ | Full module |
| `mlkem/mlkem_level.rs` | - | ❌ | MLKEM security levels |
| `mlkem/mlkem_private_key.rs` | - | ❌ | MLKEMPrivateKey |
| `mlkem/mlkem_public_key.rs` | - | ❌ | MLKEMPublicKey |
| `mlkem/mlkem_ciphertext.rs` | - | ❌ | MLKEMCiphertext |

---

## Module: encapsulation/ (Key Encapsulation)

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `encapsulation/mod.rs` | - | ❌ | Full module + tests |
| `encapsulation/encapsulation_scheme.rs` | - | ❌ | EncapsulationScheme enum |
| `encapsulation/encapsulation_private_key.rs` | - | ❌ | EncapsulationPrivateKey |
| `encapsulation/encapsulation_public_key.rs` | - | ❌ | EncapsulationPublicKey |
| `encapsulation/encapsulation_ciphertext.rs` | - | ❌ | EncapsulationCiphertext |
| `encapsulation/sealed_message.rs` | - | ❌ | SealedMessage |

---

## Module: encrypted_key/ (Password-Based Key Derivation)

| Rust File | TypeScript File | Status | Notes |
|-----------|----------------|--------|-------|
| `encrypted_key/mod.rs` | - | ❌ | Full module |
| `encrypted_key/hash_type.rs` | - | ❌ | HashType enum |
| `encrypted_key/key_derivation.rs` | - | ❌ | KeyDerivation trait |
| `encrypted_key/key_derivation_method.rs` | - | ❌ | KeyDerivationMethod enum |
| `encrypted_key/key_derivation_params.rs` | - | ❌ | KeyDerivationParams |
| `encrypted_key/pbkdf2_params.rs` | - | ❌ | PBKDF2Params |
| `encrypted_key/scrypt_params.rs` | - | ❌ | ScryptParams |
| `encrypted_key/argon2id_params.rs` | - | ❌ | Argon2idParams |
| `encrypted_key/hkdf_params.rs` | - | ❌ | HKDFParams |
| `encrypted_key/encrypted_key_impl.rs` | - | ❌ | EncryptedKey |
| `encrypted_key/ssh_agent_params.rs` | - | ❌ | SSHAgentParams (feature) |

---

## Dependency Changes Required

### Current package.json dependencies:
```json
{
  "@blockchain-commons/crypto": "workspace:*",
  "@blockchain-commons/dcbor": "workspace:*",
  "@blockchain-commons/rand": "workspace:*",
  "@blockchain-commons/uniform-resources": "workspace:*",
  "pako": "^2.1.0"
}
```

### Required dependencies (to match Rust):
```json
{
  "@blockchain-commons/crypto": "workspace:*",
  "@blockchain-commons/dcbor": "workspace:*",
  "@blockchain-commons/rand": "workspace:*",
  "@blockchain-commons/tags": "workspace:*",        // ADD
  "@blockchain-commons/uniform-resources": "workspace:*",
  "@blockchain-commons/sskr": "workspace:*",        // ADD
  "pako": "^2.1.0"
}
```

---

## Implementation Priority

### Phase 1: Foundation (Required for other packages)
1. Update `package.json` with correct dependencies
2. Add `DigestProvider` interface
3. Add CBOR/UR serialization to existing types:
   - Digest
   - Nonce
   - Salt
   - Seed
   - ARID
   - UUID
   - URI
   - XID

### Phase 2: Symmetric Encryption
1. Complete `SymmetricKey` with encrypt/decrypt
2. Complete `EncryptedMessage` with CBOR/UR
3. Add tests matching Rust test vectors

### Phase 3: Signing Infrastructure
1. Add `Signature` type
2. Add `SignatureScheme` enum
3. Add `SigningPrivateKey` and `SigningPublicKey`
4. Add `Signer` and `Verifier` interfaces
5. Integrate Ed25519 signing

### Phase 4: Key Agreement
1. Complete X25519 with `derive_from_key_material`
2. Add CBOR/UR serialization
3. Add `shared_key_with` method

### Phase 5: EC Keys (secp256k1)
1. Add `ECPrivateKey`
2. Add `ECPublicKey` (compressed)
3. Add `ECUncompressedPublicKey`
4. Add `SchnorrPublicKey`
5. Add ECDSA and Schnorr signing

### Phase 6: Encapsulation
1. Add `EncapsulationScheme`
2. Add `EncapsulationPrivateKey` and `EncapsulationPublicKey`
3. Add `SealedMessage`

### Phase 7: Key Derivation
1. Add key derivation parameter types
2. Add `EncryptedKey`

### Phase 8: Advanced Features
1. Add SSKR integration
2. Add `PrivateKeyBase`
3. Add `PrivateKeys` and `PublicKeys`
4. Add tags registry

### Phase 9: Post-Quantum (Optional)
1. Add ML-DSA (MLDSA)
2. Add ML-KEM (MLKEM)

### Phase 10: Substrate (Optional)
1. Add SR25519 support

---

## Test Coverage

Each module should have tests matching the Rust implementation:

### Required Test Files:
- `tests/digest.test.ts`
- `tests/nonce.test.ts`
- `tests/salt.test.ts`
- `tests/seed.test.ts`
- `tests/symmetric.test.ts`
- `tests/signing.test.ts`
- `tests/x25519.test.ts`
- `tests/ed25519.test.ts`
- `tests/ec-key.test.ts`
- `tests/encapsulation.test.ts`
- `tests/encrypted-key.test.ts`
- `tests/sskr.test.ts`
- `tests/identifiers.test.ts` (ARID, UUID, URI, XID)

---

## Estimated Scope

| Phase | Files | Estimated Lines | Priority |
|-------|-------|-----------------|----------|
| Phase 1 | 10 | ~500 | Critical |
| Phase 2 | 4 | ~400 | Critical |
| Phase 3 | 6 | ~800 | Critical |
| Phase 4 | 3 | ~300 | Critical |
| Phase 5 | 6 | ~600 | High |
| Phase 6 | 5 | ~500 | High |
| Phase 7 | 10 | ~800 | Medium |
| Phase 8 | 5 | ~500 | Medium |
| Phase 9 | 8 | ~1000 | Low |
| Phase 10 | 3 | ~300 | Low |

**Total estimated new code:** ~5,700 lines (excluding tests)
**Total estimated tests:** ~2,000 lines

---

## Directory Structure (After Refactoring)

```
packages/components/
├── src/
│   ├── index.ts                    # Main exports
│   ├── error.ts                    # Error types
│   │
│   ├── # Core Types
│   ├── digest.ts                   # Digest (SHA-256)
│   ├── digest-provider.ts          # DigestProvider interface
│   ├── nonce.ts                    # Nonce (12 bytes)
│   ├── salt.ts                     # Salt (variable)
│   ├── seed.ts                     # Seed (with metadata)
│   ├── compressed.ts               # Compressed data
│   ├── json.ts                     # JSON wrapper
│   ├── reference.ts                # Reference type
│   ├── hkdf-rng.ts                 # HKDF-based RNG
│   │
│   ├── # Identifiers
│   ├── id/
│   │   ├── index.ts
│   │   ├── arid.ts                 # ARID
│   │   ├── uri.ts                  # URI
│   │   ├── uuid.ts                 # UUID
│   │   └── xid.ts                  # XID
│   │
│   ├── # Symmetric Encryption
│   ├── symmetric/
│   │   ├── index.ts
│   │   ├── symmetric-key.ts
│   │   ├── authentication-tag.ts
│   │   └── encrypted-message.ts
│   │
│   ├── # Digital Signatures
│   ├── signing/
│   │   ├── index.ts
│   │   ├── signature.ts
│   │   ├── signature-scheme.ts
│   │   ├── signing-private-key.ts
│   │   ├── signing-public-key.ts
│   │   └── signer.ts               # Signer/Verifier interfaces
│   │
│   ├── # X25519 Key Agreement
│   ├── x25519/
│   │   ├── index.ts
│   │   ├── x25519-private-key.ts
│   │   └── x25519-public-key.ts
│   │
│   ├── # Ed25519 Signatures
│   ├── ed25519/
│   │   ├── index.ts
│   │   ├── ed25519-private-key.ts
│   │   └── ed25519-public-key.ts
│   │
│   ├── # EC Keys (secp256k1)
│   ├── ec-key/
│   │   ├── index.ts
│   │   ├── ec-key-base.ts
│   │   ├── ec-private-key.ts
│   │   ├── ec-public-key.ts
│   │   ├── ec-uncompressed-public-key.ts
│   │   └── schnorr-public-key.ts
│   │
│   ├── # Key Encapsulation
│   ├── encapsulation/
│   │   ├── index.ts
│   │   ├── encapsulation-scheme.ts
│   │   ├── encapsulation-private-key.ts
│   │   ├── encapsulation-public-key.ts
│   │   ├── encapsulation-ciphertext.ts
│   │   └── sealed-message.ts
│   │
│   ├── # Encrypted Keys
│   ├── encrypted-key/
│   │   ├── index.ts
│   │   ├── hash-type.ts
│   │   ├── key-derivation.ts
│   │   ├── key-derivation-method.ts
│   │   ├── key-derivation-params.ts
│   │   ├── pbkdf2-params.ts
│   │   ├── scrypt-params.ts
│   │   ├── argon2id-params.ts
│   │   ├── hkdf-params.ts
│   │   └── encrypted-key.ts
│   │
│   ├── # Key Management
│   ├── encrypter.ts                # Encrypter/Decrypter interfaces
│   ├── private-key-base.ts
│   ├── private-key-data-provider.ts
│   ├── private-keys.ts
│   ├── public-keys.ts
│   ├── keypair.ts
│   │
│   ├── # SSKR Integration
│   ├── sskr.ts
│   │
│   ├── # Tags Registry
│   ├── tags-registry.ts
│   │
│   ├── # Post-Quantum (optional)
│   ├── mldsa/                      # ML-DSA signatures
│   ├── mlkem/                      # ML-KEM encapsulation
│   │
│   └── # Substrate (optional)
│       └── sr25519/                # SR25519 signatures
│
├── tests/
│   ├── digest.test.ts
│   ├── nonce.test.ts
│   ├── salt.test.ts
│   ├── seed.test.ts
│   ├── symmetric.test.ts
│   ├── signing.test.ts
│   ├── x25519.test.ts
│   ├── ed25519.test.ts
│   ├── ec-key.test.ts
│   ├── encapsulation.test.ts
│   ├── encrypted-key.test.ts
│   ├── sskr.test.ts
│   └── identifiers.test.ts
│
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## Next Steps

1. **Approve this plan** - Review and confirm the approach
2. **Update dependencies** - Add `@blockchain-commons/tags` and `@blockchain-commons/sskr`
3. **Start Phase 1** - Foundation types with CBOR/UR serialization
4. **Iterate** - Complete each phase with tests before moving to the next

---

*Created: December 9, 2025*
