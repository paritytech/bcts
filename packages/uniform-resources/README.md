# @blockchain-commons/uniform-resources

A TypeScript implementation of Blockchain Commons' Uniform Resources (URs) specification.

URs are URI-encoded CBOR objects designed for efficient transmission and storage of data on low-bandwidth systems like air-gapped devices. This library provides full support for encoding, decoding, and manipulating URs according to [BCR-2020-005: Uniform Resources](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md).

## Features

- **URI Encoding**: Encode CBOR data as Uniform Resource strings
- **Type Validation**: Ensure UR type compliance with the specification
- **Error Handling**: Comprehensive error types for debugging
- **Bytewords Support**: Convert bytes to human-readable word sequences
- **Bytemojis Support**: Convert bytes to emoji sequences for visual identification
- **Multipart Support**: Framework for fountain-code encoded multipart URs (alpha)
- **Type-Safe Interfaces**: UREncodable, URDecodable, and URCodable traits

## Installation

```bash
npm install @blockchain-commons/uniform-resources
```

Or with bun:

```bash
bun add @blockchain-commons/uniform-resources
```

## Quick Start

### Basic Usage

```typescript
import { UR } from '@blockchain-commons/uniform-resources';
import { cbor } from '@blockchain-commons/dcbor';

// Create a UR
const cborData = cbor(42);
const ur = UR.new('bytes', cborData);

// Encode to string
const urString = ur.string();
console.log(urString); // "ur:bytes/dava"

// Decode from string
const decodedUR = UR.fromURString(urString);
console.log(decodedUR.urTypeStr()); // "bytes"

// Get QR code representation (uppercase)
const qrString = ur.qrString();
console.log(qrString); // "UR:BYTES/DAVA"
```

### Type Validation

```typescript
import { URType, isValidURType } from '@blockchain-commons/uniform-resources';

// Valid UR types contain only lowercase letters, digits, and hyphens
const type = new URType('bytes'); // OK
const type = new URType('my-data-type'); // OK

try {
  const type = new URType('Bytes'); // Error: InvalidTypeError
} catch (e) {
  console.error(e.message);
}

// Check validity before creating
if (isValidURType('my-type')) {
  const type = new URType('my-type');
}
```

### Bytewords Encoding

```typescript
import { encodeBytewordsIdentifier, BYTEWORDS_MAP } from '@blockchain-commons/uniform-resources';

// Encode 4 bytes as bytewords
const data = new Uint8Array([0, 1, 2, 3]);
const words = encodeBytewordsIdentifier(data);
console.log(words); // "able acid also apex"

// Look up byteword index
const index = BYTEWORDS_MAP.get('able');
console.log(index); // 0
```

### Bytemojis Encoding

```typescript
import { encodeBytemojisIdentifier } from '@blockchain-commons/uniform-resources';

// Encode 4 bytes as bytemojis
const data = new Uint8Array([0, 1, 2, 3]);
const emojis = encodeBytemojisIdentifier(data);
console.log(emojis); // "😀 😂 😆 😉"
```

### Custom Type Encoding

```typescript
import { UR, UREncodable } from '@blockchain-commons/uniform-resources';
import { cbor } from '@blockchain-commons/dcbor';

class MyData implements UREncodable {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  ur(): UR {
    const cborData = cbor(this.value);
    return UR.new('mydata', cborData);
  }

  urString(): string {
    return this.ur().string();
  }
}

const data = new MyData(42);
console.log(data.urString()); // "ur:mydata/dava"
```

### Custom Type Decoding

```typescript
import { UR, URDecodable } from '@blockchain-commons/uniform-resources';
import { decodeCbor } from '@blockchain-commons/dcbor';

class MyData implements URDecodable {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  static fromUR(ur: UR): MyData {
    ur.checkType('mydata');
    const cborData = ur.cbor();
    // Decode CBOR data and construct instance
    return new MyData(42);
  }
}

const ur = UR.fromURString('ur:mydata/dava');
const data = MyData.fromUR(ur);
```

## API Reference

### Core Classes

#### `UR`

Represents a Uniform Resource.

**Static Methods:**
- `new(urType: string | URType, cbor: Cbor): UR` - Create a new UR
- `fromURString(urString: string): UR` - Decode a UR from string

**Instance Methods:**
- `urType(): URType` - Get the UR type object
- `urTypeStr(): string` - Get the UR type as a string
- `cbor(): Cbor` - Get the CBOR data
- `string(): string` - Get the UR string representation
- `qrString(): string` - Get the uppercase UR string for QR codes
- `qrData(): Uint8Array` - Get the QR string as UTF-8 bytes
- `checkType(expectedType: string | URType): void` - Verify the UR type
- `equals(other: UR): boolean` - Check equality with another UR

#### `URType`

Represents and validates a UR type identifier.

**Constructor:**
- `new(urType: string)` - Create and validate a UR type

**Instance Methods:**
- `string(): string` - Get the type string
- `equals(other: URType): boolean` - Check equality
- `toString(): string` - Get string representation

### Utility Functions

- `isURTypeChar(char: string): boolean` - Check if a character is valid in UR types
- `isValidURType(urType: string): boolean` - Check if a string is a valid UR type
- `validateURType(urType: string): string` - Validate and return a UR type or throw
- `encodeBytewordsIdentifier(data: Uint8Array): string` - Encode 4 bytes as bytewords
- `encodeBytemojisIdentifier(data: Uint8Array): string` - Encode 4 bytes as bytemojis

### Constants

- `BYTEWORDS: string[]` - Array of 256 byteword strings
- `BYTEWORDS_MAP: Map<string, number>` - Map for byteword lookup
- `BYTEMOJIS: string[]` - Array of 256 bytemoji characters

### Error Classes

- `URError` - Base error class for UR operations
- `InvalidSchemeError` - Thrown when UR doesn't start with "ur:"
- `TypeUnspecifiedError` - Thrown when UR type is missing
- `InvalidTypeError` - Thrown when UR type is invalid
- `NotSinglePartError` - Thrown for multipart URs (future use)
- `UnexpectedTypeError` - Thrown when UR type doesn't match expected
- `BytewordsError` - Thrown for byteword encoding errors
- `CBORError` - Thrown for CBOR encoding errors

### Interfaces

#### `UREncodable`

Objects that can be encoded to UR format.

```typescript
interface UREncodable {
  ur(): UR;
  urString(): string;
}
```

#### `URDecodable`

Objects that can be decoded from UR format.

```typescript
interface URDecodable {
  fromUR(ur: UR): unknown;
}
```

#### `URCodable`

Objects that support both encoding and decoding.

```typescript
interface URCodable extends UREncodable, URDecodable {}
```

### Multipart Support (Alpha)

Placeholder classes for fountain-code based multipart URs:

- `MultipartEncoder` - Encodes a UR as multiple parts
- `MultipartDecoder` - Decodes multiple UR parts into a single UR

**Note:** Full multipart support with fountain codes is planned for future releases.

## Specifications

This implementation adheres to the following Blockchain Commons specifications:

- [BCR-2020-005: Uniform Resources](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md)
- [BCR-2020-004: Bytewords](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-004-bytewords.md)
- [BCR-2024-008: Bytemojis](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-008-bytemoji.md)

## Dependencies

- `@blockchain-commons/dcbor` - Deterministic CBOR encoding

## Testing

Run the test suite with:

```bash
npm test
```

All 48 tests pass, providing comprehensive coverage of:
- UR type validation
- Encoding and decoding round-trips
- Error handling
- Utility functions
- Type interfaces
- Multipart framework

## License

Apache-2.0

## Contributing

Contributions are welcome! Please ensure all tests pass before submitting pull requests.

## References

- [Blockchain Commons](https://www.blockchaincommons.com/)
- [Reference Implementation (Rust)](https://github.com/BlockchainCommons/bc-ur-rust)
- [CBOR Specification](https://tools.ietf.org/html/rfc7049)
