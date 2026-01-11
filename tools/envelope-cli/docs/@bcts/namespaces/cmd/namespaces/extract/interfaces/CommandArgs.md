[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [extract](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/extract.ts:85](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L85)

Command arguments for the extract command.

## Properties

### type

> **type**: [`SubjectType`](../enumerations/SubjectType.md)

Defined in: [cmd/extract.ts:87](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L87)

Subject type to extract

***

### urType?

> `optional` **urType**: `string`

Defined in: [cmd/extract.ts:89](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L89)

The type for an extracted UR

***

### urTag?

> `optional` **urTag**: `number` \| `bigint`

Defined in: [cmd/extract.ts:91](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L91)

The expected tag for an extracted UR

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/extract.ts:93](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L93)

The envelope to extract from
