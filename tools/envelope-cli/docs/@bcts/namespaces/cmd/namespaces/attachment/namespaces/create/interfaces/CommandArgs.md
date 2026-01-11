[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [attachment](../../../README.md) / [create](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/attachment/create.ts:14](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/attachment/create.ts#L14)

Command arguments for the create command.

## Properties

### vendor

> **vendor**: `string`

Defined in: [cmd/attachment/create.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/attachment/create.ts#L16)

The vendor of the attachment. Usually a reverse domain name.

***

### conformsTo?

> `optional` **conformsTo**: `string`

Defined in: [cmd/attachment/create.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/attachment/create.ts#L18)

An optional conforms-to value of the attachment. Usually a URI.

***

### payload?

> `optional` **payload**: `string`

Defined in: [cmd/attachment/create.ts:20](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/attachment/create.ts#L20)

The payload of the attachment. Entirely defined by the vendor.
