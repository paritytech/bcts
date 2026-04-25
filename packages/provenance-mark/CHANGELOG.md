# Changelog

## [1.0.0-alpha.23] - 2026-04-24

### Added

- New 32-byte Mark identifier API on `ProvenanceMark`, mirroring `bc-provenance-mark-rust` ≥ v0.7.0:
  - `id()` — composes the full 32-byte ID from the stored hash plus fingerprint padding.
  - `idHex()` — 64-character hex representation of the ID.
  - `idBytewords(wordCount, prefix)` — first `wordCount ∈ 4..=32` bytes as upper-case ByteWords, optionally with the provenance-mark prefix glyph.
  - `idBytemoji(wordCount, prefix)` — same range as Bytemojis.
  - `idMinimalBytewords(wordCount, prefix)` — same range as 2-letter minimal ByteWords.
- `tests/identifier.test.ts` covering the new identifier surface against shared test vectors.

### Changed

- Switched internal ByteWords helpers to the new `encodeToWords` / `encodeToBytemojis` / `encodeToMinimalBytewords` exports from `@bcts/uniform-resources`.
- Minor cleanups in `mark-info.ts`, `resolution.ts`, and `validate.ts` to drop redundant casts.

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

- **Compatibility**: Removed Node.js `require("buffer")` fallback from `toBase64()` and `fromBase64()` in `utils.ts`. These functions now use the standard `btoa()`/`atob()` APIs directly, which are available in all browsers and Node.js 18+.

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Bytewords minimal identifier**: `ProvenanceMark.bytewordsMinimalIdentifier()` method that produces a compact 8-letter identifier from the first 4 ByteWords words (e.g., "ABLE ACID ALSO APEX" -> "AEADAOAX")

### Changed

- **Envelope integration** (`envelope.ts`): Refactored provenance mark envelope conversion for improved Rust parity
- **Mark** (`mark.ts`): Enhanced provenance mark implementation with validation integration and improved formatting
- **Validation** (`validate.ts`): Simplified validation logic
