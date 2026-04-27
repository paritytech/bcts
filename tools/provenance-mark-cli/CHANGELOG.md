# Changelog

## [1.0.0-beta.0] - 2026-04-27

### Changed

- Clap-style enum-error format (`[possible values: …]`, exit code 2) instead of commander's default.
- Uppercased option metavars (`<RESOLUTION>`, `<COUNT>`, …) and stripped trailing periods on descriptions to match the Rust binary verbatim.
- Restored backticks in the `--info` description; `--seed` description matches the Rust wording exactly.
- Version string prefixed `@bcts/provenance-mark-cli ` and sourced from `package.json` so it cannot drift.

## [1.0.0-alpha.23] - 2026-04-24

### Changed

- `validate` command now strips wrapper layers iteratively when looking for the `provenance` assertion

### Added

- `tests/validate.test.ts` covering the validate command's envelope-extraction logic.

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
