# Blockchain Commons Deterministic CBOR ("dCBOR") for TypeScript

> Disclaimer: This package is under active development and APIs may change.

`dcbor` is a [CBOR](https://cbor.io) codec that focuses on writing and parsing "deterministic" CBOR per [§4.2 of RFC-8949](https://www.rfc-editor.org/rfc/rfc8949.html#name-deterministically-encoded-c). It does not support parts of the spec forbidden by deterministic CBOR (such as indefinite length arrays and maps). It is strict in both what it writes and reads: in particular it will return decoding errors if variable-length integers are not encoded in their minimal form, or CBOR map keys are not in lexicographic order, or there is extra data past the end of the decoded CBOR item.

## Specification

The current specification of the norms and practices guiding the creation of this implementation are currently found in this IETF Internet Draft: [draft-mcnally-deterministic-cbor](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/).

## Rust Reference Implementation

This TypeScript implementation is based on [bc-dcbor-rust](https://github.com/BlockchainCommons/bc-dcbor-rust) **v0.24.1** ([commit](https://github.com/BlockchainCommons/bc-dcbor-rust/tree/012be742e89098d1e0630f1f480463b6bdd2e068)).
