[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [pattern](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/pattern.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L21)

Command arguments for the pattern command.

## Properties

### pattern

> **pattern**: `string`

Defined in: [cmd/pattern.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L23)

The pattern to be matched

***

### noIndent

> **noIndent**: `boolean`

Defined in: [cmd/pattern.ts:25](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L25)

Disable indentation of path elements

***

### lastOnly

> **lastOnly**: `boolean`

Defined in: [cmd/pattern.ts:27](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L27)

Format only the last element of each path

***

### envelopes

> **envelopes**: `boolean`

Defined in: [cmd/pattern.ts:29](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L29)

Format path elements as envelope URs

***

### digests

> **digests**: `boolean`

Defined in: [cmd/pattern.ts:31](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L31)

Format path elements as digest URs

***

### summary

> **summary**: `boolean`

Defined in: [cmd/pattern.ts:33](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L33)

Format path elements as summary

***

### maxLength?

> `optional` **maxLength**: `number`

Defined in: [cmd/pattern.ts:35](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L35)

Maximum length for summary truncation

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/pattern.ts:37](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/pattern.ts#L37)

The envelope to match against
