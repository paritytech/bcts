[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / PrintCommand

# Class: PrintCommand

Defined in: [cmd/print.ts:47](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L47)

Print command implementation.

Corresponds to Rust `impl Exec for CommandArgs`

## Implements

- [`Exec`](../interfaces/Exec.md)

## Constructors

### Constructor

> **new PrintCommand**(`args`): `PrintCommand`

Defined in: [cmd/print.ts:50](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L50)

#### Parameters

##### args

[`PrintCommandArgs`](../interfaces/PrintCommandArgs.md)

#### Returns

`PrintCommand`

## Methods

### exec()

> **exec**(): `string`

Defined in: [cmd/print.ts:54](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/print.ts#L54)

Execute the command and return the output string.

#### Returns

`string`

#### Throws

Error if the command fails

#### Implementation of

[`Exec`](../interfaces/Exec.md).[`exec`](../interfaces/Exec.md#exec)
