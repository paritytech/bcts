[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / parseSeed

# Function: parseSeed()

> **parseSeed**(`input`): `ProvenanceSeed`

Defined in: [cmd/seed.ts:22](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/seed.ts#L22)

Parse a seed from a string.

Supports the following formats:
- `ur:seed/...` - UR-encoded seed
- `0x...` or hex string - Hex-encoded seed
- Base64 string - Base64-encoded seed

Corresponds to Rust `parse_seed()`

## Parameters

### input

`string`

## Returns

`ProvenanceSeed`
