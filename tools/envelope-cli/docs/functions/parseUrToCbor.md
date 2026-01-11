[**@bcts/envelope-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/envelope-cli](../globals.md) / parseUrToCbor

# Function: parseUrToCbor()

> **parseUrToCbor**(`s`, `cborTagValue?`): `Cbor`

Defined in: [data-types.ts:273](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/data-types.ts#L273)

Parse any UR into CBOR for use as structured data (e.g., provenance mark info).

This function converts any UR type into a CBOR value:
- For known UR types (envelope, digest, etc.), looks up the CBOR tag from the tag store
- For unknown UR types, requires cborTagValue parameter
- Returns the UR's CBOR content wrapped in the appropriate CBOR tag

## Parameters

### s

`string`

### cborTagValue?

`number` | `bigint`

## Returns

`Cbor`
