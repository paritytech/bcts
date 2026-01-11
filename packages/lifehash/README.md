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

This TypeScript implementation is based on [bc-lifehash](https://github.com/BlockchainCommons/bc-lifehash) ([commit b5e8d43](https://github.com/BlockchainCommons/bc-lifehash/tree/b5e8d431b918951b91b5c3cb8eee27f4469feb6b)).
