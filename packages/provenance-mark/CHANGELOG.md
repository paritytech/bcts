# Changelog

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Bytewords minimal identifier**: `ProvenanceMark.bytewordsMinimalIdentifier()` method that produces a compact 8-letter identifier from the first 4 ByteWords words (e.g., "ABLE ACID ALSO APEX" -> "AEADAOAX")

### Changed

- **Envelope integration** (`envelope.ts`): Refactored provenance mark envelope conversion for improved Rust parity
- **Mark** (`mark.ts`): Enhanced provenance mark implementation with validation integration and improved formatting
- **Validation** (`validate.ts`): Simplified validation logic
