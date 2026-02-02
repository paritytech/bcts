# Blockchain Commons Gordian Envelope for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

[Gordian Envelope](https://www.blockchaincommons.com/introduction/Envelope-Intro/) is a structured format for hierarchical binary data focused on privacy. The TypeScript implementation provides a feature-rich reference implementation.

Envelopes are designed to facilitate "smart documents" with a number of unique features:

- **Hierarchical structure**: Easy representation of a variety of semantic structures, from simple key-value pairs to complex property graphs
- **Merkle-like digest tree**: Built-in integrity verification at any level of the structure
- **Deterministic representation**: Uses CBOR with deterministic encoding rules for consistent serialization
- **Privacy-focused**: The holder of a document can selectively encrypt or elide specific parts without invalidating the structure, signatures, or digest tree
- **Progressive trust**: Holders can reveal information incrementally to build trust with verifiers

## Specification

Gordian Envelope is formally specified in the [IETF Internet Draft](https://datatracker.ietf.org/doc/draft-mcnally-envelope/).

## Rust Reference Implementation

This TypeScript implementation is based on [bc-envelope-rust](https://github.com/BlockchainCommons/bc-envelope-rust) **v0.42.0** ([commit](https://github.com/BlockchainCommons/bc-envelope-rust/tree/c39b5a30b4a03ab604ba62dfa82eef6c7192426e)).
