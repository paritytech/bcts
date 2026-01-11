[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [exportCmd](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/export.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L21)

Command arguments for the export command.

## Properties

### urString?

> `optional` **urString**: `string`

Defined in: [cmd/export.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L23)

The UR to be exported

***

### encrypt

> **encrypt**: `boolean`

Defined in: [cmd/export.ts:25](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L25)

Whether to encrypt the SSH private key

***

### password?

> `optional` **password**: `string`

Defined in: [cmd/export.ts:27](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L27)

The password to encrypt an SSH private key

***

### askpass

> **askpass**: `boolean`

Defined in: [cmd/export.ts:29](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L29)

Use SSH_ASKPASS to read the password
