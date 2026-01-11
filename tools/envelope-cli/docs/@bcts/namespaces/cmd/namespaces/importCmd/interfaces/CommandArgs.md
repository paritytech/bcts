[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [importCmd](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/import.ts:19](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/import.ts#L19)

Command arguments for the import command.

## Properties

### object?

> `optional` **object**: `string`

Defined in: [cmd/import.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/import.ts#L21)

The object to be imported into UR form

***

### password?

> `optional` **password**: `string`

Defined in: [cmd/import.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/import.ts#L23)

The password to decrypt the SSH private key

***

### askpass

> **askpass**: `boolean`

Defined in: [cmd/import.ts:25](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/import.ts#L25)

Use SSH_ASKPASS to read the password
