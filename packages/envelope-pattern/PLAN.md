# BCTS envelope-pattern Package - 1:1 Port Plan

## Overview

Port `bc-envelope-pattern-rust` (v0.11.0) to TypeScript as `@bcts/envelope-pattern`, maintaining a 1:1 correspondence with the Rust implementation.

**Source:** `ref/bc-envelope-pattern-rust/`
**Target:** `packages/envelope-pattern/`
**Estimated Lines:** ~9,129 lines of Rust to port

---

## File Structure Mapping

### Rust to TypeScript File Mapping

```
src/
├── lib.rs                              → src/index.ts (exports)
├── error.rs                            → src/error.ts
├── format.rs                           → src/format.ts
│
├── parse/
│   ├── mod.rs                          → src/parse/index.ts
│   ├── token.rs                        → src/parse/token.ts
│   ├── utils.rs                        → src/parse/utils.ts
│   ├── leaf/
│   │   ├── mod.rs                      → src/parse/leaf/index.ts
│   │   ├── array_parser.rs             → src/parse/leaf/array-parser.ts
│   │   ├── cbor_parser.rs              → src/parse/leaf/cbor-parser.ts
│   │   ├── date_parser.rs              → src/parse/leaf/date-parser.ts
│   │   ├── known_value_parser.rs       → src/parse/leaf/known-value-parser.ts
│   │   ├── map_parser.rs               → src/parse/leaf/map-parser.ts
│   │   ├── null_parser.rs              → src/parse/leaf/null-parser.ts
│   │   ├── number_parser.rs            → src/parse/leaf/number-parser.ts
│   │   └── tag_parser.rs               → src/parse/leaf/tag-parser.ts
│   ├── meta/
│   │   ├── mod.rs                      → src/parse/meta/index.ts
│   │   ├── and_parser.rs               → src/parse/meta/and-parser.ts
│   │   ├── or_parser.rs                → src/parse/meta/or-parser.ts
│   │   ├── not_parser.rs               → src/parse/meta/not-parser.ts
│   │   ├── capture_parser.rs           → src/parse/meta/capture-parser.ts
│   │   ├── group_parser.rs             → src/parse/meta/group-parser.ts
│   │   ├── search_parser.rs            → src/parse/meta/search-parser.ts
│   │   ├── traverse_parser.rs          → src/parse/meta/traverse-parser.ts
│   │   └── primary_parser.rs           → src/parse/meta/primary-parser.ts
│   └── structure/
│       ├── mod.rs                      → src/parse/structure/index.ts
│       ├── assertion_parser.rs         → src/parse/structure/assertion-parser.ts
│       ├── assertion_obj_parser.rs     → src/parse/structure/assertion-obj-parser.ts
│       ├── assertion_pred_parser.rs    → src/parse/structure/assertion-pred-parser.ts
│       ├── subject_parser.rs           → src/parse/structure/subject-parser.ts
│       ├── predicate_parser.rs         → src/parse/structure/predicate-parser.ts
│       ├── object_parser.rs            → src/parse/structure/object-parser.ts
│       ├── node_parser.rs              → src/parse/structure/node-parser.ts
│       ├── digest_parser.rs            → src/parse/structure/digest-parser.ts
│       ├── wrapped_parser.rs           → src/parse/structure/wrapped-parser.ts
│       ├── obscured_parser.rs          → src/parse/structure/obscured-parser.ts
│       ├── elided_parser.rs            → src/parse/structure/elided-parser.ts
│       └── compressed_parser.rs        → src/parse/structure/compressed-parser.ts
│
└── pattern/
    ├── mod.rs                          → src/pattern/index.ts
    ├── matcher.rs                      → src/pattern/matcher.ts
    ├── vm.rs                           → src/pattern/vm.ts
    ├── dcbor_integration.rs            → src/pattern/dcbor-integration.ts
    ├── leaf/
    │   ├── mod.rs                      → src/pattern/leaf/index.ts
    │   ├── cbor_pattern.rs             → src/pattern/leaf/cbor-pattern.ts
    │   ├── number_pattern.rs           → src/pattern/leaf/number-pattern.ts
    │   ├── text_pattern.rs             → src/pattern/leaf/text-pattern.ts
    │   ├── byte_string_pattern.rs      → src/pattern/leaf/byte-string-pattern.ts
    │   ├── date_pattern.rs             → src/pattern/leaf/date-pattern.ts
    │   ├── bool_pattern.rs             → src/pattern/leaf/bool-pattern.ts
    │   ├── null_pattern.rs             → src/pattern/leaf/null-pattern.ts
    │   ├── array_pattern.rs            → src/pattern/leaf/array-pattern.ts
    │   ├── map_pattern.rs              → src/pattern/leaf/map-pattern.ts
    │   ├── known_value_pattern.rs      → src/pattern/leaf/known-value-pattern.ts
    │   └── tagged_pattern.rs           → src/pattern/leaf/tagged-pattern.ts
    ├── meta/
    │   ├── mod.rs                      → src/pattern/meta/index.ts
    │   ├── any_pattern.rs              → src/pattern/meta/any-pattern.ts
    │   ├── and_pattern.rs              → src/pattern/meta/and-pattern.ts
    │   ├── or_pattern.rs               → src/pattern/meta/or-pattern.ts
    │   ├── not_pattern.rs              → src/pattern/meta/not-pattern.ts
    │   ├── search_pattern.rs           → src/pattern/meta/search-pattern.ts
    │   ├── traverse_pattern.rs         → src/pattern/meta/traverse-pattern.ts
    │   ├── repeat_pattern.rs           → src/pattern/meta/repeat-pattern.ts
    │   └── capture_pattern.rs          → src/pattern/meta/capture-pattern.ts
    └── structure/
        ├── mod.rs                      → src/pattern/structure/index.ts
        ├── leaf_structure_pattern.rs   → src/pattern/structure/leaf-structure-pattern.ts
        ├── node_pattern.rs             → src/pattern/structure/node-pattern.ts
        ├── assertions_pattern.rs       → src/pattern/structure/assertions-pattern.ts
        ├── subject_pattern.rs          → src/pattern/structure/subject-pattern.ts
        ├── predicate_pattern.rs        → src/pattern/structure/predicate-pattern.ts
        ├── object_pattern.rs           → src/pattern/structure/object-pattern.ts
        ├── digest_pattern.rs           → src/pattern/structure/digest-pattern.ts
        ├── obscured_pattern.rs         → src/pattern/structure/obscured-pattern.ts
        └── wrapped_pattern.rs          → src/pattern/structure/wrapped-pattern.ts
```

### Test Files Mapping

```
tests/
├── common/mod.rs                       → tests/common.ts
├── pattern_tests.rs                    → tests/pattern.test.ts
├── pattern_tests_leaf.rs               → tests/pattern-leaf.test.ts
├── pattern_tests_meta.rs               → tests/pattern-meta.test.ts
├── pattern_tests_structure.rs          → tests/pattern-structure.test.ts
├── pattern_tests_repeat.rs             → tests/pattern-repeat.test.ts
├── parse_tests.rs                      → tests/parse.test.ts
├── parse_tests_leaf.rs                 → tests/parse-leaf.test.ts
├── parse_tests_meta.rs                 → tests/parse-meta.test.ts
├── parse_tests_structure.rs            → tests/parse-structure.test.ts
├── capture_tests.rs                    → tests/capture.test.ts
├── dcbor_integration_tests.rs          → tests/dcbor-integration.test.ts
├── credential_tests.rs                 → tests/credential.test.ts
└── error_tests.rs                      → tests/error.test.ts
```

---

## Implementation Phases

### Phase 1: Package Setup
- [ ] Create `packages/envelope-pattern/` directory structure
- [ ] Create `package.json` with dependencies
- [ ] Create `tsconfig.json` (extend shared)
- [ ] Create `tsdown.config.ts`
- [ ] Create `vitest.config.ts`
- [ ] Create `eslint.config.mjs`
- [ ] Create `typedoc.json`
- [ ] Create `turbo.json`

### Phase 2: Core Types (No Pattern Dependencies)
- [ ] `src/error.ts` - Error types and Result type
- [ ] `src/format.ts` - Path formatting utilities (FormatPathsOpts, PathElementFormat)

### Phase 3: Lexer/Tokenizer
- [ ] `src/parse/token.ts` - Token enum and Lexer (port from logos-based implementation)
- [ ] `src/parse/utils.ts` - Parser utility functions

### Phase 4: Leaf Patterns (CBOR Value Patterns)
- [ ] `src/pattern/leaf/bool-pattern.ts` - Boolean patterns
- [ ] `src/pattern/leaf/null-pattern.ts` - Null pattern
- [ ] `src/pattern/leaf/number-pattern.ts` - Numeric patterns (ranges, comparisons)
- [ ] `src/pattern/leaf/text-pattern.ts` - Text patterns (values, regex)
- [ ] `src/pattern/leaf/byte-string-pattern.ts` - Binary patterns (values, regex)
- [ ] `src/pattern/leaf/date-pattern.ts` - Date patterns (ranges, strings, regex)
- [ ] `src/pattern/leaf/array-pattern.ts` - Array patterns (length/count)
- [ ] `src/pattern/leaf/map-pattern.ts` - Map patterns (length/count)
- [ ] `src/pattern/leaf/known-value-pattern.ts` - Known value patterns
- [ ] `src/pattern/leaf/tagged-pattern.ts` - CBOR tag patterns
- [ ] `src/pattern/leaf/cbor-pattern.ts` - Generic CBOR pattern (dcbor-pattern integration)
- [ ] `src/pattern/leaf/index.ts` - LeafPattern union type

### Phase 5: Structure Patterns (Envelope Structure)
- [ ] `src/pattern/structure/leaf-structure-pattern.ts` - Match leaf envelopes
- [ ] `src/pattern/structure/node-pattern.ts` - Node with assertions
- [ ] `src/pattern/structure/assertions-pattern.ts` - Match assertions
- [ ] `src/pattern/structure/subject-pattern.ts` - Subject matching
- [ ] `src/pattern/structure/predicate-pattern.ts` - Predicate (assertion key)
- [ ] `src/pattern/structure/object-pattern.ts` - Object (assertion value)
- [ ] `src/pattern/structure/digest-pattern.ts` - Digest patterns
- [ ] `src/pattern/structure/obscured-pattern.ts` - Elided/encrypted/compressed
- [ ] `src/pattern/structure/wrapped-pattern.ts` - Wrapped envelopes
- [ ] `src/pattern/structure/index.ts` - StructurePattern union type

### Phase 6: Meta Patterns (Combinators)
- [ ] `src/pattern/meta/any-pattern.ts` - Matches anything
- [ ] `src/pattern/meta/and-pattern.ts` - All patterns must match
- [ ] `src/pattern/meta/or-pattern.ts` - Any pattern can match
- [ ] `src/pattern/meta/not-pattern.ts` - Negation operator
- [ ] `src/pattern/meta/search-pattern.ts` - Recursive tree search
- [ ] `src/pattern/meta/traverse-pattern.ts` - Sequential traversal
- [ ] `src/pattern/meta/repeat-pattern.ts` - Repetition with quantifiers
- [ ] `src/pattern/meta/capture-pattern.ts` - Named capture groups
- [ ] `src/pattern/meta/index.ts` - MetaPattern union type

### Phase 7: Pattern Core & Matcher
- [ ] `src/pattern/matcher.ts` - Matcher interface
- [ ] `src/pattern/dcbor-integration.ts` - dcbor-pattern conversion
- [ ] `src/pattern/index.ts` - Pattern union type + convenience constructors

### Phase 8: VM Execution
- [ ] `src/pattern/vm.ts` - Instructions and Thompson-style NFA VM

### Phase 9: Parsers - Leaf
- [ ] `src/parse/leaf/array-parser.ts`
- [ ] `src/parse/leaf/cbor-parser.ts`
- [ ] `src/parse/leaf/date-parser.ts`
- [ ] `src/parse/leaf/known-value-parser.ts`
- [ ] `src/parse/leaf/map-parser.ts`
- [ ] `src/parse/leaf/null-parser.ts`
- [ ] `src/parse/leaf/number-parser.ts`
- [ ] `src/parse/leaf/tag-parser.ts`
- [ ] `src/parse/leaf/index.ts`

### Phase 10: Parsers - Structure
- [ ] `src/parse/structure/assertion-parser.ts`
- [ ] `src/parse/structure/assertion-obj-parser.ts`
- [ ] `src/parse/structure/assertion-pred-parser.ts`
- [ ] `src/parse/structure/subject-parser.ts`
- [ ] `src/parse/structure/predicate-parser.ts`
- [ ] `src/parse/structure/object-parser.ts`
- [ ] `src/parse/structure/node-parser.ts`
- [ ] `src/parse/structure/digest-parser.ts`
- [ ] `src/parse/structure/wrapped-parser.ts`
- [ ] `src/parse/structure/obscured-parser.ts`
- [ ] `src/parse/structure/elided-parser.ts`
- [ ] `src/parse/structure/compressed-parser.ts`
- [ ] `src/parse/structure/index.ts`

### Phase 11: Parsers - Meta
- [ ] `src/parse/meta/primary-parser.ts`
- [ ] `src/parse/meta/capture-parser.ts`
- [ ] `src/parse/meta/search-parser.ts`
- [ ] `src/parse/meta/traverse-parser.ts`
- [ ] `src/parse/meta/group-parser.ts`
- [ ] `src/parse/meta/not-parser.ts`
- [ ] `src/parse/meta/and-parser.ts`
- [ ] `src/parse/meta/or-parser.ts`
- [ ] `src/parse/meta/index.ts`

### Phase 12: Main Parser Entry
- [ ] `src/parse/index.ts` - parse() and parsePartial()

### Phase 13: Main Export
- [ ] `src/index.ts` - Barrel exports

### Phase 14: Tests
- [ ] `tests/common.ts` - Test utilities
- [ ] `tests/pattern.test.ts` - Core pattern tests
- [ ] `tests/pattern-leaf.test.ts` - Leaf pattern tests
- [ ] `tests/pattern-meta.test.ts` - Meta pattern tests
- [ ] `tests/pattern-structure.test.ts` - Structure pattern tests
- [ ] `tests/pattern-repeat.test.ts` - Repetition tests
- [ ] `tests/parse.test.ts` - Parser tests
- [ ] `tests/parse-leaf.test.ts` - Leaf parsing tests
- [ ] `tests/parse-meta.test.ts` - Meta parsing tests
- [ ] `tests/parse-structure.test.ts` - Structure parsing tests
- [ ] `tests/capture.test.ts` - Named capture tests
- [ ] `tests/dcbor-integration.test.ts` - dcbor-pattern integration tests
- [ ] `tests/credential.test.ts` - Real-world credential tests
- [ ] `tests/error.test.ts` - Error handling tests

### Phase 15: Final
- [ ] Run full test suite
- [ ] Run lint and fix issues
- [ ] Run typecheck
- [ ] Build and verify outputs
- [ ] Create README.md

---

## Dependencies

### Runtime Dependencies
```json
{
  "@bcts/dcbor": "workspace:*",
  "@bcts/dcbor-pattern": "workspace:*",
  "@bcts/envelope": "workspace:*",
  "@bcts/components": "workspace:*",
  "@bcts/tags": "workspace:*",
  "@bcts/known-values": "workspace:*"
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
| `Pattern` (enum) | Discriminated union |
| `LeafPattern` (enum) | Discriminated union |
| `StructurePattern` (enum) | Discriminated union |
| `MetaPattern` (enum) | Discriminated union |
| `Result<T>` | `Result<T>` (discriminated union) |
| `Error` (enum) | Discriminated union |
| `Box<Pattern>` | `Pattern` (reference) |
| `Vec<T>` | `T[]` |
| `HashMap<K, V>` | `Map<K, V>` |
| `Option<T>` | `T \| undefined` |
| `RangeInclusive<T>` | `Interval` (from @bcts/dcbor-pattern) |
| `regex::Regex` | `RegExp` |
| `&str` | `string` |
| `&[u8]` | `Uint8Array` |
| `usize` | `number` |
| `f64` | `number` |
| `Span` | `{ start: number, end: number }` |
| `Path` | `Envelope[]` |
| `Envelope` | `Envelope` (from @bcts/envelope) |
| `CBOR` | `Cbor` (from @bcts/dcbor) |
| `Digest` | `Digest` (from @bcts/envelope) |
| `Tag` | `Tag` (from @bcts/dcbor) |
| `KnownValue` | `KnownValue` (from @bcts/known-values) |
| `Quantifier` | `Quantifier` (from @bcts/dcbor-pattern) |
| `Reluctance` | `Reluctance` (from @bcts/dcbor-pattern) |
| `Interval` | `Interval` (from @bcts/dcbor-pattern) |

---

## Core Types to Implement

### Pattern (Main Discriminated Union)
```typescript
export type Pattern =
  | { readonly kind: "Leaf"; readonly pattern: LeafPattern }
  | { readonly kind: "Structure"; readonly pattern: StructurePattern }
  | { readonly kind: "Meta"; readonly pattern: MetaPattern };
```

### LeafPattern Variants
```typescript
export type LeafPattern =
  | { readonly type: "Cbor"; readonly pattern: CborPattern }
  | { readonly type: "Number"; readonly pattern: NumberPattern }
  | { readonly type: "Text"; readonly pattern: TextPattern }
  | { readonly type: "ByteString"; readonly pattern: ByteStringPattern }
  | { readonly type: "Tag"; readonly pattern: TaggedPattern }
  | { readonly type: "Array"; readonly pattern: ArrayPattern }
  | { readonly type: "Map"; readonly pattern: MapPattern }
  | { readonly type: "Bool"; readonly pattern: BoolPattern }
  | { readonly type: "Null"; readonly pattern: NullPattern }
  | { readonly type: "Date"; readonly pattern: DatePattern }
  | { readonly type: "KnownValue"; readonly pattern: KnownValuePattern };
```

### StructurePattern Variants
```typescript
export type StructurePattern =
  | { readonly type: "Assertions"; readonly pattern: AssertionsPattern }
  | { readonly type: "Digest"; readonly pattern: DigestPattern }
  | { readonly type: "Leaf"; readonly pattern: LeafStructurePattern }
  | { readonly type: "Node"; readonly pattern: NodePattern }
  | { readonly type: "Object"; readonly pattern: ObjectPattern }
  | { readonly type: "Obscured"; readonly pattern: ObscuredPattern }
  | { readonly type: "Predicate"; readonly pattern: PredicatePattern }
  | { readonly type: "Subject"; readonly pattern: SubjectPattern }
  | { readonly type: "Wrapped"; readonly pattern: WrappedPattern };
```

### MetaPattern Variants
```typescript
export type MetaPattern =
  | { readonly type: "Any"; readonly pattern: AnyPattern }
  | { readonly type: "And"; readonly pattern: AndPattern }
  | { readonly type: "Or"; readonly pattern: OrPattern }
  | { readonly type: "Not"; readonly pattern: NotPattern }
  | { readonly type: "Search"; readonly pattern: SearchPattern }
  | { readonly type: "Traverse"; readonly pattern: TraversePattern }
  | { readonly type: "Group"; readonly pattern: GroupPattern }
  | { readonly type: "Capture"; readonly pattern: CapturePattern };
```

### Matcher Interface
```typescript
export interface Matcher {
  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>];
  paths(haystack: Envelope): Path[];
  matches(haystack: Envelope): boolean;
  isComplex(): boolean;
  compile(code: Instr[], literals: Pattern[], captures: string[]): void;
}
```

### VM Instructions
```typescript
export type Instr =
  | { readonly type: "MatchPredicate"; readonly literalIndex: number }
  | { readonly type: "MatchStructure"; readonly literalIndex: number }
  | { readonly type: "Split"; readonly a: number; readonly b: number }
  | { readonly type: "Jump"; readonly address: number }
  | { readonly type: "PushAxis"; readonly axis: Axis }
  | { readonly type: "Pop" }
  | { readonly type: "Save" }
  | { readonly type: "Accept" }
  | { readonly type: "Search"; readonly patternIndex: number; readonly captureMap: [string, number][] }
  | { readonly type: "ExtendTraversal" }
  | { readonly type: "CombineTraversal" }
  | { readonly type: "NavigateSubject" }
  | { readonly type: "NotMatch"; readonly patternIndex: number }
  | { readonly type: "Repeat"; readonly patternIndex: number; readonly quantifier: Quantifier }
  | { readonly type: "CaptureStart"; readonly captureIndex: number }
  | { readonly type: "CaptureEnd"; readonly captureIndex: number };

export type Axis = "Subject" | "Assertion" | "Predicate" | "Object" | "Wrapped";
```

---

## Pattern Syntax Reference

The parser will support the human-readable pattern expression syntax:

```
# Logical operators
pattern1 & pattern2           # AND
pattern1 | pattern2           # OR
!pattern                      # NOT

# Traversal
pattern1 , pattern2           # Sequential traversal

# Search (recursive)
~ pattern                     # Deep search

# Quantifiers (regex-like)
pattern *                     # 0 or more
pattern +                     # 1 or more
pattern ?                     # 0 or 1
pattern {n,m}                 # Range
pattern {n,}                  # At least n

# Captures
@name(pattern)                # Named capture

# Grouping
(pattern)                     # Parentheses for precedence

# Leaf patterns
"text"                        # Literal text
/regex/                       # Regular expression on text
#hexvalue                     # Hex literal
12.34                         # Numbers
true, false                   # Booleans
null                          # Null value

# Structure patterns
<subject>                     # Node subject
.assertions                   # Assertions
.elided, .encrypted, .compressed # Obscured types

# Keywords
any_node()
any_text()
any_date()
# ... many more
```

---

## Conventions to Follow

1. **File naming:** kebab-case (e.g., `bool-pattern.ts`)
2. **Type naming:** PascalCase (e.g., `BoolPattern`)
3. **Function naming:** camelCase (e.g., `parsePattern`)
4. **Error handling:** Discriminated unions with `Result<T>` type
5. **Private fields:** Use `#fieldName` syntax
6. **Type guards:** `is*()` functions
7. **Safe extraction:** `as*()` functions returning `T | undefined`
8. **Assertions:** `expect*()` functions throwing on failure
9. **Immutability:** Use `readonly` where appropriate
10. **Documentation:** JSDoc with `@example` blocks

---

## Progress Tracking

**Total Files:** ~60 source files + ~15 test files
**Estimated Phases:** 15

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Package Setup | ✅ Complete |
| 2 | Core Types | ✅ Complete (error.ts, format.ts) |
| 3 | Lexer/Tokenizer | ✅ Complete (token.ts, utils.ts) |
| 4 | Leaf Patterns | ✅ Complete (API aligned) |
| 5 | Structure Patterns | ✅ Complete (API aligned) |
| 6 | Meta Patterns | ✅ Complete (API aligned) |
| 7 | Pattern Core & Matcher | ✅ Complete (API aligned) |
| 8 | VM Execution | 🔲 Stub only |
| 9 | Parsers - Leaf | 🔲 Pending |
| 10 | Parsers - Structure | 🔲 Pending |
| 11 | Parsers - Meta | 🔲 Pending |
| 12 | Main Parser Entry | 🔲 Pending |
| 13 | Main Export | ✅ Complete (src/index.ts) |
| 14 | Tests | 🔲 Pending |
| 15 | Final | 🔲 Build passes, tests pending |

### 2024-12-30: Implementation Session Notes

**Files Created:**
- `src/error.ts` - Error types and Result type
- `src/format.ts` - Path formatting utilities
- `src/parse/token.ts` - Token enum and manual Lexer implementation
- `src/parse/utils.ts` - Parser utility functions (partial)
- `src/pattern/matcher.ts` - Matcher interface
- `src/pattern/vm.ts` - VM instruction types (stub)
- `src/pattern/leaf/*.ts` - All 11 leaf pattern types
- `src/pattern/structure/*.ts` - All 9 structure pattern types
- `src/pattern/meta/*.ts` - All 8 meta pattern types
- `src/pattern/index.ts` - Main Pattern type with convenience constructors

**API Alignment Issues Identified (All Resolved ✅):**
1. ✅ dcbor-pattern uses `kind` for Pattern discriminator, not `type`
2. ✅ dcbor-pattern uses factory functions (e.g., `boolPatternAny()`) not class methods (e.g., `BoolPattern.any()`)
3. ✅ Interval uses `exactly()` not `exact()`, and `from()` not `range()`
4. ✅ Quantifier uses `exactly()` not `fromInterval()`
5. ✅ Reluctance uses `Greedy` enum value, not `greedy()` method
6. ✅ Envelope API: use `haystack.case().type === "knownValue"` for KnownValue detection
7. ✅ Digest API: uses `hex` property not `toHex()` method, and `data()` is a method
8. ✅ Pattern types use `kind: "Value" | "Structure" | "Meta"` at top level
9. ✅ Tag type is in @bcts/dcbor, not @bcts/tags
10. ✅ Digest type from @bcts/envelope differs from @bcts/components

**Next Steps:**
1. ~~Align leaf patterns with dcbor-pattern's actual API~~ ✅ Done
2. ~~Update Pattern type to use `kind` discriminator~~ ✅ Done
3. ~~Fix Envelope integration once Envelope API is confirmed~~ ✅ Done
4. Complete VM implementation
5. Implement parsers

### 2024-12-30: API Alignment Session (Continuation)

**Issues Fixed:**

1. **known-value-pattern.ts**
   - Changed from class methods to factory functions (`knownValuePatternAny`, `knownValuePatternValue`, etc.)
   - Fixed `asKnownValue()` to use `haystack.case().type === "knownValue"`
   - Implemented custom `equals()` and `hashCode()` methods

2. **tagged-pattern.ts**
   - Import `Tag` from `@bcts/dcbor` instead of `@bcts/tags`
   - Use factory functions (`taggedPatternAny`, `taggedPatternWithTag`, etc.)
   - Changed destructuring from tuple to object for `taggedPatternPathsWithCaptures`
   - Use `Envelope.newLeaf()` for creating envelopes from CBOR values
   - Implemented custom `equals()` and `hashCode()` methods

3. **digest-pattern.ts**
   - Import `Digest` from `@bcts/envelope` instead of `@bcts/components`
   - Use `digest.data()` method instead of `digest.data` property
   - Implemented custom hash code calculation

4. **null-pattern.ts**
   - Create `NullPattern` directly as `{ variant: "Null" }` instead of calling wrapper function

5. **parse/utils.ts**
   - Fixed `cborFromDiagnostic` stub to return proper discriminated union type

6. **pattern/index.ts**
   - Changed `CborEncodable` to `CborInput` for correct type compatibility
   - Import `Digest` from `@bcts/envelope`

7. **leaf-structure-pattern.ts**
   - Use `haystack.case().type === "knownValue"` instead of `haystack.isKnownValue()`

8. **Various index files**
   - Restored necessary type imports

9. **Meta/structure patterns**
   - Prefixed unused factory variables with underscore for late-binding infrastructure

**Key API Patterns Learned:**
- dcbor-pattern uses factory functions (not class methods)
- `patternPathsWithCaptures()` returns `{ paths, captures }` object, not tuple
- `Envelope.newLeaf()` for creating envelopes from Cbor values
- Access KnownValue via `haystack.case().type === "knownValue"`
- `Tag` type is in `@bcts/dcbor`, not `@bcts/tags`
- Envelope's `Digest` class is different from components' `Digest`
- `Interval.from()` not `Interval.range()`
- `Quantifier.exactly(1)` not `Quantifier.new()`
- `e.digest().hex` not `e.digest().toHex()`

**Build Status:** ✅ Passes (with TS6133 warnings for unused late-binding variables)

---

## Notes

- The Rust implementation uses `logos` for lexing - implement a manual lexer in TypeScript
- The VM is a Thompson-style NFA with thread-based execution
- Heavy reuse of `@bcts/dcbor-pattern` types (Quantifier, Interval, Reluctance)
- Envelope traversal uses axis-based navigation (Subject, Assertion, Predicate, Object, Wrapped)
- Maintain exact function signatures for 1:1 correspondence
- Port all inline `#[cfg(test)]` modules as separate test files
- Circular dependencies may require late-binding registry pattern (as in dcbor-pattern)

---

## Key Differences from dcbor-pattern

| Aspect | dcbor-pattern | envelope-pattern |
|--------|---------------|------------------|
| Target | CBOR values | Envelope structures |
| Path type | `Cbor[]` | `Envelope[]` |
| Navigation | Array/Map traversal | Axis-based (Subject/Predicate/Object) |
| Structure patterns | Array, Map, Tagged | Node, Assertion, Subject, Predicate, Object, Wrapped, Obscured |
| Traversal | Sequence pattern | Traverse pattern |
| Integration | Standalone | Uses dcbor-pattern for CBOR matching |

---

## References

- Rust source: `ref/bc-envelope-pattern-rust/`
- dcbor-pattern TS: `packages/dcbor-pattern/`
- envelope TS: `packages/envelope/`
- Shared configs: `shared/tsconfig/`, `shared/eslint/`
