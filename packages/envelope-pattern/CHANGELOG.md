# Changelog

## [1.0.0-beta.4] - 2026-06-28

### Changed

- Dependency sync

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

- Sweeping alignment with upstream `envelope-pattern`: all leaf / meta / structure parsers (array, cbor, date, known-value, null, number, tag, and / or / not / capture / group / search / traverse / primary, plus assertion / compressed / digest / elided / encrypted / node / object / obscured / predicate / subject / wrapped) and the corresponding pattern types and VM updated.
- DCBOR↔envelope-pattern conversion bridge (`dcbor-integration.ts`) updated; format helpers refined.

## [1.0.0-alpha.23] - 2026-04-24

### Changed

- Removed unnecessary `as Result<...>` casts in `map` and `parsePartial`.

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

- **Pattern matcher**: Significant improvements to the pattern matching engine for better Rust parity
- **Traverse pattern**: Enhanced traversal logic with improved matching behavior
- **Wrapped pattern**: Extended wrapped pattern support with additional matching capabilities
- **AND/OR/NOT patterns**: Refined meta-pattern logic for more accurate matching
- **Capture pattern**: Improved capture handling
- **Group pattern**: Enhanced group pattern matching
- **Search pattern**: Improved search pattern behavior
- **Assertions pattern**: Refined assertions matching logic
- **Object/Predicate/Subject patterns**: Improved structural pattern matching
- **Leaf patterns** (map, null, number, text): Minor refinements
- **VM**: Pattern VM refinements
