[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [decrypt](../README.md) / DecryptCommand

# Class: DecryptCommand

Defined in: [cmd/decrypt.ts:74](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L74)

Decrypt command implementation.

## Implements

- [`ExecAsync`](../../../../../../interfaces/ExecAsync.md)

## Constructors

### Constructor

> **new DecryptCommand**(`args`): `DecryptCommand`

Defined in: [cmd/decrypt.ts:75](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L75)

#### Parameters

##### args

[`CommandArgs`](../interfaces/CommandArgs.md)

#### Returns

`DecryptCommand`

## Methods

### exec()

> **exec**(): `Promise`\<`string`\>

Defined in: [cmd/decrypt.ts:78](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/decrypt.ts#L78)

Execute the command asynchronously and return the output string.

#### Returns

`Promise`\<`string`\>

#### Throws

Error if the command fails

#### Implementation of

[`ExecAsync`](../../../../../../interfaces/ExecAsync.md).[`exec`](../../../../../../interfaces/ExecAsync.md#exec)
