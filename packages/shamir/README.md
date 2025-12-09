# Blockchain Commons Shamir Secret Sharing for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

This is a pure TypeScript implementation of [Shamir's Secret Sharing (SSS)](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing), a cryptographic technique in which a _secret_ is divided into parts, called _shares_, in such a way that a _threshold_ of several shares are needed to reconstruct the secret. The shares are distributed in a way that makes it impossible for an attacker to know anything about the secret without having a threshold of shares. If the number of shares is less than the threshold, then no information about the secret is revealed.

## Rust Reference Implementation

This TypeScript implementation is based on [bc-shamir-rust](https://github.com/BlockchainCommons/bc-shamir-rust) **v0.13.0** ([commit](https://github.com/BlockchainCommons/bc-shamir-rust/tree/fcf8deb2b0f51566635a7de89ae6d8d6628921c7)).
