[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../../../globals.md) / [cmd](../../../../../../../README.md) / [assertion](../../../../../README.md) / [find](../../../README.md) / [predicate](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/assertion/find/predicate.ts:14](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/find/predicate.ts#L14)

Command arguments for the find predicate command.

## Properties

### subjectType

> **subjectType**: [`DataType`](../../../../../../../../../../enumerations/DataType.md)

Defined in: [cmd/assertion/find/predicate.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/find/predicate.ts#L16)

Subject type for the predicate to find

***

### subjectValue?

> `optional` **subjectValue**: `string`

Defined in: [cmd/assertion/find/predicate.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/find/predicate.ts#L18)

Subject value for the predicate to find

***

### urTag?

> `optional` **urTag**: `number` \| `bigint`

Defined in: [cmd/assertion/find/predicate.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/find/predicate.ts#L20)

Optional integer tag for an enclosed UR

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/assertion/find/predicate.ts:22](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/find/predicate.ts#L22)

The envelope to search
