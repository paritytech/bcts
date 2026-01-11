[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [sign](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/sign.ts:26](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sign.ts#L26)

Command arguments for the sign command.

## Properties

### signers

> **signers**: `string`[]

Defined in: [cmd/sign.ts:28](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sign.ts#L28)

The signer(s) to sign the envelope subject with

***

### note?

> `optional` **note**: `string`

Defined in: [cmd/sign.ts:30](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sign.ts#L30)

An optional note to add to the envelope

***

### namespace

> **namespace**: `string`

Defined in: [cmd/sign.ts:32](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sign.ts#L32)

Namespace for SSH signatures

***

### hashType

> **hashType**: [`HashType`](../enumerations/HashType.md)

Defined in: [cmd/sign.ts:34](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sign.ts#L34)

Hash algorithm for SSH signatures

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/sign.ts:36](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/sign.ts#L36)

The envelope to sign
