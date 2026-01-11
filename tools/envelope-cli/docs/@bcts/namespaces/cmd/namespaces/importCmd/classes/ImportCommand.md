[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [importCmd](../README.md) / ImportCommand

# Class: ImportCommand

Defined in: [cmd/import.ts:40](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/import.ts#L40)

Import command implementation.

## Implements

- [`ExecAsync`](../../../../../../interfaces/ExecAsync.md)

## Constructors

### Constructor

> **new ImportCommand**(`args`): `ImportCommand`

Defined in: [cmd/import.ts:41](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/import.ts#L41)

#### Parameters

##### args

[`CommandArgs`](../interfaces/CommandArgs.md)

#### Returns

`ImportCommand`

## Methods

### exec()

> **exec**(): `Promise`\<`string`\>

Defined in: [cmd/import.ts:44](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/import.ts#L44)

Execute the command asynchronously and return the output string.

#### Returns

`Promise`\<`string`\>

#### Throws

Error if the command fails

#### Implementation of

[`ExecAsync`](../../../../../../interfaces/ExecAsync.md).[`exec`](../../../../../../interfaces/ExecAsync.md#exec)
