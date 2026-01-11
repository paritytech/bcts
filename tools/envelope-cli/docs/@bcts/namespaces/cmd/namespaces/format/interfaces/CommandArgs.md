[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [format](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/format.ts:65](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L65)

Command arguments for the format command.

## Properties

### type

> **type**: [`FormatType`](../enumerations/FormatType.md)

Defined in: [cmd/format.ts:67](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L67)

Output format type

***

### hideNodes

> **hideNodes**: `boolean`

Defined in: [cmd/format.ts:69](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L69)

For `tree` and `mermaid`, hides the NODE case and digests

***

### digestFormat

> **digestFormat**: [`DigestFormatType`](../enumerations/DigestFormatType.md)

Defined in: [cmd/format.ts:71](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L71)

For `tree`, specifies the format for displaying digests

***

### theme

> **theme**: [`MermaidThemeType`](../enumerations/MermaidThemeType.md)

Defined in: [cmd/format.ts:73](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L73)

For `mermaid`, specifies the color theme of the diagram

***

### orientation

> **orientation**: [`MermaidOrientationType`](../enumerations/MermaidOrientationType.md)

Defined in: [cmd/format.ts:75](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L75)

For `mermaid`, specifies the orientation of the diagram

***

### monochrome

> **monochrome**: `boolean`

Defined in: [cmd/format.ts:77](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L77)

For `mermaid`, do not color the nodes or edges

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/format.ts:79](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/format.ts#L79)

The envelope to format
