# Changelog

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Workspace version bump

## [1.0.0-alpha.20] - 2026-02-12

### Added

- `EDGE_UNEXPECTED_ASSERTION` error code for strict edge validation (BCR-2026-003)
- `EnvelopeError.edgeUnexpectedAssertion()` factory method

### Changed

- **Breaking**: `validateEdge()` now rejects edges with any assertions beyond `isA`, `source`, and `target` (BCR-2026-003). Additional claim detail must be placed on target/source objects, not on the edge subject.
- Rewrote `validateEdge()` from count-based to single-pass predicate iteration using raw known-value constants

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Workspace version bump

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Edge extension** (`extension/edge.ts`): Full implementation of the edge extension for creating and managing edge envelopes (BCR-2026-003), matching the Rust `bc-envelope-rust` implementation
- **Edge test suite** (`tests/edge.test.ts`): Comprehensive tests for edge creation, queries, and formatting
- **Edge error codes**: `EDGE_MISSING_IS_A`, `EDGE_MISSING_SOURCE`, `EDGE_MISSING_TARGET`, `EDGE_DUPLICATE_IS_A`, `EDGE_DUPLICATE_SOURCE`, `EDGE_DUPLICATE_TARGET`, `NONEXISTENT_EDGE`, `AMBIGUOUS_EDGE`
- **Format context**: Tag-aware summarizers for all `@bcts/components` tag types (Digest, ARID, URI, UUID, Nonce, Salt, Seed, Signature, SealedMessage, EncryptedKey, PrivateKeyBase, PublicKeyBase, CID, XID, PrivateKeys, PublicKeys, Agreement, Password, ProvenanceMark)
- **Signature metadata**: `SigningOptions` type re-exported from `@bcts/components`

### Changed

- **Signature predicates**: `SIGNED` and `NOTE` now use canonical `KnownValue` instances from `@bcts/known-values` instead of plain strings, matching the Rust implementation. Envelope format output now renders `'signed'` and `'note'` (single-quoted known values) instead of `"signed"` and `"note"` (double-quoted strings)
- **Attachment predicates**: `ATTACHMENT`, `VENDOR`, and `CONFORMS_TO` now use `KnownValue` instances from `@bcts/known-values`, rendering as `'attachment'`, `'vendor'`, and `'conformsTo'` in format output
- **Module augmentation**: Replaced `declare module` blocks in `seal.ts` and `extension/sskr.ts` with `declare` field statements in the `Envelope` class body, eliminating `rolldown-plugin-dts` warnings about relative module paths
- **Signature extension**: Widened `SignatureMetadata` predicate types to accept `EnvelopeEncodableValue` (including `KnownValue`), matching Rust's `impl EnvelopeEncodable`
- **Attachment validation**: `validateAttachment` now uses digest-based comparison instead of `asText()` for predicate matching, matching the Rust approach
- **Test timeouts**: Increased timeout for Argon2id-based crypto tests to 30 seconds
