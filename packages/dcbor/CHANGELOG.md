# Changelog

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Version bump to keep workspace dependencies in sync.

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Bignum support** (`bignum.ts`): Full implementation of CBOR bignum encoding/decoding (tags 2 and 3) for arbitrary-precision integers, matching the Rust `bc-dcbor-rust` implementation
- **Tags module** (`tags.ts`): New module defining standard CBOR tag constants used across the BCTS ecosystem
