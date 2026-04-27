# Changelog

## [1.0.0-beta.0] - 2026-04-27

### Changed

- Sweeping alignment with upstream `dcbor` (Rust): bignum, decode, diag, dump, float, set, simple, sortable, tag/tags, varint, walk, conveniences, prelude, and tagged decodable / encodable helpers all updated.
- `date.ts` and `index.ts` re-exports refined to mirror Rust's public surface; redundant casts removed.

## [1.0.0-alpha.23] - 2026-04-24

### Changed

- Cleaned up redundant type assertions in `diagnosticFlat`.

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

### Changed

- Workspace version bump

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Bignum support** (`bignum.ts`): Full implementation of CBOR bignum encoding/decoding (tags 2 and 3) for arbitrary-precision integers, matching the Rust `bc-dcbor-rust` implementation
- **Tags module** (`tags.ts`): New module defining standard CBOR tag constants used across the BCTS ecosystem
