[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [verify](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/verify.ts:14](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/verify.ts#L14)

Command arguments for the verify command.

## Properties

### silent

> **silent**: `boolean`

Defined in: [cmd/verify.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/verify.ts#L16)

Don't output the envelope's UR on success

***

### threshold

> **threshold**: `number`

Defined in: [cmd/verify.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/verify.ts#L18)

The minimum number of required valid signatures

***

### verifiers

> **verifiers**: `string`[]

Defined in: [cmd/verify.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/verify.ts#L20)

The verifier(s)

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/verify.ts:22](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/verify.ts#L22)

The envelope to verify
