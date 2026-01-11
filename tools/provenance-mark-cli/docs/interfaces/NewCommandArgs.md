[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / NewCommandArgs

# Interface: NewCommandArgs

Defined in: [cmd/new.ts:102](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L102)

Arguments for the new command.

Corresponds to Rust `CommandArgs`

## Properties

### path

> **path**: `string`

Defined in: [cmd/new.ts:104](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L104)

Path to directory to be created. Must not already exist.

***

### seed?

> `optional` **seed**: `ProvenanceSeed`

Defined in: [cmd/new.ts:106](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L106)

A seed to use for the provenance mark chain, encoded as base64.

***

### resolution

> **resolution**: [`Resolution`](../enumerations/Resolution.md)

Defined in: [cmd/new.ts:108](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L108)

The resolution of the provenance mark chain.

***

### comment

> **comment**: `string`

Defined in: [cmd/new.ts:110](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L110)

A comment to be included for the genesis mark.

***

### date?

> `optional` **date**: `Date`

Defined in: [cmd/new.ts:112](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L112)

The date of the genesis mark. If not supplied, the current date is used.

***

### quiet

> **quiet**: `boolean`

Defined in: [cmd/new.ts:114](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L114)

Suppress informational status output on stderr/stdout.

***

### format

> **format**: [`OutputFormat`](../enumerations/OutputFormat.md)

Defined in: [cmd/new.ts:116](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L116)

Output format for the creation summary.

***

### info

> **info**: [`InfoArgs`](InfoArgs.md)

Defined in: [cmd/new.ts:118](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L118)

Info args for the mark.
