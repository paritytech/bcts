[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / NextCommand

# Class: NextCommand

Defined in: [cmd/next.ts:54](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L54)

Next command implementation.

Corresponds to Rust `impl Exec for CommandArgs`

## Implements

- [`Exec`](../interfaces/Exec.md)

## Constructors

### Constructor

> **new NextCommand**(`args`): `NextCommand`

Defined in: [cmd/next.ts:57](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L57)

#### Parameters

##### args

[`NextCommandArgs`](../interfaces/NextCommandArgs.md)

#### Returns

`NextCommand`

## Methods

### exec()

> **exec**(): `string`

Defined in: [cmd/next.ts:61](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/next.ts#L61)

Execute the command and return the output string.

#### Returns

`string`

#### Throws

Error if the command fails

#### Implementation of

[`Exec`](../interfaces/Exec.md).[`exec`](../interfaces/Exec.md#exec)
