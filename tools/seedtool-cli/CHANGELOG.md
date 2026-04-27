# Changelog

## [1.0.0-beta.0] - 2026-04-27

### Changed

- Now byte-identical with [`seedtool-cli`](https://crates.io/crates/seedtool-cli) (Rust) for all 45 parity-harness cases. Notable adjustments:
  - Stdin is read lazily through `expectInput()` so deterministic flows (`--in random`, `-d <SEED>`, …) no longer block on stdin in non-TTY contexts.
  - `--in` / `--out` / `--sskr-format` choice ordering matches the Rust `clap::ValueEnum` declaration so help text and `[possible values: …]` blocks line up byte-for-byte.
  - Clap-style enum-error format (`[possible values: …]`, exit code 2) instead of commander's default.
  - Strict hex parser with the Rust error wording (`Invalid character 'X' at position N` for hex, `Invalid digit.` for `base6` / `base10` / `bits` / `cards` / `dice`).
  - `cards` and `multipart` paths mirror Rust's exact wording verbatim (including the upstream "rank/suit" and "Insufficient SSKR shares" phrasings).
  - Trailing periods stripped from validation messages; version string prefixed `@bcts/seedtool-cli ` and sourced from `package.json` so it cannot drift.

### Added

- `tests/parity-check.sh` — 45-case byte-for-byte diff harness against the Rust binary; wired into CI via `.github/workflows/parity.yml` (`seedtool-parity` job).

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
