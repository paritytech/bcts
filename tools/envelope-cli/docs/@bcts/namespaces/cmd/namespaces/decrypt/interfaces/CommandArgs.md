[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [decrypt](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/decrypt.ts:47](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L47)

Command arguments for the decrypt command.

## Properties

### key?

> `optional` **key**: `string`

Defined in: [cmd/decrypt.ts:49](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L49)

The symmetric key to use to decrypt the envelope's subject (ur:crypto-key)

***

### password?

> `optional` **password**: `string`

Defined in: [cmd/decrypt.ts:51](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L51)

The password to derive the symmetric key

***

### askpass

> **askpass**: `boolean`

Defined in: [cmd/decrypt.ts:53](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L53)

Use SSH_ASKPASS to read the password

***

### recipient?

> `optional` **recipient**: `string`

Defined in: [cmd/decrypt.ts:55](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L55)

The recipient's private key (ur:crypto-prvkey-base or ur:crypto-prvkeys)

***

### sshId?

> `optional` **sshId**: `string`

Defined in: [cmd/decrypt.ts:57](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L57)

The SSH identity to use to decrypt the envelope's subject

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/decrypt.ts:59](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L59)

The envelope to decrypt
