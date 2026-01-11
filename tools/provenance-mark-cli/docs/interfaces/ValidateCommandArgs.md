[**@bcts/provenance-mark-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/provenance-mark-cli](../globals.md) / ValidateCommandArgs

# Interface: ValidateCommandArgs

Defined in: [cmd/validate.ts:70](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L70)

Arguments for the validate command.

Corresponds to Rust `CommandArgs`

## Properties

### marks

> **marks**: `string`[]

Defined in: [cmd/validate.ts:72](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L72)

One or more provenance mark URs to validate.

***

### dir?

> `optional` **dir**: `string`

Defined in: [cmd/validate.ts:74](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L74)

Path to a chain directory containing marks to validate.

***

### warn

> **warn**: `boolean`

Defined in: [cmd/validate.ts:76](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L76)

Report issues as warnings without failing.

***

### format

> **format**: [`ValidateFormat`](../enumerations/ValidateFormat.md)

Defined in: [cmd/validate.ts:78](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/provenance-mark-cli/src/cmd/validate.ts#L78)

Output format for the validation report.
