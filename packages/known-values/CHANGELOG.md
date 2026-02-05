# Changelog

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Version bump to keep workspace dependencies in sync.

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Bundled registries** (`bundled-registries.ts`): 14 JSON registry files are now imported at build time and embedded in the bundle, providing all known values without filesystem access
- **`SELF` known value**: Added `SELF` (706) to the registry, now resolved via bundled BC registry
- **`KnownValuesStore`**: New dedicated store class for managing known value collections
- **`data/` directory**: Ships 14 JSON registry files (Blockchain Commons, RDF, RDFS, OWL2, Dublin Core Elements, Dublin Core Terms, FOAF, SKOS, Solid, W3C VC, GS1, Schema.org, Community)
- **New exports**: `loadBundledRegistries()`, `RegistryEntry` and `RegistryFile` types
