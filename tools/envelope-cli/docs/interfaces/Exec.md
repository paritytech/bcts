[**@bcts/envelope-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/envelope-cli](../globals.md) / Exec

# Interface: Exec

Defined in: [exec.ts:17](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/exec.ts#L17)

Interface that all CLI commands implement.
Each command's exec() method returns a string output.

## Methods

### exec()

> **exec**(): `string`

Defined in: [exec.ts:22](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/exec.ts#L22)

Execute the command and return the output string.

#### Returns

`string`

#### Throws

Error if the command fails
