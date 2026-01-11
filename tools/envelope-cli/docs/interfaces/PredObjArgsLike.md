[**@bcts/envelope-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/envelope-cli](../globals.md) / PredObjArgsLike

# Interface: PredObjArgsLike

Defined in: [pred-obj-args.ts:13](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L13)

Interface for arguments that include a predicate and object.

## Extended by

- [`CommandArgs`](../@bcts/namespaces/cmd/namespaces/assertion/namespaces/create/interfaces/CommandArgs.md)
- [`CommandArgs`](../@bcts/namespaces/cmd/namespaces/assertion/namespaces/add/namespaces/predObj/interfaces/CommandArgs.md)
- [`CommandArgs`](../@bcts/namespaces/cmd/namespaces/assertion/namespaces/remove/namespaces/predObj/interfaces/CommandArgs.md)

## Properties

### predType

> **predType**: [`DataType`](../enumerations/DataType.md)

Defined in: [pred-obj-args.ts:15](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L15)

Predicate type

***

### predValue

> **predValue**: `string`

Defined in: [pred-obj-args.ts:17](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L17)

Predicate value

***

### objType

> **objType**: [`DataType`](../enumerations/DataType.md)

Defined in: [pred-obj-args.ts:19](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L19)

Object type

***

### objValue

> **objValue**: `string`

Defined in: [pred-obj-args.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L21)

Object value

***

### predTag?

> `optional` **predTag**: `number` \| `bigint`

Defined in: [pred-obj-args.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L23)

Optional integer tag for the predicate provided as an enclosed UR

***

### objTag?

> `optional` **objTag**: `number` \| `bigint`

Defined in: [pred-obj-args.ts:25](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L25)

Optional integer tag for the object provided as an enclosed UR
