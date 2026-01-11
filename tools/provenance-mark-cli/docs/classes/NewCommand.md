[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / NewCommand

# Class: NewCommand

Defined in: [cmd/new.ts:140](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L140)

New command implementation.

Corresponds to Rust `impl Exec for CommandArgs`

## Implements

- [`Exec`](../interfaces/Exec.md)

## Constructors

### Constructor

> **new NewCommand**(`args`): `NewCommand`

Defined in: [cmd/new.ts:143](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L143)

#### Parameters

##### args

[`NewCommandArgs`](../interfaces/NewCommandArgs.md)

#### Returns

`NewCommand`

## Methods

### exec()

> **exec**(): `string`

Defined in: [cmd/new.ts:147](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/new.ts#L147)

Execute the command and return the output string.

#### Returns

`string`

#### Throws

Error if the command fails

#### Implementation of

[`Exec`](../interfaces/Exec.md).[`exec`](../interfaces/Exec.md#exec)
