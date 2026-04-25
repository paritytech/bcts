# Changelog

## [1.0.0-alpha.23] - 2026-04-24

### Changed

- Replaced the internal `MessageType` `const enum` with an `as const` object + literal-union type so the wire-tag byte and switch arms share a numeric literal type
- Removed redundant casts in `chain.ts`, `encoding/polynomial.ts`, `incremental-mlkem768.ts`, `index.ts`, and `proto/pq-ratchet-types.ts`

## [1.0.0-alpha.22] - 2026-03-01

### Changed

- Workspace version bump

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Initial release
