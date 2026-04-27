# Blockchain Commons LifeHash for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

LifeHash is a method of generating visual hashes from data. It is based on [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) cellular automaton. Given the same input, LifeHash will always produce the same visual output, making it useful for verifying data integrity at a glance.

LifeHash generates a unique, colorful, abstract image from any input data. It's designed to be:

- **Deterministic**: Same input always produces the same image
- **Visually Distinct**: Different inputs produce visually different images
- **Human-Friendly**: Easy to recognize and compare at a glance
- **Collision-Resistant**: Hard to find two inputs that produce similar images

## C++ Reference Implementation

This TypeScript implementation is based on [bc-lifehash](https://github.com/BlockchainCommons/bc-lifehash) ([commit 0444dbe](https://github.com/BlockchainCommons/bc-lifehash/tree/0444dbed5615fbc9a98163608c6499c025b7873b)). Test parity is enforced against the 35 upstream test vectors vendored at `tests/fixtures/test-vectors.json`.

## Rust parity fuzz

`tests/parity.test.ts` runs ~1000 deterministic fuzz inputs through the TS port and compares each rendered image's SHA-256 against a pre-computed value produced by [`bc-lifehash` (Rust)](https://github.com/BlockchainCommons/bc-lifehash-rust). The golden file lives at `tests/fixtures/golden.json`.

To regenerate after a meaningful change to the Rust crate:

```sh
cd /path/to/bc-lifehash-rust
cargo run --release --example golden > /path/to/typescript/packages/lifehash/tests/fixtures/golden.json
```

The generator (`examples/golden.rs`) uses a fixed-seed LCG, so re-running it always produces an identical file (verifiable with `diff -q`).
