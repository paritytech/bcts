[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [generate](../../../README.md) / [seed](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/generate/seed.ts:13](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/seed.ts#L13)

Command arguments for the seed command.

## Properties

### count?

> `optional` **count**: `number`

Defined in: [cmd/generate/seed.ts:15](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/seed.ts#L15)

The number of bytes for the seed. Must be in the range 16..=256.

***

### hex?

> `optional` **hex**: `string`

Defined in: [cmd/generate/seed.ts:17](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/seed.ts#L17)

Raw hex data for the seed.
