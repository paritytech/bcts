[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / NextCommandArgs

# Interface: NextCommandArgs

Defined in: [cmd/next.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L21)

Arguments for the next command.

Corresponds to Rust `CommandArgs`

## Properties

### path

> **path**: `string`

Defined in: [cmd/next.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L23)

Path to the chain's directory. Must already exist.

***

### comment

> **comment**: `string`

Defined in: [cmd/next.ts:25](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L25)

A comment to be included for the mark.

***

### date?

> `optional` **date**: `Date`

Defined in: [cmd/next.ts:27](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L27)

The date of the next mark. If not supplied, the current date is used.

***

### quiet

> **quiet**: `boolean`

Defined in: [cmd/next.ts:29](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L29)

Suppress informational status output on stderr/stdout.

***

### format

> **format**: [`OutputFormat`](../enumerations/OutputFormat.md)

Defined in: [cmd/next.ts:31](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L31)

Output format for the mark.

***

### info

> **info**: [`InfoArgs`](InfoArgs.md)

Defined in: [cmd/next.ts:33](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L33)

Info args for the mark.
