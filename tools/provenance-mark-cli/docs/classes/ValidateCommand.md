[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / ValidateCommand

# Class: ValidateCommand

Defined in: [cmd/validate.ts:97](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L97)

Validate command implementation.

Corresponds to Rust `impl Exec for CommandArgs`

## Implements

- [`Exec`](../interfaces/Exec.md)

## Constructors

### Constructor

> **new ValidateCommand**(`args`): `ValidateCommand`

Defined in: [cmd/validate.ts:100](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L100)

#### Parameters

##### args

[`ValidateCommandArgs`](../interfaces/ValidateCommandArgs.md)

#### Returns

`ValidateCommand`

## Methods

### exec()

> **exec**(): `string`

Defined in: [cmd/validate.ts:104](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L104)

Execute the command and return the output string.

#### Returns

`string`

#### Throws

Error if the command fails

#### Implementation of

[`Exec`](../interfaces/Exec.md).[`exec`](../interfaces/Exec.md#exec)
