[**@bcts/dcbor-cli v1.0.0-alpha.14**](../README.md)

***

[@bcts/dcbor-cli](../globals.md) / Command

# Type Alias: Command

> **Command** = \{ `type`: `"array"`; `elements`: `string`[]; `out`: [`OutputFormat`](OutputFormat.md); `annotate`: `boolean`; \} \| \{ `type`: `"map"`; `kvPairs`: `string`[]; `out`: [`OutputFormat`](OutputFormat.md); `annotate`: `boolean`; \} \| \{ `type`: `"match"`; `pattern`: `string`; `input?`: `string`; `in`: [`InputFormat`](InputFormat.md); `out`: [`MatchOutputFormat`](MatchOutputFormat.md); `noIndent`: `boolean`; `lastOnly`: `boolean`; `annotate`: `boolean`; `captures`: `boolean`; \} \| \{ `type`: `"default"`; `input?`: `string`; `in`: [`InputFormat`](InputFormat.md); `out`: [`OutputFormat`](OutputFormat.md); `annotate`: `boolean`; \}

Defined in: [run.ts:13](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/dcbor-cli/src/run.ts#L13)

Command type discriminator
