[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [salt](../README.md) / SaltCommand

# Class: SaltCommand

Defined in: [cmd/salt.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/salt.ts#L23)

Salt command implementation.

## Implements

- [`Exec`](../../../../../../interfaces/Exec.md)

## Constructors

### Constructor

> **new SaltCommand**(`args`): `SaltCommand`

Defined in: [cmd/salt.ts:24](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/salt.ts#L24)

#### Parameters

##### args

[`CommandArgs`](../interfaces/CommandArgs.md)

#### Returns

`SaltCommand`

## Methods

### exec()

> **exec**(): `string`

Defined in: [cmd/salt.ts:26](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/salt.ts#L26)

Execute the command and return the output string.

#### Returns

`string`

#### Throws

Error if the command fails

#### Implementation of

[`Exec`](../../../../../../interfaces/Exec.md).[`exec`](../../../../../../interfaces/Exec.md#exec)
