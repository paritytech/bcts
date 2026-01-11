[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../../../globals.md) / [cmd](../../../../../../../README.md) / [assertion](../../../../../README.md) / [add](../../../README.md) / [predObj](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/assertion/add/pred-obj.ts:14](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/add/pred-obj.ts#L14)

Command arguments for the add pred-obj command.

## Extends

- [`PredObjArgsLike`](../../../../../../../../../../interfaces/PredObjArgsLike.md)

## Properties

### salted

> **salted**: `boolean`

Defined in: [cmd/assertion/add/pred-obj.ts:16](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/add/pred-obj.ts#L16)

Whether to add salt to the assertion

***

### envelope?

> `optional` **envelope**: `string`

Defined in: [cmd/assertion/add/pred-obj.ts:18](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/assertion/add/pred-obj.ts#L18)

The envelope to add the assertion to

***

### predType

> **predType**: [`DataType`](../../../../../../../../../../enumerations/DataType.md)

Defined in: [pred-obj-args.ts:15](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L15)

Predicate type

#### Inherited from

[`PredObjArgsLike`](../../../../../../../../../../interfaces/PredObjArgsLike.md).[`predType`](../../../../../../../../../../interfaces/PredObjArgsLike.md#predtype)

***

### predValue

> **predValue**: `string`

Defined in: [pred-obj-args.ts:17](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L17)

Predicate value

#### Inherited from

[`PredObjArgsLike`](../../../../../../../../../../interfaces/PredObjArgsLike.md).[`predValue`](../../../../../../../../../../interfaces/PredObjArgsLike.md#predvalue)

***

### objType

> **objType**: [`DataType`](../../../../../../../../../../enumerations/DataType.md)

Defined in: [pred-obj-args.ts:19](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L19)

Object type

#### Inherited from

[`PredObjArgsLike`](../../../../../../../../../../interfaces/PredObjArgsLike.md).[`objType`](../../../../../../../../../../interfaces/PredObjArgsLike.md#objtype)

***

### objValue

> **objValue**: `string`

Defined in: [pred-obj-args.ts:21](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L21)

Object value

#### Inherited from

[`PredObjArgsLike`](../../../../../../../../../../interfaces/PredObjArgsLike.md).[`objValue`](../../../../../../../../../../interfaces/PredObjArgsLike.md#objvalue)

***

### predTag?

> `optional` **predTag**: `number` \| `bigint`

Defined in: [pred-obj-args.ts:23](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L23)

Optional integer tag for the predicate provided as an enclosed UR

#### Inherited from

[`PredObjArgsLike`](../../../../../../../../../../interfaces/PredObjArgsLike.md).[`predTag`](../../../../../../../../../../interfaces/PredObjArgsLike.md#predtag)

***

### objTag?

> `optional` **objTag**: `number` \| `bigint`

Defined in: [pred-obj-args.ts:25](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/pred-obj-args.ts#L25)

Optional integer tag for the object provided as an enclosed UR

#### Inherited from

[`PredObjArgsLike`](../../../../../../../../../../interfaces/PredObjArgsLike.md).[`objTag`](../../../../../../../../../../interfaces/PredObjArgsLike.md#objtag)
