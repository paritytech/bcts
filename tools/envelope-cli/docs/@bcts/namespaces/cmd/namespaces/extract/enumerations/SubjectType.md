[**@bcts/envelope-cli v1.0.0-alpha.14**](../../../../../../README.md)

***

[@bcts/envelope-cli](../../../../../../globals.md) / [cmd](../../../README.md) / [extract](../README.md) / SubjectType

# Enumeration: SubjectType

Defined in: [cmd/extract.ts:41](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L41)

Subject types that can be extracted.

## Enumeration Members

### Assertion

> **Assertion**: `"assertion"`

Defined in: [cmd/extract.ts:43](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L43)

Extract as assertion (predicate and object)

***

### Object

> **Object**: `"object"`

Defined in: [cmd/extract.ts:45](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L45)

Extract object from assertion

***

### Predicate

> **Predicate**: `"predicate"`

Defined in: [cmd/extract.ts:47](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L47)

Extract predicate from assertion

***

### Arid

> **Arid**: `"arid"`

Defined in: [cmd/extract.ts:49](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L49)

ARID: Apparently Random Identifier (ur:arid)

***

### AridHex

> **AridHex**: `"arid-hex"`

Defined in: [cmd/extract.ts:51](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L51)

ARID: Apparently Random Identifier (hex)

***

### Bool

> **Bool**: `"bool"`

Defined in: [cmd/extract.ts:53](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L53)

Boolean value

***

### Cbor

> **Cbor**: `"cbor"`

Defined in: [cmd/extract.ts:55](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L55)

CBOR data in hex

***

### Data

> **Data**: `"data"`

Defined in: [cmd/extract.ts:57](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L57)

Binary byte string in hex

***

### Date

> **Date**: `"date"`

Defined in: [cmd/extract.ts:59](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L59)

Date (ISO 8601)

***

### Digest

> **Digest**: `"digest"`

Defined in: [cmd/extract.ts:61](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L61)

Cryptographic digest (ur:digest)

***

### Envelope

> **Envelope**: `"envelope"`

Defined in: [cmd/extract.ts:63](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L63)

Envelope (ur:envelope)

***

### Known

> **Known**: `"known"`

Defined in: [cmd/extract.ts:65](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L65)

Known Value (number or string)

***

### Number

> **Number**: `"number"`

Defined in: [cmd/extract.ts:67](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L67)

Numeric value

***

### String

> **String**: `"string"`

Defined in: [cmd/extract.ts:69](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L69)

UTF-8 String

***

### Ur

> **Ur**: `"ur"`

Defined in: [cmd/extract.ts:71](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L71)

Uniform Resource (UR)

***

### Uri

> **Uri**: `"uri"`

Defined in: [cmd/extract.ts:73](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L73)

URI

***

### Uuid

> **Uuid**: `"uuid"`

Defined in: [cmd/extract.ts:75](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L75)

UUID

***

### Wrapped

> **Wrapped**: `"wrapped"`

Defined in: [cmd/extract.ts:77](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L77)

Wrapped Envelope (ur:envelope)

***

### Xid

> **Xid**: `"xid"`

Defined in: [cmd/extract.ts:79](https://github.com/leonardocustodio/bcts/blob/2a6798e8dee2ec11e751201c976e33bcdab2b066/packages/envelope-cli/src/cmd/extract.ts#L79)

XID
