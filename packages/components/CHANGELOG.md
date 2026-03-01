# Changelog

## [1.0.0-alpha.22] - 2026-03-01

### Changed

- Workspace version bump

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Workspace version bump

## [1.0.0-alpha.20] - 2026-02-12

### Changed

- Workspace version bump

## [1.0.0-alpha.19] - 2026-02-05

### Fixed

- **Compatibility**: Removed insecure `Math.random()` fallback in `UUID.random()`. UUID generation now uses `globalThis.crypto.getRandomValues()` exclusively, which is available in all browsers and Node.js 18+.

## [1.0.0-alpha.18] - 2025-01-31

### Changed

- **PrivateKeyBase**: Major refactor for Rust parity
  - Key derivation now uses HKDF with salt strings matching Rust's `bc-crypto` (`"signing"` for signing keys, `"agreement"` handled internally by `X25519PrivateKey.deriveFromKeyMaterial()`)
  - Relaxed constructor validation from fixed 32-byte requirement to non-zero length, matching Rust's flexible `PrivateKeyBase::new(data)`
  - Renamed internal constant `PRIVATE_KEY_BASE_SIZE` to `PRIVATE_KEY_BASE_DEFAULT_SIZE` (32 bytes, used only for random generation)
  - `x25519PrivateKey()` now delegates to `X25519PrivateKey.deriveFromKeyMaterial()` instead of manual HKDF derivation
- **PrivateKeyBase key derivation**: Added `schnorrPrivateKeys()` and `ecdsaPrivateKeys()` methods for Schnorr and ECDSA key pair derivation
- **XID**: Enhanced `XID` type with additional methods for Rust parity
- **Signature**: Minor improvements to signature handling
