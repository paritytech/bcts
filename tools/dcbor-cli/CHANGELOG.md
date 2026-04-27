# Changelog

## [1.0.0-beta.0] - 2026-04-27

### Changed

- Hidden default `parse` subcommand removes the `--out` collision so flags forward to the active subcommand.
- Tag registration via `@bcts/tags::registerTags()` at CLI startup so global tag names appear in diagnostic / hex annotated output.
- Switched annotated diagnostic / hex paths to `diagnosticAnnotated` / `hexAnnotated` (multi-line, global tags resolved).
- Clap-style enum-error format with exit code 2 (`error: invalid value 'X' for '--<long> <UPPER>'\n  [possible values: …]`).
- Version string prefixed `@bcts/dcbor-cli ` and sourced from `package.json` so it cannot drift.
- Description quotes "dCBOR" verbatim per upstream wording.

## [1.0.0-alpha.23] - 2026-04-24

### Changed

- Workspace version bump

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
