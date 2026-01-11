[**@bcts/envelope-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/envelope-cli](../globals.md) / SubjectArgsLike

# Interface: SubjectArgsLike

Defined in: [subject-args.ts:13](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/subject-args.ts#L13)

Interface for arguments that include a subject.

## Properties

### subjectType

> **subjectType**: [`DataType`](../enumerations/DataType.md)

Defined in: [subject-args.ts:15](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/subject-args.ts#L15)

Subject type

***

### subjectValue?

> `optional` **subjectValue**: `string`

Defined in: [subject-args.ts:17](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/subject-args.ts#L17)

Subject value (optional - can be read from stdin)

***

### urTag?

> `optional` **urTag**: `number` \| `bigint`

Defined in: [subject-args.ts:19](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/subject-args.ts#L19)

Optional integer tag for an enclosed UR
