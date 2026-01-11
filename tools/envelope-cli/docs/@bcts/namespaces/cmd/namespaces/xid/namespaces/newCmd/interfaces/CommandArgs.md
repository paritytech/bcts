[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [xid](../../../README.md) / [newCmd](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/xid/new.ts:40](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L40)

Command arguments for the new command.

## Properties

### keys?

> `optional` **keys**: `string`

Defined in: [cmd/xid/new.ts:42](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L42)

The inception key (ur:crypto-prvkeys, ur:crypto-pubkeys, or ur:prvkeys)

***

### nickname

> **nickname**: `string`

Defined in: [cmd/xid/new.ts:44](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L44)

Nickname for the key

***

### privateOpts

> **privateOpts**: [`PrivateOptions`](../enumerations/PrivateOptions.md)

Defined in: [cmd/xid/new.ts:46](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L46)

Private key options

***

### generatorOpts

> **generatorOpts**: [`GeneratorOptions`](../enumerations/GeneratorOptions.md)

Defined in: [cmd/xid/new.ts:48](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L48)

Generator options

***

### endpoints

> **endpoints**: `string`[]

Defined in: [cmd/xid/new.ts:50](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L50)

Endpoints for the key

***

### permissions

> **permissions**: `string`[]

Defined in: [cmd/xid/new.ts:52](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L52)

Permissions for the key

***

### password?

> `optional` **password**: `string`

Defined in: [cmd/xid/new.ts:54](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L54)

Password for encryption

***

### date?

> `optional` **date**: `string`

Defined in: [cmd/xid/new.ts:56](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L56)

Date for genesis mark

***

### info?

> `optional` **info**: `string`

Defined in: [cmd/xid/new.ts:58](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/new.ts#L58)

Additional info for genesis mark
