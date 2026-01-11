[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [xid](../../../README.md) / [exportCmd](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/xid/export.ts:29](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/export.ts#L29)

Command arguments for the export command.

## Properties

### format

> **format**: [`ExportFormat`](../enumerations/ExportFormat.md)

Defined in: [cmd/xid/export.ts:31](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/export.ts#L31)

Output format

***

### verifySignature

> **verifySignature**: `boolean`

Defined in: [cmd/xid/export.ts:33](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/export.ts#L33)

Whether to verify the signature (not yet implemented)

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/xid/export.ts:35](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/xid/export.ts#L35)

The XID document envelope
