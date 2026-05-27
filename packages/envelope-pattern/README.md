# Blockchain Commons Pattern Matcher for Gordian Envelope (TypeScript)

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/envelope-pattern` provides a powerful pattern matching language for querying and extracting data from [Gordian Envelope](https://github.com/paritytech/bcts/tree/main/packages/envelope) structures. It extends the dCBOR pattern matching capabilities with envelope-specific patterns for subjects, predicates, objects, assertions, and wrapped envelopes.

The pattern language is designed to be expressive yet concise, allowing you to match complex nested envelope structures with simple pattern expressions.

## Rust Reference Implementation

This TypeScript implementation is based on [bc-envelope-pattern-rust](https://github.com/BlockchainCommons/bc-envelope-pattern-rust) **v0.14.0** ([commit](https://github.com/BlockchainCommons/bc-envelope-pattern-rust/tree/44fe39832e9321445dc5d6a10b0e1f852d28f982)).
