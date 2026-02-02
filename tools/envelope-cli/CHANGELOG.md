# Changelog

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **XID key subcommands**: `key/add`, `key/all`, `key/at`, `key/count`, `key/find` (by inception, name, public key), `key/remove`, `key/update`
- **XID method subcommands**: `method/add`, `method/all`, `method/at`, `method/count`, `method/remove`
- **XID resolution subcommands**: `resolution/add`, `resolution/all`, `resolution/at`, `resolution/count`, `resolution/remove`
- **XID service subcommands**: `service/add`, `service/all`, `service/at`, `service/count`, `service/find` (by name, URI), `service/remove`, `service/update`
- **XID edge subcommands**: `edge/add`, `edge/all`, `edge/at`, `edge/count`, `edge/find`, `edge/remove`
- **XID attachment subcommands**: `attachment/add`, `attachment/all`, `attachment/at`, `attachment/count`, `attachment/find`, `attachment/remove`
- **XID delegate subcommands**: `delegate/add`, `delegate/all`, `delegate/at`, `delegate/count`, `delegate/find`, `delegate/remove`, `delegate/update`
- **XID provenance subcommands**: `provenance/get`, `provenance/next`
- **XID utility modules**: `xid-utils.ts`, `signing-args.ts`, `verify-args.ts`, `password-args.ts`, `output-options.ts`, `private-options.ts`, `generator-options.ts`, `key-args.ts`, `xid-privilege.ts`, `service-args.ts`
- **XID edge tests** (`xid-edge.test.ts`): Comprehensive test suite for XID edge operations
- **XID resolution tests** (`xid-resolution.test.ts`): Test suite for XID resolution operations
- **Expanded XID signing tests** (`xid-signing.test.ts`): Additional signing and verification tests
- **Expanded XID export tests** (`xid-export.test.ts`): Additional export format tests
- **Expanded XID tests** (`xid.test.ts`): Comprehensive tests covering key management, services, delegates, provenance, and attachments

### Changed

- **XID new command**: Refactored with improved argument handling and key generation options
- **Data types**: Extended data type support
- **Removed placeholders**: Deleted `placeholders.ts` — all placeholder implementations replaced with real implementations
