# Changelog

## [1.0.0-beta.4] - 2026-06-28

Full byte-for-byte parity pass against the authoritative Rust `bc-dcbor`
reference (see `DCBOR_RUST_PARITY_AUDIT.md`). Every critical, high, and medium
audit finding is resolved, dead code removed, and the public surface aligned.
The test suite now mirrors 100% of the meaningful Rust test vectors (258 tests).

### Changed

- **BREAKING (wire format):** `CborSet` now serializes as a plain **untagged
  CBOR array** (matching Rust `Set`), not a tag-258-wrapped array. `toBytes()`,
  `cborData()`, and nested encodings all emit the untagged form; decode via
  `CborSet.fromCbor`. The tag-258 encode/decode API was removed.
- **Decode is now strictly canonical** in more cases:
  - Invalid UTF-8 in text strings is rejected (`InvalidUtf8`) instead of being
    silently replaced with U+FFFD.
  - Misordered map keys are correctly rejected (`MisorderedMapKey`), including
    keys that land _between_ existing keys (previously accepted).
  - A truncated nested item in a sub-array input now surfaces as `Underrun`
    rather than relying on the trailing-bytes backstop.
- `CborDate.fromString` now parses strictly: RFC-3339 date-times (with seconds
  and an explicit `Z`/offset) or bare `YYYY-MM-DD` (UTC), with calendar
  validation — rejecting lenient forms like `2023/02/08`, `Feb 8 2023`, and
  impossible dates like `2023-02-30`.
- `asFloat`/`expectFloat` now coerce integer CBOR to float (matching Rust
  `TryFrom<CBOR> for f64`); `expectFloat` throws `OutOfRange` for integers not
  exactly representable as `f64`.
- Tag matching is now value-normalized across the `number`/`bigint` boundary
  (new `tagValuesEqual`), so a legal u64 tag matches regardless of JS
  representation.
- Diagnostic/`dump` float rendering matches Rust's `{:?}` (decimal/scientific
  crossover); diagnostic text escaping escapes only the double-quote.
- Summarizer errors render via the full `Error` Display (name-aware `WrongTag`).
- Dependencies bumped to latest.

### Added

- `TagsStoreOpt` type (mirrors Rust's enum); `tagValuesEqual`; public exports of
  `ToCbor`/`TaggedCborEncodable`. Aligned `index`/`prelude` re-exports
  (`withTags`/`withTagsMut` from index; `CborSummarizer`/`SummarizerResult`/
  `TagsStoreOpt` from prelude).
- Full Rust test-vector parity: all 30 `encode_float` boundary vectors,
  `format_structure`/`format_structure_2`, a new `exact.ts` test module, and
  regression tests for every fixed finding.

### Fixed

- Whole-valued JS numbers ≥ 2⁵³ now encode as integers (not floats), matching
  Rust and the `bigint` path.
- Negative whole-float integer reduction no longer loses precision (removed the
  lossy `Number(bigint)` narrowing); fixes off-by-one bytes vs. Rust.
- `Date` decode/construction truncates to whole seconds + saturating nanoseconds
  like Rust's `from_timestamp`.
- `ExactF32/F64.exactFromU64` use a saturating float→int round-trip (accept
  `u64::MAX`), matching Rust.

### Removed

- Dead `validateCanonicalF16/F32/F64` helpers (the decoder uses
  re-encode-and-compare; these were unused and latently buggy).

## [1.0.0-beta.3] - 2026-06-22

### Changed

- Dependencies bump

## [1.0.0-beta.2] - 2026-06-16

### Changed

- Dependencies bump

## [1.0.0-beta.1] - 2026-05-27

### Changed

- Workspace version bump

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
