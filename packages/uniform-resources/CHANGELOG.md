# Changelog

## [1.0.0-alpha.23] - 2026-04-24

### Added

- New variable-length ByteWord helpers mirroring `bc-ur-rust` ≥ v0.19.1:
  - `encodeToWords(data)` — space-separated ByteWords for arbitrary byte slices (no CRC).
  - `encodeToBytemojis(data)` — space-separated Bytemojis for arbitrary byte slices.
  - `encodeToMinimalBytewords(data)` — 2-letter minimal ByteWords concatenated without separator.
  - `isValidBytemoji(emoji)` — membership check against the canonical 256-Bytemoji set.
  - `canonicalizeByteword(input)` — normalizes a 2- or 4-letter ByteWord input into its canonical 4-letter form.
- `tests/bytewords-helpers.test.ts` exercising the new helpers.

### Changed

- The existing `encodeBytewordsIdentifier` / `encodeBytemojisIdentifier` are now thin 4-byte wrappers over `encodeToWords` / `encodeToBytemojis`.

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

### Changed

- Updated Rust reference implementations
