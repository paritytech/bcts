# Changelog

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Workspace version bump

## [1.0.0-alpha.20] - 2026-02-12

### Added

- **VALUE** known value (codepoint 25) — the object is the value of the subject
- **ATTESTATION** known value (codepoint 26) — the object is an attestation of the subject
- **VERIFIABLE_AT** known value (codepoint 27) — the object is a date at which the subject can be verified
- Raw constants `VALUE_RAW`, `ATTESTATION_RAW`, `VERIFIABLE_AT_RAW` for pattern matching
- Registry entries in bundled JSON for codepoints 25, 26, 27

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Workspace version bump

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Bundled registries** (`bundled-registries.ts`): 14 JSON registry files are now imported at build time and embedded in the bundle, providing all known values without filesystem access
- **`SELF` known value**: Added `SELF` (706) to the registry, now resolved via bundled BC registry
- **`KnownValuesStore`**: New dedicated store class for managing known value collections
- **`data/` directory**: Ships 14 JSON registry files (Blockchain Commons, RDF, RDFS, OWL2, Dublin Core Elements, Dublin Core Terms, FOAF, SKOS, Solid, W3C VC, GS1, Schema.org, Community)
- **New exports**: `loadBundledRegistries()`, `RegistryEntry` and `RegistryFile` types
