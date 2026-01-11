[**@bcts/dcbor-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/dcbor-cli](../globals.md) / DefaultCommandArgs

# Interface: DefaultCommandArgs

Defined in: [cmd/default.ts:15](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/default.ts#L15)

Command arguments for default parsing behavior

## Properties

### input?

> `optional` **input**: `string`

Defined in: [cmd/default.ts:17](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/default.ts#L17)

Input dCBOR in the format specified by `in`. Optional - reads from stdin if not provided

***

### in

> **in**: [`InputFormat`](../type-aliases/InputFormat.md)

Defined in: [cmd/default.ts:19](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/default.ts#L19)

The input format (default: diag)

***

### out

> **out**: [`OutputFormat`](../type-aliases/OutputFormat.md)

Defined in: [cmd/default.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/default.ts#L21)

The output format (default: hex)

***

### annotate

> **annotate**: `boolean`

Defined in: [cmd/default.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/default.ts#L23)

Output with annotations
