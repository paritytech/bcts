# Changelog

## [1.0.0-beta.0] - 2026-04-27

### Changed

- Refactored to a 1:1 file/symbol mirror of [`bc-lifehash`](https://github.com/BlockchainCommons/bc-lifehash-rust) (Rust). Source layout, composition pattern, and helper signatures now match upstream exactly:
  - Merged `bit-aggregator.ts` into `bit-enumerator.ts`; folded `numeric.ts` helpers (`clamped`, `lerp`, `lerpTo`, `lerpFrom`, `modulo`) into `color.ts`.
  - Renamed entry-point `lifehash.ts` → `lib.ts`.
  - Restored `blend2(c1, c2)` as a separate export alongside `blend(colors)`.
  - Converted module-level `spectrum` / `spectrumCmykSafe` / `grayscale` constants to functions.
  - Renamed `HSBColor.toColor()` → `HSBColor.color()`; added `HSBColor.fromHue()`; dropped the TS-only `fromColor()`.
  - Replaced `Grid<T>` inheritance with composition (`CellGrid`, `ChangeGrid`, `FracGrid`, `ColorGrid` now hold a `grid: Grid<T>` field). Dropped `Point` / `Size` wrapper classes — grid APIs accept raw `(x, y)` / `(width, height)`.
  - Fixed `Grid.circularIndex` to `((i % m) + m) % m` (was correct only for `i ∈ [-m, m)`).
- F32 precision sites now round-trip through `Float32Array` / `Math.fround` to lock byte-identical parity *by construction*: `modulo`, `Color.luminance`, HSB sextant floor.
- `make_image` mirrors Rust's loop-variable choice; tightened `moduleSize` validation to reject non-positive / non-integer values.
- Trimmed public surface in `index.ts` to the 5 Rust exports: `Version`, `Image`, `makeFromUtf8`, `makeFromData`, `makeFromDigest`.
- Dropped trailing periods on internal error messages to match Rust panic wording.

### Added

- `tests/parity.test.ts` — 1000-vector deterministic fuzz suite checked byte-for-byte against a Rust-generated golden file (`tests/fixtures/golden.json`). Regenerate via `cargo run --release --example golden` in the Rust crate.
- `bun run check:parity` script and CI job (`.github/workflows/parity.yml`) running the parity fuzz on every PR.

## [1.0.0-alpha.23] - 2026-04-24

### Added

- Cross-implementation test-vector fixtures (`tests/fixtures/test-vectors.json`) and a `tests/test-vectors.test.ts` suite

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
