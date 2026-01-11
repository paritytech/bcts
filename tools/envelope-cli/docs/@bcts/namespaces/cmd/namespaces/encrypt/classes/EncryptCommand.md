[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [encrypt](../README.md) / EncryptCommand

# Class: EncryptCommand

Defined in: [cmd/encrypt.ts:85](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L85)

Encrypt command implementation.

## Implements

- [`ExecAsync`](../../../../../../interfaces/ExecAsync.md)

## Constructors

### Constructor

> **new EncryptCommand**(`args`): `EncryptCommand`

Defined in: [cmd/encrypt.ts:86](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L86)

#### Parameters

##### args

[`CommandArgs`](../interfaces/CommandArgs.md)

#### Returns

`EncryptCommand`

## Methods

### exec()

> **exec**(): `Promise`\<`string`\>

Defined in: [cmd/encrypt.ts:88](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L88)

Execute the command asynchronously and return the output string.

#### Returns

`Promise`\<`string`\>

#### Throws

Error if the command fails

#### Implementation of

[`ExecAsync`](../../../../../../interfaces/ExecAsync.md).[`exec`](../../../../../../interfaces/ExecAsync.md#exec)
