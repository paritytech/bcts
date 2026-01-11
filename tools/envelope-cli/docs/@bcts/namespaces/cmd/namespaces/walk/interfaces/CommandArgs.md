[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [walk](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/walk/index.ts:61](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/walk/index.ts#L61)

Command arguments for the walk command.

## Properties

### target

> **target**: `string`[]

Defined in: [cmd/walk/index.ts:63](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/walk/index.ts#L63)

Optional target digests to filter nodes

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/walk/index.ts:65](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/walk/index.ts#L65)

The envelope to walk

***

### command?

> `optional` **command**: [`WalkSubcommand`](../type-aliases/WalkSubcommand.md)

Defined in: [cmd/walk/index.ts:67](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/walk/index.ts#L67)

The subcommand to execute
