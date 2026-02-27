# Changelog

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
