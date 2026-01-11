[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [elide](../../../README.md) / [removing](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/elide/removing.ts:14](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/removing.ts#L14)

Command arguments for the removing command.

## Extends

- [`ElideArgsLike`](../../../interfaces/ElideArgsLike.md)

## Properties

### action

> **action**: [`Action`](../../../enumerations/Action.md)

Defined in: [cmd/elide/elide-args.ts:28](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/elide-args.ts#L28)

The action to take

#### Inherited from

[`ElideArgsLike`](../../../interfaces/ElideArgsLike.md).[`action`](../../../interfaces/ElideArgsLike.md#action)

***

### key?

> `optional` **key**: `string`

Defined in: [cmd/elide/elide-args.ts:30](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/elide-args.ts#L30)

The encryption key (ur:crypto-key) when action is encrypt

#### Inherited from

[`ElideArgsLike`](../../../interfaces/ElideArgsLike.md).[`key`](../../../interfaces/ElideArgsLike.md#key)

***

### target

> **target**: `string`

Defined in: [cmd/elide/elide-args.ts:32](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/elide-args.ts#L32)

The target set of digests

#### Inherited from

[`ElideArgsLike`](../../../interfaces/ElideArgsLike.md).[`target`](../../../interfaces/ElideArgsLike.md#target)

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/elide/removing.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/removing.ts#L16)

The envelope to elide
