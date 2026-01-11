[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [digest](../README.md) / Depth

# Enumeration: Depth

Defined in: [cmd/digest.ts:14](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/digest.ts#L14)

Depth options for digest extraction.

## Enumeration Members

### Top

> **Top**: `"top"`

Defined in: [cmd/digest.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/digest.ts#L16)

Return just the envelope's top digest

***

### Shallow

> **Shallow**: `"shallow"`

Defined in: [cmd/digest.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/digest.ts#L18)

Return the digests necessary to reveal the subject

***

### Deep

> **Deep**: `"deep"`

Defined in: [cmd/digest.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/digest.ts#L20)

Return the digests needed to reveal the entire contents of the envelope
