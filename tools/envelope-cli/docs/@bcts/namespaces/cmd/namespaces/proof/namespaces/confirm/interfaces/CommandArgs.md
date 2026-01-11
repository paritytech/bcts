[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [proof](../../../README.md) / [confirm](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/proof/confirm.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/proof/confirm.ts#L16)

Command arguments for the confirm command.

## Properties

### proof

> **proof**: `string`

Defined in: [cmd/proof/confirm.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/proof/confirm.ts#L18)

The proof envelope to use

***

### target

> **target**: `string`

Defined in: [cmd/proof/confirm.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/proof/confirm.ts#L20)

The target set of digests (ur:digest or ur:envelope separated by space)

***

### silent

> **silent**: `boolean`

Defined in: [cmd/proof/confirm.ts:22](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/proof/confirm.ts#L22)

Don't output the envelope on success

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/proof/confirm.ts:24](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/proof/confirm.ts#L24)

The envelope to confirm
