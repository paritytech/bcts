# BCTS dcbor-parse Package - 1:1 Port Plan

## Overview

Port `bc-dcbor-parse-rust` (v0.10.0) to TypeScript as `@bcts/dcbor-parse`, maintaining a 1:1 correspondence with the Rust implementation.

**Source:** `ref/bc-dcbor-parse-rust/`
**Target:** `packages/dcbor-parse/`

---

## Package Purpose

This package provides tools for parsing and composing the [CBOR diagnostic notation](https://datatracker.ietf.org/doc/html/rfc8949#name-diagnostic-notation) into [dCBOR (deterministic CBOR)](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/) data items.

It is intended for use in testing, debugging, and other scenarios where a human-readable representation of dCBOR is useful.

### Supported Types

| Type                | Example(s)                                                  |
| ------------------- | ----------------------------------------------------------- |
| Boolean             | `true`, `false`                                             |
| Null                | `null`                                                      |
| Integers            | `0`, `1`, `-1`, `42`                                        |
| Floats              | `3.14`, `-2.5`, `Infinity`, `-Infinity`, `NaN`              |
| Strings             | `"hello"`, `"🌎"`                                           |
| Date Literals       | `2023-02-08`, `2023-02-08T15:30:45Z`, `1965-05-15`          |
| Hex Byte Strings    | `h'68656c6c6f'`                                             |
| Base64 Byte Strings | `b64'AQIDBAUGBwgJCg=='`                                     |
| Tagged Values       | `1234("hello")`, `5678(3.14)`                               |
| Name-Tagged Values  | `tag-name("hello")`, `tag-name(3.14)`                       |
| Known Values        | `'1'`, `'isA'`                                              |
| Unit Known Value    | `Unit`, `''`, `'0'`                                         |
| URs                 | `ur:date/cyisdadmlasgtapttl`                                |
| Arrays              | `[1, 2, 3]`, `["hello", "world"]`, `[1, [2, 3]]`            |
| Maps                | `{1: 2, 3: 4}`, `{"key": "value"}`, `{1: [2, 3], 4: 5}`     |

---

## File Structure Mapping

### Rust → TypeScript File Mapping

```
Rust Source                    TypeScript Target
─────────────────────────────  ─────────────────────────────
src/lib.rs                  →  src/index.ts (exports)
src/error.rs                →  src/error.ts
src/token.ts                →  src/token.ts
src/parse.rs                →  src/parse.ts
src/compose.rs              →  src/compose.ts
```

### Test Files Mapping

```
Rust Test                               TypeScript Test
────────────────────────────────────    ────────────────────────────────────
tests/test_parse.rs                  →  tests/parse.test.ts
tests/test_compose.rs                →  tests/compose.test.ts
tests/test_runtime_functionality.rs  →  tests/runtime-functionality.test.ts
```

---

## Implementation Phases

### Phase 1: Package Setup
- [ ] Create `packages/dcbor-parse/` directory
- [ ] Create `package.json` with dependencies
- [ ] Create `tsconfig.json` (extend shared)
- [ ] Create `tsdown.config.ts`
- [ ] Create `vitest.config.ts`
- [ ] Create `eslint.config.mjs`
- [ ] Create `typedoc.json`

### Phase 2: Error Types
- [ ] `src/error.ts` - ParseError enum with 20 variants
  - EmptyInput
  - UnexpectedEndOfInput
  - ExtraData(Span)
  - UnexpectedToken(Token, Span)
  - UnrecognizedToken(Span)
  - ExpectedComma(Span)
  - ExpectedColon(Span)
  - UnmatchedParentheses(Span)
  - UnmatchedBraces(Span)
  - ExpectedMapKey(Span)
  - InvalidTagValue(string, Span)
  - UnknownTagName(string, Span)
  - InvalidHexString(Span)
  - InvalidBase64String(Span)
  - UnknownUrType(string, Span)
  - InvalidUr(string, Span)
  - InvalidKnownValue(string, Span)
  - UnknownKnownValueName(string, Span)
  - InvalidDateString(string, Span)
  - DuplicateMapKey(Span)
- [ ] `Span` type: `{ start: number, end: number }`
- [ ] `isDefault()` method
- [ ] `fullMessage(source: string)` method with line/column formatting

### Phase 3: Token/Lexer
- [ ] `src/token.ts` - Token enum and Lexer class
  - Token variants:
    - Bool(boolean)
    - BraceOpen, BraceClose
    - BracketOpen, BracketClose
    - ParenthesisOpen, ParenthesisClose
    - Colon, Comma
    - Null, NaN, Infinity, NegInfinity
    - ByteStringHex(Uint8Array)
    - ByteStringBase64(Uint8Array)
    - DateLiteral(CborDate)
    - Number(number)
    - String(string)
    - TagValue(number)
    - TagName(string)
    - KnownValueNumber(number)
    - KnownValueName(string)
    - Unit
    - UR(UR)
  - Manual lexer implementation (Rust uses `logos`)
  - Skip whitespace and comments (`/...*/` and `#...`)

### Phase 4: Parse Module
- [ ] `src/parse.ts` - Main parsing functions
  - `parseDcborItem(src: string): Result<Cbor, ParseError>` - Parse single complete item
  - `parseDcborItemPartial(src: string): Result<[Cbor, number], ParseError>` - Parse partial with byte count
  - Internal functions:
    - `parseItem(lexer: Lexer): Result<Cbor, ParseError>`
    - `expectToken(lexer: Lexer): Result<Token, ParseError>`
    - `parseItemToken(token: Token, lexer: Lexer): Result<Cbor, ParseError>`
    - `parseString(s: string, span: Span): Result<Cbor, ParseError>`
    - `parseUr(ur: UR, span: Span): Result<Cbor, ParseError>`
    - `parseNumberTag(tagValue: number, lexer: Lexer): Result<Cbor, ParseError>`
    - `parseNameTag(name: string, lexer: Lexer): Result<Cbor, ParseError>`
    - `parseArray(lexer: Lexer): Result<Cbor, ParseError>`
    - `parseMap(lexer: Lexer): Result<Cbor, ParseError>`

### Phase 5: Compose Module
- [ ] `src/compose.ts` - Compose functions
  - `ComposeError` enum:
    - OddMapLength
    - DuplicateMapKey
    - ParseError(ParseError)
  - `composeDcborArray(items: string[]): Result<Cbor, ComposeError>`
  - `composeDcborMap(items: string[]): Result<Cbor, ComposeError>`

### Phase 6: Main Export
- [ ] `src/index.ts` - Barrel exports
  - Export `parseDcborItem`, `parseDcborItemPartial`
  - Export `Token`
  - Export `ParseError`, `ParseResult`
  - Export `ComposeError`, `ComposeResult`, `composeDcborArray`, `composeDcborMap`

### Phase 7: Tests
- [ ] `tests/parse.test.ts` - Parse tests
  - Basic types (bool, null, numbers, strings)
  - Byte strings (hex, base64)
  - NaN handling
  - Tagged values
  - Arrays (empty, nested)
  - Maps (empty, nested, sorted keys)
  - URs
  - Named tags
  - Known values (numeric and named)
  - Unit known value
  - Error cases (all 20 error types)
  - Whitespace handling
  - Comments (inline `/.../` and end-of-line `#...`)
  - Partial parsing
  - Date literals (simple and extended)
  - Duplicate map keys
- [ ] `tests/compose.test.ts` - Compose tests
  - Array composition (empty, integers, strings, mixed, nested)
  - Map composition (empty, integers, strings, nested, sorted keys)
  - Error cases (odd length, duplicate keys, empty items)
- [ ] `tests/runtime-functionality.test.ts` - Runtime functionality tests
  - Basic functionality preservation
  - Complex string escapes
  - Complex date formats (timezones, milliseconds)
  - Complex base64 requirements
  - Mixed complex patterns

### Phase 8: Final
- [ ] Run full test suite
- [ ] Run lint and fix issues
- [ ] Run typecheck
- [ ] Build and verify outputs
- [ ] Create README.md (optional)

---

## Dependencies

### Runtime Dependencies
```json
{
  "@bcts/dcbor": "workspace:*",
  "@bcts/ur": "workspace:*",
  "@bcts/known-values": "workspace:*",
  "@bcts/tags": "workspace:*"
}
```

### Dev Dependencies
```json
{
  "@bcts/tsconfig": "workspace:*",
  "@bcts/eslint": "workspace:*",
  "tsdown": "^0.18.3",
  "typescript": "^5.9.3",
  "vitest": "^4.0.16",
  "typedoc": "^0.28.15"
}
```

---

## Key Type Mappings

| Rust Type | TypeScript Type |
|-----------|-----------------|
| `Result<T, Error>` | `Result<T, ParseError>` (discriminated union) |
| `Error` (enum) | Discriminated union |
| `Token` (enum) | Discriminated union |
| `Vec<u8>` | `Uint8Array` |
| `HashMap<K, V>` | `Map<K, V>` |
| `Option<T>` | `T \| undefined` |
| `Span` | `{ start: number, end: number }` |
| `CBOR` | `Cbor` (from @bcts/dcbor) |
| `Date` | `CborDate` (from @bcts/dcbor) |
| `Tag` / `TagValue` | `Tag` (from @bcts/tags) |
| `KnownValue` | `KnownValue` (from @bcts/known-values) |
| `UR` | `UR` (from @bcts/ur) |
| `&str` | `string` |
| `f64` | `number` |
| `u64` | `number` (or `bigint` for large values) |
| `Lexer<'_, Token>` | `Lexer` class |

---

## Conventions to Follow

1. **File naming:** kebab-case (e.g., `error.ts`, `token.ts`)
2. **Function naming:** camelCase (e.g., `parseDcborItem`, `composeDcborArray`)
3. **Type naming:** PascalCase (e.g., `ParseError`, `Token`)
4. **Error handling:** Discriminated unions with `Result<T, E>` type
5. **Private fields:** Use `#fieldName` syntax
6. **Documentation:** JSDoc with `@example` blocks
7. **Immutability:** Use `readonly` where appropriate

---

## Implementation Notes

### Lexer Implementation

The Rust implementation uses the `logos` crate for lexical analysis. In TypeScript, we'll implement a manual lexer class:

```typescript
class Lexer {
  readonly #source: string;
  #position: number;
  #start: number;

  constructor(source: string);
  next(): Token | undefined;
  span(): Span;
  slice(): string;
}
```

### Token Patterns

Key regex patterns to implement:

| Token Type | Rust Pattern | Description |
|------------|--------------|-------------|
| ByteStringHex | `h'[0-9a-fA-F]*'` | Hex byte string |
| ByteStringBase64 | `b64'([A-Za-z0-9+/=]{2,})'` | Base64 byte string (min 2 chars) |
| DateLiteral | `\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z\|[+-]\d{2}:\d{2})?)?` | ISO-8601 date |
| Number | `-?(?:0\|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?` | JavaScript-style number |
| String | `"([^"\\\x00-\x1F]\|\\(["\\bnfrt/]\|u[a-fA-F0-9]{4}))*"` | JavaScript-style string |
| TagValue | `0\(\|[1-9][0-9]*\(` | Integer tag followed by `(` |
| TagName | `[a-zA-Z_][a-zA-Z0-9_-]*\(` | Named tag followed by `(` |
| KnownValueNumber | `'0'\|'[1-9][0-9]*'` | Numeric known value |
| KnownValueName | `''\|'[a-zA-Z_][a-zA-Z0-9_-]*'` | Named known value |
| UR | `ur:([a-zA-Z0-9][a-zA-Z0-9-]*)/([a-zA-Z]{8,})` | Uniform Resource |

### Skip Patterns

The lexer should skip:
- Whitespace: `[ \t\r\n\f]+`
- Inline comments: `/[^/]*/`
- End-of-line comments: `#[^\n]*`

### Error Message Formatting

The `fullMessage` method should format errors with line numbers and carets:

```
line 1: Duplicate map key
{"key1": 1, "key2": 2, "key1": 3}
                       ^^^^^^
```

---

## Progress Tracking

**Total Files:** ~5 source files + ~3 test files
**Estimated Phases:** 8

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Package Setup | ⬜ Not Started |
| 2 | Error Types | ⬜ Not Started |
| 3 | Token/Lexer | ⬜ Not Started |
| 4 | Parse Module | ⬜ Not Started |
| 5 | Compose Module | ⬜ Not Started |
| 6 | Main Export | ⬜ Not Started |
| 7 | Tests | ⬜ Not Started |
| 8 | Final | ⬜ Not Started |

---

## Test Count Summary

Based on Rust test files:

| Test File | Estimated Tests |
|-----------|-----------------|
| parse.test.ts | ~35 tests |
| compose.test.ts | ~10 tests |
| runtime-functionality.test.ts | ~15 tests |
| **Total** | **~60 tests** |

---

## Notes

- The Rust implementation uses `logos` for lexing - we'll implement a manual lexer
- The lexer captures literal strings including escape sequences (does NOT process them like JSON)
- Date parsing requires integration with `@bcts/dcbor` Date type
- UR parsing requires integration with `@bcts/ur` package
- Known value lookup requires integration with `@bcts/known-values` registry
- Tag name lookup requires integration with `@bcts/tags` registry
- The parser supports both inline comments (`/...*/`) and end-of-line comments (`#...`)
