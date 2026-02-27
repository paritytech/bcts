# Changelog

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Workspace version bump

## [1.0.0-alpha.20] - 2026-02-12

### Changed

- Updated edge tests per BCR-2026-003: claim detail now placed on target object instead of edge subject

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Workspace version bump

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Edge support**: `XIDDocument` now supports edges via `@bcts/envelope` edge extension, including `addEdge()`, `removeEdge()`, `edges()`, `findEdges()` methods
- **Attachment support**: `XIDDocument` now supports attachments via `@bcts/envelope` attachment extension
- **Edge test suite** (`tests/edge.test.ts`): Comprehensive tests for edge creation, querying, and removal in XID documents
- **Signing options**: New `signingPrivateKey` signing option type for direct `SigningPrivateKey` usage
- **Key encryption tests**: Expanded tests for encrypting and decrypting private keys with passwords (Argon2id, PBKDF2, Scrypt)
- **Provenance encryption tests**: Tests for encrypting/decrypting provenance generators with passwords

### Changed

- **XIDDocument**: Major expansion of the XID document implementation for Rust parity, including support for signed envelopes, key management, service endpoints, provenance marks, delegate management, and resolution management
- **Key module**: Enhanced key encryption/decryption with support for multiple password derivation methods
- **Provenance module**: Enhanced provenance mark management with encryption support
- **Service module**: Improved service endpoint handling
- **XIDSigningOptions**: Replaced `privateKeyBase` option with `signingPrivateKey` for more direct signing control
- **Test timeouts**: Increased timeout for password-derivation tests to 30 seconds across `key.test.ts`, `edge.test.ts`, `provenance.test.ts`, and `xid-document.test.ts`
