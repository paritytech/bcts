[**@bcts/envelope-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/envelope-cli](../globals.md) / ExecAsync

# Interface: ExecAsync

Defined in: [exec.ts:28](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/exec.ts#L28)

Async version of the Exec interface for commands that need async operations.

## Methods

### exec()

> **exec**(): `Promise`\<`string`\>

Defined in: [exec.ts:33](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/exec.ts#L33)

Execute the command asynchronously and return the output string.

#### Returns

`Promise`\<`string`\>

#### Throws

Error if the command fails
