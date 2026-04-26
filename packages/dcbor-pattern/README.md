# Blockchain Commons Pattern Matcher for dCBOR (TypeScript)

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/dcbor-pattern` provides a powerful pattern matching language for querying and extracting data from [dCBOR](https://github.com/paritytech/bcts/tree/main/packages/dcbor) (Deterministic CBOR) structures. It supports value matching, structural patterns, and meta-patterns with named captures.

The pattern language is designed to be expressive yet concise, allowing you to match complex nested structures with simple pattern expressions.

## Rust Reference Implementation

This TypeScript implementation is based on [bc-dcbor-pattern-rust](https://github.com/BlockchainCommons/bc-dcbor-pattern-rust) **v0.11.1** ([commit](https://github.com/BlockchainCommons/bc-dcbor-pattern-rust/tree/f796d7560f8d39b57b9c1e925cb932ee70860804)).

## Regex compatibility

Several pattern variants accept user-supplied regular expressions:

| Pattern | Where the regex appears |
|---|---|
| `TextPattern` | `/pattern/` text-match form (`pattern/value/text-pattern.ts`) |
| `ByteStringPattern` | binary regex form (`pattern/value/bytestring-pattern.ts`) |
| `DigestPattern` (`BinaryRegex`) | `pattern/value/digest-pattern.ts` |
| `DatePattern` | regex form (`pattern/value/date-pattern.ts`) |
| `KnownValuePattern` | regex form (`pattern/value/known-value-pattern.ts`) |
| `TaggedPattern` | regex form (`parse/structure/tagged-parser.ts`) |
| Lexer regex literal validation | `parse/token.ts` |

The TypeScript port uses the JavaScript engine's native [`RegExp`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp); the Rust reference implementation uses the [`regex` crate](https://docs.rs/regex/). The two engines are **not feature-equivalent** — and since neither is a subset of the other, certain user-written patterns are accepted on one side and rejected on the other. Bundling a Rust-compatible regex engine into the TS port (e.g. via WASM) is out of scope, so this divergence is **documented and accepted**.

### Differences

- **Possessive quantifiers** (`*+`, `++`, `?+`) — Rust `regex` supports them; JS `RegExp` does not (parses as a syntax error). _Rust-only feature._
- **Look-around** (`(?=…)`, `(?!…)`, `(?<=…)`, `(?<!…)`) — JS `RegExp` supports all four; Rust `regex` does not (the crate explicitly excludes look-around to keep linear-time guarantees). _JS-only feature._
- **Unicode property classes** (`\p{…}`, `\P{…}`) — both engines support them, but with different syntaxes for class names and aliases. A property class that compiles on one side may fail or match a different code-point set on the other.
- **Anchors `\A` / `\z`** — Rust `regex` supports `\A` (start of input) and `\z` (end of input); JS `RegExp` does not — use `^` / `$` instead. Note that JS `^`/`$` are line-anchored under the `m` flag, so they are not always exact substitutes.
- **Atomic groups `(?>...)`** — Rust `regex` does not support them; JS `RegExp` does not either. Listed for completeness; neither engine accepts these.

### Recommended subset for cross-impl portability

If you need a regex that compiles and matches identically under both Rust and TS, restrict yourself to:

- ASCII character classes (`[a-z]`, `\d`, `\w`, `\s`, etc.) without Unicode property class names
- Greedy and lazy quantifiers (`*`, `+`, `?`, `*?`, `+?`, `??`, `{n,m}`, `{n,m}?`)
- Capturing and non-capturing groups (`(...)`, `(?:...)`)
- Alternation (`|`)
- The `^` / `$` anchors (avoid `\A` / `\z`)
- Plain backreferences (`\1`, `\2`, …)

Avoid:

- Possessive quantifiers (`*+`, `++`, `?+`)
- Look-around assertions
- `\p{…}` Unicode property classes
- `\A` / `\z` anchors

### Behaviour when a regex is rejected

The TS port surfaces the underlying JS `SyntaxError` from `new RegExp(...)` to the caller as a parse error of the surrounding pattern. There is no silent fallback or feature-flag emulation — a rejected regex propagates as a parse failure exactly as Rust's `regex::Error` would.
