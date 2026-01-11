[**@bcts/envelope-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/envelope-cli](../globals.md) / readPassword

# Function: readPassword()

> **readPassword**(`prompt`, `passwordOverride?`, `useAskpass?`): `Promise`\<`string`\>

Defined in: [utils.ts:34](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/utils.ts#L34)

Reads a password either from the provided argument, via the system's askpass
tool when enabled, or interactively via terminal prompt.

## Parameters

### prompt

`string`

The prompt to show the user

### passwordOverride?

`string`

An optional password string

### useAskpass?

`boolean` = `false`

Boolean flag to indicate if the system's askpass should be used

## Returns

`Promise`\<`string`\>

The password string
