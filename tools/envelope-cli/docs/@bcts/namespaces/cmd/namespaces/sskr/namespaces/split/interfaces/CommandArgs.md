[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [sskr](../../../README.md) / [split](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/sskr/split.ts:15](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sskr/split.ts#L15)

Command arguments for the split command.

## Properties

### groupThreshold

> **groupThreshold**: `number`

Defined in: [cmd/sskr/split.ts:17](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sskr/split.ts#L17)

The number of groups that must meet their threshold (1-16)

***

### groups

> **groups**: `string`[]

Defined in: [cmd/sskr/split.ts:19](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sskr/split.ts#L19)

Group specifications (e.g., "2-of-3")

***

### key?

> `optional` **key**: `string`

Defined in: [cmd/sskr/split.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sskr/split.ts#L21)

The symmetric key to use for encryption

***

### recipients

> **recipients**: `string`[]

Defined in: [cmd/sskr/split.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sskr/split.ts#L23)

Public keys to also encrypt the message to

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/sskr/split.ts:25](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sskr/split.ts#L25)

The envelope to split
