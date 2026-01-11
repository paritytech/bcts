[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../../../globals.md) / [cmd](../../../../../README.md) / [generate](../../../README.md) / [prvKeys](../README.md) / CommandArgs

# Interface: CommandArgs

Defined in: [cmd/generate/prv-keys.ts:38](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/prv-keys.ts#L38)

Command arguments for the prv-keys command.

## Properties

### input?

> `optional` **input**: `string`

Defined in: [cmd/generate/prv-keys.ts:40](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/prv-keys.ts#L40)

Optional input from which to derive the private keys

***

### signing

> **signing**: [`SigningScheme`](../enumerations/SigningScheme.md)

Defined in: [cmd/generate/prv-keys.ts:42](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/prv-keys.ts#L42)

The signature scheme to use for the signing key

***

### encryption

> **encryption**: [`X25519`](../enumerations/EncryptionScheme.md#x25519)

Defined in: [cmd/generate/prv-keys.ts:44](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/generate/prv-keys.ts#L44)

The encapsulation scheme to use for the encryption key
