[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [exportCmd](../README.md) / ExportCommand

# Class: ExportCommand

Defined in: [cmd/export.ts:45](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L45)

Export command implementation.

## Implements

- [`ExecAsync`](../../../../../../interfaces/ExecAsync.md)

## Constructors

### Constructor

> **new ExportCommand**(`args`): `ExportCommand`

Defined in: [cmd/export.ts:46](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L46)

#### Parameters

##### args

[`CommandArgs`](../interfaces/CommandArgs.md)

#### Returns

`ExportCommand`

## Methods

### exec()

> **exec**(): `Promise`\<`string`\>

Defined in: [cmd/export.ts:48](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/export.ts#L48)

Execute the command asynchronously and return the output string.

#### Returns

`Promise`\<`string`\>

#### Throws

Error if the command fails

#### Implementation of

[`ExecAsync`](../../../../../../interfaces/ExecAsync.md).[`exec`](../../../../../../interfaces/ExecAsync.md#exec)
