# Blockchain Commons - Known Values

A TypeScript implementation of [Blockchain Commons Known Values](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-002-known-value.md) - a compact, deterministic ontological framework for representing commonly used concepts.

## Overview

Known Values provide a compact, deterministic way to represent commonly used ontological concepts such as relationships between entities, classes of entities, properties, or enumerated values. They are particularly useful as predicates in Gordian Envelope assertions, offering a more compact and deterministic alternative to URIs.

A Known Value is represented as a 64-bit unsigned integer with an optional human-readable name. This approach ensures:

- **Compact binary representation** - Each Known Value requires only 1-9 bytes depending on value range
- **Deterministic encoding** - Every concept has exactly one valid binary representation
- **Enhanced security** - Eliminates URI manipulation vulnerabilities
- **Standardized semantics** - Values are registered in a central registry

## Features

✨ **1:1 TypeScript Port** of the official [Rust reference implementation](https://github.com/BlockchainCommons/known-values-rust)

- Complete KnownValue class with named and unnamed values
- KnownValuesStore for bidirectional value/name lookups
- Global registry with all standardized known values
- Lazy-initialized singleton pattern
- Full test coverage

## Installation

```bash
npm install @blockchain-commons/known-values
```

Or with yarn:

```bash
yarn add @blockchain-commons/known-values
```

Or with bun:

```bash
bun add @blockchain-commons/known-values
```

## Quick Start

### Using Predefined Known Values

```typescript
import { IS_A, NOTE, SIGNED, ID } from '@blockchain-commons/known-values';

console.log(IS_A.value());     // 1
console.log(IS_A.name());      // "isA"

console.log(NOTE.value());     // 4
console.log(NOTE.name());      // "note"

console.log(SIGNED.value());   // 3
console.log(SIGNED.name());    // "signed"
```

### Creating Custom Known Values

```typescript
import { KnownValue } from '@blockchain-commons/known-values';

// Create a known value with just a numeric value
const customValue = new KnownValue(100);
console.log(customValue.name()); // "100"

// Create a known value with a name
const namedValue = new KnownValue(100, 'myCustomConcept');
console.log(namedValue.name()); // "myCustomConcept"
```

### Using the Store

```typescript
import { KnownValuesStore, IS_A, NOTE, SIGNED } from '@blockchain-commons/known-values';

// Create a store with known values
const store = new KnownValuesStore([IS_A, NOTE, SIGNED]);

// Look up by name
const isA = store.knownValueNamed('isA');
console.log(isA?.value()); // 1

// Get the name for a value
console.log(store.name(SIGNED)); // "signed"

// Look up by raw value
const unknown = KnownValuesStore.knownValueForRawValue(999, store);
console.log(unknown.name()); // "999" (unnamed)
```

### Accessing the Global Registry

```typescript
import { KNOWN_VALUES } from '@blockchain-commons/known-values';

// Get the global store (lazily initialized on first access)
const store = KNOWN_VALUES.get();

// Look up any registered known value
const isA = store.knownValueNamed('isA');
console.log(isA?.value()); // 1
```

## API Reference

### KnownValue

#### Constructor

```typescript
new KnownValue(value: number, assignedName?: string)
```

#### Methods

- `value(): number` - Returns the numeric value
- `assignedName(): string | undefined` - Returns the assigned name (if any)
- `name(): string` - Returns the human-readable name (assigned name or numeric value as string)
- `equals(other: KnownValue): boolean` - Compares equality based on numeric value
- `hashCode(): number` - Returns hash code based on numeric value
- `toString(): string` - String representation

### KnownValuesStore

#### Constructor

```typescript
new KnownValuesStore(knownValues?: Iterable<KnownValue>)
```

#### Methods

- `insert(knownValue: KnownValue): void` - Add or update a known value
- `knownValueNamed(name: string): KnownValue | undefined` - Look up by name
- `assignedName(knownValue: KnownValue): string | undefined` - Get assigned name
- `name(knownValue: KnownValue): string` - Get name (with fallback to value)
- `clone(): KnownValuesStore` - Create a shallow copy

#### Static Methods

- `knownValueForRawValue(value: number, store?: KnownValuesStore): KnownValue` - Look up or create
- `knownValueForName(name: string, store?: KnownValuesStore): KnownValue | undefined` - Look up by name
- `nameForKnownValue(kv: KnownValue, store?: KnownValuesStore): string` - Get name

## Known Values Registry

The package includes all standardized known values organized by category:

### General (0-24)

| Name | Value | Meaning |
|------|-------|---------|
| `UNIT` | 0 | Empty/unit value |
| `IS_A` | 1 | Classification predicate |
| `ID` | 2 | Identifier |
| `SIGNED` | 3 | Cryptographic signature |
| `NOTE` | 4 | Annotation/note |
| `HAS_RECIPIENT` | 5 | Recipient specification |
| ... | ... | ... |

### Other Categories

- **Attachments** (50-59)
- **XID Documents** (60-69)
- **XID Privileges** (70-99)
- **Expression & Function Calls** (100-108)
- **Cryptography** (200-203)
- **Cryptocurrency Assets** (300-303)
- **Cryptocurrency Networks** (400-402)
- **Bitcoin** (500-508)
- **Graphs** (600-705)

For the complete registry, see [BCR-2023-002 Appendix A](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-002-known-value.md#appendix-a-registry).

## Specifications

This implementation follows:

- **[BCR-2023-002: Known Value](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-002-known-value.md)** - The core known value specification
- **[BCR-2023-003: Envelope Known Value](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-003-envelope-known-value.md)** - Envelope extension specification

## Testing

Run the test suite:

```bash
npm run test
npm run test:watch    # Watch mode
```

## Building

```bash
npm run build         # Build distribution files
npm run dev           # Watch mode build
npm run typecheck     # Type checking
npm run lint          # Linting
```

## License

ISC License - See LICENSE file for details

## Acknowledgments

This is a 1:1 TypeScript port of the [official Rust reference implementation](https://github.com/BlockchainCommons/known-values-rust) from [Blockchain Commons](https://www.blockchaincommons.com/).
