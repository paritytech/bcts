[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [encrypt](../README.md) / PasswordDerivationType

# Enumeration: PasswordDerivationType

Defined in: [cmd/encrypt.ts:28](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L28)

Password-based key derivation algorithms supported for encryption.

## Enumeration Members

### Argon2id

> **Argon2id**: `"argon2id"`

Defined in: [cmd/encrypt.ts:30](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L30)

Argon2id key derivation (default)

***

### PBKDF2

> **PBKDF2**: `"pbkdf2"`

Defined in: [cmd/encrypt.ts:32](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L32)

PBKDF2 key derivation

***

### Scrypt

> **Scrypt**: `"scrypt"`

Defined in: [cmd/encrypt.ts:34](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/encrypt.ts#L34)

Scrypt key derivation
