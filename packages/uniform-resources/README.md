# Blockchain Commons Uniform Resources for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

[Uniform Resources (URs)](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md) are URI-encoded [CBOR](https://cbor.io) structures developed by [Blockchain Commons](https://blockchaincommons.com). This package is intended primarily for use in higher-level Blockchain Commons projects like Gordian Envelope.

It is a requirement of the UR specification that the CBOR encoded as URs conform to Gordian dCBOR, which is a deterministic profile of CBOR specified in [this IETF Internet Draft](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/).

## Specification

The primary specification for URs is [BCR-2020-005: Uniform Resources](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md).

## Rust Reference Implementation

This TypeScript implementation is based on [bc-ur-rust](https://github.com/BlockchainCommons/bc-ur-rust) **v0.18.0** ([commit](https://github.com/BlockchainCommons/bc-ur-rust/tree/bf793b3a84091446868b4b15a7d71109c1aae273)).
