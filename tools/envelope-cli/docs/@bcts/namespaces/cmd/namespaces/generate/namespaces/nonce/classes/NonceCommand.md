[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [generate](../../../README.md) / [nonce](../README.md) / NonceCommand

# Class: NonceCommand

Defined in: [cmd/generate/nonce.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/nonce.ts#L18)

Nonce command implementation.

## Implements

- [`Exec`](../../../../../../../../interfaces/Exec.md)

## Constructors

### Constructor

> **new NonceCommand**(`_args`): `NonceCommand`

Defined in: [cmd/generate/nonce.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/nonce.ts#L20)

#### Parameters

##### \_args

[`CommandArgs`](../type-aliases/CommandArgs.md)

#### Returns

`NonceCommand`

## Methods

### exec()

> **exec**(): `string`

Defined in: [cmd/generate/nonce.ts:22](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/nonce.ts#L22)

Execute the command and return the output string.

#### Returns

`string`

#### Throws

Error if the command fails

#### Implementation of

[`Exec`](../../../../../../../../interfaces/Exec.md).[`exec`](../../../../../../../../interfaces/Exec.md#exec)
