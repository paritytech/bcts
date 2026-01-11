[**@bcts/dcbor-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/dcbor-cli](../globals.md) / MatchCommandArgs

# Interface: MatchCommandArgs

Defined in: [cmd/match.ts:28](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L28)

Command arguments for match command

## Properties

### pattern

> **pattern**: `string`

Defined in: [cmd/match.ts:30](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L30)

The pattern to match against

***

### input?

> `optional` **input**: `string`

Defined in: [cmd/match.ts:32](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L32)

dCBOR input (hex, diag, or binary). If not provided, reads from stdin

***

### in

> **in**: [`InputFormat`](../type-aliases/InputFormat.md)

Defined in: [cmd/match.ts:34](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L34)

Input format (default: diag)

***

### out

> **out**: [`MatchOutputFormat`](../type-aliases/MatchOutputFormat.md)

Defined in: [cmd/match.ts:36](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L36)

Output format (default: paths)

***

### noIndent

> **noIndent**: `boolean`

Defined in: [cmd/match.ts:38](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L38)

Disable indentation of path elements

***

### lastOnly

> **lastOnly**: `boolean`

Defined in: [cmd/match.ts:40](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L40)

Show only the last element of each path

***

### annotate

> **annotate**: `boolean`

Defined in: [cmd/match.ts:42](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L42)

Add annotations to output

***

### captures

> **captures**: `boolean`

Defined in: [cmd/match.ts:44](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/cmd/match.ts#L44)

Include capture information in output
