[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / PrintCommandArgs

# Interface: PrintCommandArgs

Defined in: [cmd/print.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L20)

Arguments for the print command.

Corresponds to Rust `CommandArgs`

## Properties

### path

> **path**: `string`

Defined in: [cmd/print.ts:22](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L22)

Path to the chain's directory. Must already exist.

***

### start

> **start**: `number`

Defined in: [cmd/print.ts:24](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L24)

The sequence number of the first mark to print.

***

### end?

> `optional` **end**: `number`

Defined in: [cmd/print.ts:26](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L26)

The sequence number of the last mark to print.

***

### format

> **format**: [`OutputFormat`](../enumerations/OutputFormat.md)

Defined in: [cmd/print.ts:28](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L28)

Output format for the rendered marks.
