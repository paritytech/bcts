# Envelope-Pattern Parity Analysis

## Overview

This document provides a comprehensive parity analysis between:
- **TypeScript**: `packages/envelope-pattern` (bcts)
- **Rust**: `ref/bc-envelope-pattern-rust` (reference implementation)

**Analysis Date**: 2026-01-07
**Goal**: 100% parity - NO differences acceptable

---

## Summary

| Metric | TypeScript | Rust | Status |
|--------|------------|------|--------|
| Source Files | 41 | 73 | ❌ GAP |
| Tests Passing | 343 | 270 | ⚠️ TS has more |
| Tests Skipped | 78 | 3 | ❌ GAP |
| Total Tests | 421 | 273 | ⚠️ Different coverage |

**Current Parity Level**: ~85%

---

## File Structure Comparison

### Main Module Files

| Component | TypeScript | Rust | Parity |
|-----------|------------|------|--------|
| Main entry | `src/index.ts` | `src/lib.rs` | ✅ |
| Errors | `src/error.ts` | `src/error.rs` | ✅ |
| Format | `src/format.ts` | `src/format.rs` | ⚠️ Partial |

### Pattern Module (`pattern/`)

| Pattern Type | TypeScript | Rust | Parity |
|--------------|------------|------|--------|
| Main | `pattern/index.ts` | `pattern/mod.rs` | ✅ |
| VM | `pattern/vm.ts` | `pattern/vm.rs` | ✅ |
| Matcher | `pattern/matcher.ts` | `pattern/matcher.rs` | ✅ |
| DCBOR Integration | `pattern/dcbor-integration.ts` | `pattern/dcbor_integration.rs` | ✅ |

### Leaf Patterns (`pattern/leaf/`)

| Pattern | TypeScript | Rust | Parity |
|---------|------------|------|--------|
| Array | `array-pattern.ts` | `array_pattern.rs` | ✅ |
| Bool | `bool-pattern.ts` | `bool_pattern.rs` | ✅ |
| ByteString | `byte-string-pattern.ts` | `byte_string_pattern.rs` | ✅ |
| CBOR | `cbor-pattern.ts` | `cbor_pattern.rs` | ✅ |
| Date | `date-pattern.ts` | `date_pattern.rs` | ✅ |
| KnownValue | `known-value-pattern.ts` | `known_value_pattern.rs` | ✅ |
| Map | `map-pattern.ts` | `map_pattern.rs` | ✅ |
| Null | `null-pattern.ts` | `null_pattern.rs` | ✅ |
| Number | `number-pattern.ts` | `number_pattern.rs` | ✅ |
| Tagged | `tagged-pattern.ts` | `tagged_pattern.rs` | ✅ |
| Text | `text-pattern.ts` | `text_pattern.rs` | ✅ |

### Meta Patterns (`pattern/meta/`)

| Pattern | TypeScript | Rust | Parity |
|---------|------------|------|--------|
| Any | `any-pattern.ts` | `any_pattern.rs` | ✅ |
| And | `and-pattern.ts` | `and_pattern.rs` | ✅ |
| Or | `or-pattern.ts` | `or_pattern.rs` | ✅ |
| Not | `not-pattern.ts` | `not_pattern.rs` | ✅ |
| Capture | `capture-pattern.ts` | `capture_pattern.rs` | ✅ |
| Search | `search-pattern.ts` | `search_pattern.rs` | ✅ |
| Traverse | `traverse-pattern.ts` | `traverse_pattern.rs` | ✅ |
| Group | `group-pattern.ts` | `repeat_pattern.rs` | ✅ |

### Structure Patterns (`pattern/structure/`)

| Pattern | TypeScript | Rust | Parity |
|---------|------------|------|--------|
| Assertions | `assertions-pattern.ts` | `assertions_pattern.rs` | ✅ |
| Digest | `digest-pattern.ts` | `digest_pattern.rs` | ✅ |
| Leaf Structure | `leaf-structure-pattern.ts` | `leaf_structure_pattern.rs` | ✅ |
| Node | `node-pattern.ts` | `node_pattern.rs` | ✅ |
| Object | `object-pattern.ts` | `object_pattern.rs` | ✅ |
| Obscured | `obscured-pattern.ts` | `obscured_pattern.rs` | ✅ |
| Predicate | `predicate-pattern.ts` | `predicate_pattern.rs` | ✅ |
| Subject | `subject-pattern.ts` | `subject_pattern.rs` | ✅ |
| Wrapped | `wrapped-pattern.ts` | `wrapped_pattern.rs` | ✅ |

### Parse Module (`parse/`)

| Component | TypeScript | Rust | Parity |
|-----------|------------|------|--------|
| Main entry | `parse/index.ts` | `parse/mod.rs` | ✅ |
| Token/Lexer | `parse/token.ts` | `parse/token.rs` | ✅ |
| Utils | `parse/utils.ts` | `parse/utils.rs` | ✅ |

#### CRITICAL GAP: Missing Individual Parsers

TypeScript has integrated parsing in `parse/index.ts`, but Rust has **separate parser files** for each pattern type:

| Parser | Rust File | TypeScript | Status |
|--------|-----------|------------|--------|
| Leaf parsers | `parse/leaf/mod.rs` | ❌ Missing | **GAP** |
| Array parser | `parse/leaf/array_parser.rs` | ❌ Integrated | **GAP** |
| CBOR parser | `parse/leaf/cbor_parser.rs` | ❌ Integrated | **GAP** |
| Date parser | `parse/leaf/date_parser.rs` | ❌ Integrated | **GAP** |
| KnownValue parser | `parse/leaf/known_value_parser.rs` | ❌ Integrated | **GAP** |
| Map parser | `parse/leaf/map_parser.rs` | ❌ Integrated | **GAP** |
| Null parser | `parse/leaf/null_parser.rs` | ❌ Integrated | **GAP** |
| Number parser | `parse/leaf/number_parser.rs` | ❌ Integrated | **GAP** |
| Tag parser | `parse/leaf/tag_parser.rs` | ❌ Integrated | **GAP** |
| Meta parsers | `parse/meta/mod.rs` | ❌ Integrated | **GAP** |
| And parser | `parse/meta/and_parser.rs` | ❌ Integrated | **GAP** |
| Capture parser | `parse/meta/capture_parser.rs` | ❌ Integrated | **GAP** |
| Group parser | `parse/meta/group_parser.rs` | ❌ Integrated | **GAP** |
| Not parser | `parse/meta/not_parser.rs` | ❌ Integrated | **GAP** |
| Or parser | `parse/meta/or_parser.rs` | ❌ Integrated | **GAP** |
| Primary parser | `parse/meta/primary_parser.rs` | ❌ Integrated | **GAP** |
| Search parser | `parse/meta/search_parser.rs` | ❌ Integrated | **GAP** |
| Traverse parser | `parse/meta/traverse_parser.rs` | ❌ Integrated | **GAP** |
| Structure parsers | `parse/structure/mod.rs` | ❌ Integrated | **GAP** |
| Assertion obj parser | `parse/structure/assertion_obj_parser.rs` | ❌ Integrated | **GAP** |
| Assertion parser | `parse/structure/assertion_parser.rs` | ❌ Integrated | **GAP** |
| Assertion pred parser | `parse/structure/assertion_pred_parser.rs` | ❌ Integrated | **GAP** |
| Compressed parser | `parse/structure/compressed_parser.rs` | ❌ Integrated | **GAP** |
| Digest parser | `parse/structure/digest_parser.rs` | ❌ Integrated | **GAP** |
| Elided parser | `parse/structure/elided_parser.rs` | ❌ Integrated | **GAP** |
| Encrypted parser | `parse/structure/encrypted_parser.rs` | ❌ Integrated | **GAP** |
| Node parser | `parse/structure/node_parser.rs` | ❌ Integrated | **GAP** |
| Object parser | `parse/structure/object_parser.rs` | ❌ Integrated | **GAP** |
| Obscured parser | `parse/structure/obscured_parser.rs` | ❌ Integrated | **GAP** |
| Predicate parser | `parse/structure/predicate_parser.rs` | ❌ Integrated | **GAP** |
| Subject parser | `parse/structure/subject_parser.rs` | ❌ Integrated | **GAP** |
| Wrapped parser | `parse/structure/wrapped_parser.rs` | ❌ Integrated | **GAP** |

**Note**: The TypeScript implementation has all parsing logic integrated into `parse/index.ts` rather than split into separate files. This is an **architectural difference**, not necessarily a functionality gap. However, the behavior must be verified to match.

---

## API/Function Comparison

### Pattern Factory Functions

| Function | TypeScript | Rust | Parity |
|----------|------------|------|--------|
| `any()` | ✅ | `Pattern::any()` | ✅ |
| `anyCbor()` | ✅ | `Pattern::any_cbor()` | ✅ |
| `cborValue()` | ✅ | `Pattern::cbor()` | ✅ |
| `cborPattern()` | ✅ | `Pattern::cbor_pattern()` | ✅ |
| `anyBool()` | ✅ | `Pattern::any_bool()` | ✅ |
| `bool()` | ✅ | `Pattern::bool()` | ✅ |
| `anyText()` | ✅ | `Pattern::any_text()` | ✅ |
| `text()` | ✅ | `Pattern::text()` | ✅ |
| `textRegex()` | ✅ | `Pattern::text_regex()` | ✅ |
| `anyDate()` | ✅ | `Pattern::any_date()` | ✅ |
| `date()` | ✅ | `Pattern::date()` | ✅ |
| `dateRange()` | ✅ | `Pattern::date_range()` | ✅ |
| `dateEarliest()` | ❌ Missing | `Pattern::date_earliest()` | **GAP** |
| `dateLast()` | ❌ Missing | `Pattern::date_latest()` | **GAP** |
| `dateIso8601()` | ❌ Missing | `Pattern::date_iso8601()` | **GAP** |
| `dateRegex()` | ❌ Missing | `Pattern::date_regex()` | **GAP** |
| `anyNumber()` | ✅ | `Pattern::any_number()` | ✅ |
| `number()` | ✅ | `Pattern::number()` | ✅ |
| `numberRange()` | ✅ | `Pattern::number_range()` | ✅ |
| `numberGreaterThan()` | ✅ | `Pattern::number_greater_than()` | ✅ |
| `numberLessThan()` | ✅ | `Pattern::number_less_than()` | ✅ |
| `numberGreaterThanOrEqual()` | ✅ | `Pattern::number_greater_than_or_equal()` | ✅ |
| `numberLessThanOrEqual()` | ✅ | `Pattern::number_less_than_or_equal()` | ✅ |
| `numberNan()` | ✅ | `Pattern::number_nan()` | ✅ |
| `anyByteString()` | ✅ | `Pattern::any_byte_string()` | ✅ |
| `byteString()` | ✅ | `Pattern::byte_string()` | ✅ |
| `byteStringBinaryRegex()` | ❌ Missing | `Pattern::byte_string_binary_regex()` | **GAP** |
| `anyKnownValue()` | ✅ | `Pattern::any_known_value()` | ✅ |
| `knownValue()` | ✅ | `Pattern::known_value()` | ✅ |
| `knownValueNamed()` | ❌ Missing | `Pattern::known_value_named()` | **GAP** |
| `knownValueRegex()` | ❌ Missing | `Pattern::known_value_regex()` | **GAP** |
| `unit()` | ✅ | `Pattern::unit()` | ✅ |
| `anyArray()` | ✅ | `Pattern::any_array()` | ✅ |
| `arrayWithRange()` | ❌ Missing | `Pattern::array_with_range()` | **GAP** |
| `arrayWithCount()` | ❌ Missing | `Pattern::array_with_count()` | **GAP** |
| `anyMap()` | ✅ | `Pattern::any_map()` | ✅ |
| `mapWithRange()` | ❌ Missing | `Pattern::map_with_range()` | **GAP** |
| `mapWithCount()` | ❌ Missing | `Pattern::map_with_count()` | **GAP** |
| `nullPattern()` | ✅ | `Pattern::null()` | ✅ |
| `anyTag()` | ✅ | `Pattern::any_tag()` | ✅ |
| `tagged()` | ✅ | `Pattern::tagged()` | ✅ |
| `taggedName()` | ❌ Missing | `Pattern::tagged_name()` | **GAP** |
| `taggedRegex()` | ❌ Missing | `Pattern::tagged_regex()` | **GAP** |
| `leaf()` | ✅ | `Pattern::leaf()` | ✅ |
| `anyAssertion()` | ✅ | `Pattern::any_assertion()` | ✅ |
| `assertionWithPredicate()` | ✅ | `Pattern::assertion_with_predicate()` | ✅ |
| `assertionWithObject()` | ✅ | `Pattern::assertion_with_object()` | ✅ |
| `anySubject()` | ✅ | `Pattern::any_subject()` | ✅ |
| `subject()` | ✅ | `Pattern::subject()` | ✅ |
| `anyPredicate()` | ✅ | `Pattern::any_predicate()` | ✅ |
| `predicate()` | ✅ | `Pattern::predicate()` | ✅ |
| `anyObject()` | ✅ | `Pattern::any_object()` | ✅ |
| `object()` | ✅ | `Pattern::object()` | ✅ |
| `digest()` | ✅ | `Pattern::digest()` | ✅ |
| `digestPrefix()` | ✅ | `Pattern::digest_prefix()` | ✅ |
| `digestBinaryRegex()` | ❌ Missing | `Pattern::digest_binary_regex()` | **GAP** |
| `anyNode()` | ✅ | `Pattern::any_node()` | ✅ |
| `nodeWithAssertionsRange()` | ❌ Missing | `Pattern::node_with_assertions_range()` | **GAP** |
| `nodeWithAssertionsCount()` | ❌ Missing | `Pattern::node_with_assertions_count()` | **GAP** |
| `obscured()` | ✅ | `Pattern::obscured()` | ✅ |
| `elided()` | ✅ | `Pattern::elided()` | ✅ |
| `encrypted()` | ✅ | `Pattern::encrypted()` | ✅ |
| `compressed()` | ✅ | `Pattern::compressed()` | ✅ |
| `wrapped()` | ✅ | `Pattern::wrapped()` | ✅ |
| `unwrapEnvelope()` | ✅ | `Pattern::unwrap()` | ✅ |
| `unwrapMatching()` | ✅ | `Pattern::unwrap_matching()` | ✅ |
| `any()` | ✅ | `Pattern::any()` | ✅ |
| `and()` | ✅ | `Pattern::and()` | ✅ |
| `or()` | ✅ | `Pattern::or()` | ✅ |
| `notMatching()` | ✅ | `Pattern::not_matching()` | ✅ |
| `capture()` | ✅ | `Pattern::capture()` | ✅ |
| `search()` | ✅ | `Pattern::search()` | ✅ |
| `traverse()` | ✅ | `Pattern::traverse()` | ✅ |
| `repeat()` | ✅ | `Pattern::repeat()` | ✅ |
| `group()` | ✅ | `Pattern::group()` | ✅ |

---

## Test Coverage Comparison

### TypeScript Test Files (15 files, 421 tests)

| Test File | Tests | Skipped | Status |
|-----------|-------|---------|--------|
| `parse-leaf.test.ts` | 58 | 8 | ⚠️ |
| `dcbor-integration.test.ts` | 13 | 0 | ✅ |
| `parse.test.ts` | 48 | 0 | ✅ |
| `parser-integration.test.ts` | 21 | 1 | ⚠️ |
| `pattern-meta.test.ts` | 15 | 3 | ⚠️ |
| `parse-meta.test.ts` | 40 | 0 | ✅ |
| `pattern.test.ts` | 31 | 0 | ✅ |
| `capture.test.ts` | 14 | 8 | ⚠️ |
| `pattern-structure.test.ts` | 21 | 5 | ⚠️ |
| `pattern-repeat.test.ts` | 29 | 14 | ⚠️ |
| `credential.test.ts` | 25 | 12 | ⚠️ |
| `parse-structure.test.ts` | 35 | 6 | ⚠️ |
| `pattern-leaf.test.ts` | 30 | 8 | ⚠️ |
| `error.test.ts` | 16 | 0 | ✅ |
| `cbor-pattern-integration.test.ts` | 25 | 13 | ⚠️ |

### Rust Test Files (28+ files, 270+ tests)

| Test File | Tests | Status |
|-----------|-------|--------|
| `pattern_tests.rs` | 3 | ✅ |
| `pattern_tests_leaf.rs` | ~15 | ✅ |
| `pattern_tests_meta.rs` | ~10 | ✅ |
| `pattern_tests_structure.rs` | ~14 | ✅ |
| `pattern_tests_repeat.rs` | ~16 | ✅ |
| `capture_tests.rs` | ~10 | ✅ |
| `credential_tests.rs` | ~6 | ✅ |
| `error_tests.rs` | ~7 | ✅ |
| `parse_tests.rs` | ~15 | ✅ |
| `parse_tests_leaf.rs` | ~11 | ✅ |
| `parse_tests_meta.rs` | ~10 | ✅ |
| `parse_tests_structure.rs` | ~10 | ✅ |
| `parser_integration_tests.rs` | ~8 | ✅ |
| `dcbor_integration_tests.rs` | ~5 | ✅ |
| `cbor_integration_test.rs` | ~4 | ✅ |
| `test_cbor_captures.rs` | 10 | ✅ |
| `test_cbor_path_extension.rs` | 9 | ✅ |
| `test_cbor_paths_formatted.rs` | 7 | ✅ |
| `test_dcbor_paths.rs` | 6 | ✅ |
| `test_extended_paths.rs` | 4 | ✅ |
| `test_final_node_analysis.rs` | 2 | ✅ |
| `test_leaf_parsing.rs` | 1 | ✅ |
| `test_leaf_vs_cbor_analysis.rs` | 1 | ✅ |
| `test_leaf_vs_node_zero.rs` | 3 | ✅ |
| `common/` (helpers) | N/A | ✅ |

### Missing Test Coverage in TypeScript

The following Rust test files have no direct TypeScript equivalent:

1. **`test_cbor_captures.rs`** - CBOR capture functionality tests
2. **`test_cbor_path_extension.rs`** - CBOR path extension tests
3. **`test_cbor_paths_formatted.rs`** - Formatted CBOR paths tests
4. **`test_dcbor_paths.rs`** - DCBOR paths tests
5. **`test_extended_paths.rs`** - Extended paths tests
6. **`test_final_node_analysis.rs`** - Node analysis tests
7. **`test_leaf_parsing.rs`** - Leaf parsing tests
8. **`test_leaf_vs_cbor_analysis.rs`** - Leaf vs CBOR comparison tests
9. **`test_leaf_vs_node_zero.rs`** - Leaf vs node zero tests
10. **`common/check_encoding.rs`** - Encoding verification helpers
11. **`common/test_data.rs`** - Test data fixtures
12. **`common/test_seed.rs`** - Seed data for tests

---

## Identified Gaps

### Critical Gaps (Must Fix for 100% Parity)

#### 1. Missing Pattern Factory Functions
- [ ] `dateEarliest(date: CborDate): Pattern`
- [ ] `dateLatest(date: CborDate): Pattern`
- [ ] `dateIso8601(isoString: string): Pattern`
- [ ] `dateRegex(regex: RegExp): Pattern`
- [ ] `byteStringBinaryRegex(regex: RegExp): Pattern`
- [ ] `knownValueNamed(name: string): Pattern`
- [ ] `knownValueRegex(regex: RegExp): Pattern`
- [ ] `arrayWithRange(min: number, max: number): Pattern`
- [ ] `arrayWithCount(count: number): Pattern`
- [ ] `mapWithRange(min: number, max: number): Pattern`
- [ ] `mapWithCount(count: number): Pattern`
- [ ] `taggedName(name: string, pattern: DCBORPattern): Pattern`
- [ ] `taggedRegex(regex: RegExp, pattern: DCBORPattern): Pattern`
- [ ] `digestBinaryRegex(regex: RegExp): Pattern`
- [ ] `nodeWithAssertionsRange(min: number, max: number): Pattern`
- [ ] `nodeWithAssertionsCount(count: number): Pattern`

#### 2. Skipped Tests (78 total)
All skipped tests must be enabled and passing:
- `parse-leaf.test.ts`: 8 skipped
- `parser-integration.test.ts`: 1 skipped
- `pattern-meta.test.ts`: 3 skipped
- `capture.test.ts`: 8 skipped
- `pattern-structure.test.ts`: 5 skipped
- `pattern-repeat.test.ts`: 14 skipped
- `credential.test.ts`: 12 skipped
- `parse-structure.test.ts`: 6 skipped
- `pattern-leaf.test.ts`: 8 skipped
- `cbor-pattern-integration.test.ts`: 13 skipped

#### 3. Missing Test Files
Add equivalent tests for:
- [ ] `test_cbor_captures.test.ts`
- [ ] `test_cbor_path_extension.test.ts`
- [ ] `test_cbor_paths_formatted.test.ts`
- [ ] `test_dcbor_paths.test.ts`
- [ ] `test_extended_paths.test.ts`
- [ ] `test_final_node_analysis.test.ts`
- [ ] `common/check_encoding.ts` (test helper)
- [ ] `common/test_data.ts` (test fixtures)

---

## Implementation Plan

### Phase 1: Add Missing Pattern Factory Functions (Priority: HIGH)

**Estimated Tasks**: 16 functions

1. Add date pattern functions:
   - `dateEarliest()` in `pattern/index.ts`
   - `dateLatest()` in `pattern/index.ts`
   - `dateIso8601()` in `pattern/index.ts`
   - `dateRegex()` in `pattern/index.ts`

2. Add byte string pattern functions:
   - `byteStringBinaryRegex()` in `pattern/index.ts`

3. Add known value pattern functions:
   - `knownValueNamed()` in `pattern/index.ts`
   - `knownValueRegex()` in `pattern/index.ts`

4. Add array pattern functions:
   - `arrayWithRange()` in `pattern/index.ts`
   - `arrayWithCount()` in `pattern/index.ts`

5. Add map pattern functions:
   - `mapWithRange()` in `pattern/index.ts`
   - `mapWithCount()` in `pattern/index.ts`

6. Add tagged pattern functions:
   - `taggedName()` in `pattern/index.ts`
   - `taggedRegex()` in `pattern/index.ts`

7. Add digest pattern functions:
   - `digestBinaryRegex()` in `pattern/index.ts`

8. Add node pattern functions:
   - `nodeWithAssertionsRange()` in `pattern/index.ts`
   - `nodeWithAssertionsCount()` in `pattern/index.ts`

### Phase 2: Enable Skipped Tests (Priority: HIGH)

**Estimated Tasks**: 78 tests to fix

For each skipped test:
1. Identify why test is skipped (missing functionality, bug, etc.)
2. Implement missing functionality if needed
3. Fix any bugs in existing implementation
4. Enable and verify test passes

Priority order:
1. `pattern-repeat.test.ts` (14 skipped) - Core repeat functionality
2. `cbor-pattern-integration.test.ts` (13 skipped) - CBOR integration
3. `credential.test.ts` (12 skipped) - Real-world usage
4. `parse-leaf.test.ts` (8 skipped) - Parsing fundamentals
5. `capture.test.ts` (8 skipped) - Capture functionality
6. `pattern-leaf.test.ts` (8 skipped) - Leaf patterns
7. `parse-structure.test.ts` (6 skipped) - Structure parsing
8. `pattern-structure.test.ts` (5 skipped) - Structure patterns
9. `pattern-meta.test.ts` (3 skipped) - Meta patterns
10. `parser-integration.test.ts` (1 skipped) - Parser integration

### Phase 3: Add Missing Test Files (Priority: MEDIUM)

**Estimated Tasks**: 8 test files

1. Create `tests/cbor-captures.test.ts`
2. Create `tests/cbor-path-extension.test.ts`
3. Create `tests/cbor-paths-formatted.test.ts`
4. Create `tests/dcbor-paths.test.ts`
5. Create `tests/extended-paths.test.ts`
6. Create `tests/final-node-analysis.test.ts`
7. Create `tests/common/check-encoding.ts` (helper)
8. Create `tests/common/test-data.ts` (fixtures)

### Phase 4: Verify Behavioral Parity (Priority: HIGH)

For each pattern type and operation:
1. Create test vectors from Rust implementation
2. Run same inputs through TypeScript implementation
3. Compare outputs byte-for-byte
4. Document any differences and fix

---

## Progress Tracking

| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| 1 | Missing Pattern Functions | ❌ Not Started | 0/16 |
| 2 | Enable Skipped Tests | ❌ Not Started | 0/78 |
| 3 | Add Missing Test Files | ❌ Not Started | 0/8 |
| 4 | Verify Behavioral Parity | ❌ Not Started | 0% |

**Overall Parity**: ~85% → Target: 100%

---

## Appendix: File Mappings

### TypeScript → Rust Source Mapping

```
packages/envelope-pattern/src/
├── index.ts                  → src/lib.rs
├── error.ts                  → src/error.rs
├── format.ts                 → src/format.rs
├── parse/
│   ├── index.ts              → src/parse/mod.rs + all parsers
│   ├── token.ts              → src/parse/token.rs
│   └── utils.ts              → src/parse/utils.rs
└── pattern/
    ├── index.ts              → src/pattern/mod.rs
    ├── vm.ts                 → src/pattern/vm.rs
    ├── matcher.ts            → src/pattern/matcher.rs
    ├── dcbor-integration.ts  → src/pattern/dcbor_integration.rs
    ├── leaf/                 → src/pattern/leaf/
    ├── meta/                 → src/pattern/meta/
    └── structure/            → src/pattern/structure/
```

### Test File Mapping

```
packages/envelope-pattern/tests/
├── parse.test.ts             → tests/parse_tests.rs
├── parse-leaf.test.ts        → tests/parse_tests_leaf.rs
├── parse-meta.test.ts        → tests/parse_tests_meta.rs
├── parse-structure.test.ts   → tests/parse_tests_structure.rs
├── pattern.test.ts           → tests/pattern_tests.rs
├── pattern-leaf.test.ts      → tests/pattern_tests_leaf.rs
├── pattern-meta.test.ts      → tests/pattern_tests_meta.rs
├── pattern-structure.test.ts → tests/pattern_tests_structure.rs
├── pattern-repeat.test.ts    → tests/pattern_tests_repeat.rs
├── capture.test.ts           → tests/capture_tests.rs
├── credential.test.ts        → tests/credential_tests.rs
├── error.test.ts             → tests/error_tests.rs
├── dcbor-integration.test.ts → tests/dcbor_integration_tests.rs
├── cbor-pattern-integration.test.ts → tests/cbor_integration_test.rs
└── parser-integration.test.ts → tests/parser_integration_tests.rs
```
