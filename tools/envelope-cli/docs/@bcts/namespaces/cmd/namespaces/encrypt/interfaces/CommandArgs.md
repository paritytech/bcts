[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [encrypt](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/encrypt.ts:54](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L54)

Command arguments for the encrypt command.

## Properties

### key?

> `optional` **key**: `string`

Defined in: [cmd/encrypt.ts:56](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L56)

The content key to use to encrypt the envelope's subject (ur:crypto-key)

***

### password?

> `optional` **password**: `string`

Defined in: [cmd/encrypt.ts:58](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L58)

A password used to lock the content key

***

### askpass

> **askpass**: `boolean`

Defined in: [cmd/encrypt.ts:60](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L60)

Use SSH_ASKPASS to read the password

***

### passwordDerivation

> **passwordDerivation**: [`PasswordDerivationType`](../enumerations/PasswordDerivationType.md)

Defined in: [cmd/encrypt.ts:62](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L62)

The password-based key derivation algorithm

***

### sshId?

> `optional` **sshId**: `string`

Defined in: [cmd/encrypt.ts:64](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L64)

The SSH agent key identity used to lock the content key

***

### recipients

> **recipients**: `string`[]

Defined in: [cmd/encrypt.ts:66](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L66)

The recipients to whom the envelope's subject should be encrypted (ur:crypto-pubkeys)

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/encrypt.ts:68](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L68)

The envelope to encrypt
