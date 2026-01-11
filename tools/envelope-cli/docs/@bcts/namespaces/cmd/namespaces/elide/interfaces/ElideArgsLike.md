[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [elide](../README.md) / ElideArgsLike

# Interface: ElideArgsLike

Defined in: [cmd/elide/elide-args.ts:26](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/elide-args.ts#L26)

Interface for elide arguments.

## Extended by

- [`CommandArgs`](../namespaces/removing/interfaces/CommandArgs.md)
- [`CommandArgs`](../namespaces/revealing/interfaces/CommandArgs.md)

## Properties

### action

> **action**: [`Action`](../enumerations/Action.md)

Defined in: [cmd/elide/elide-args.ts:28](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/elide-args.ts#L28)

The action to take

***

### key?

> `optional` **key**: `string`

Defined in: [cmd/elide/elide-args.ts:30](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/elide-args.ts#L30)

The encryption key (ur:crypto-key) when action is encrypt

***

### target

> **target**: `string`

Defined in: [cmd/elide/elide-args.ts:32](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/elide/elide-args.ts#L32)

The target set of digests
