[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / InfoArgs

# Interface: InfoArgs

Defined in: [cmd/info.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/info.ts#L16)

Arguments for info payload.

Corresponds to Rust `InfoArgs`

## Properties

### info?

> `optional` **info**: `string`

Defined in: [cmd/info.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/info.ts#L18)

Hex-encoded dCBOR or UR payload to embed in the mark's `info` field.

***

### infoTag?

> `optional` **infoTag**: `number`

Defined in: [cmd/info.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/info.ts#L20)

CBOR tag value to associate with an unknown UR type.
