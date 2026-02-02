# XID: Extensible Identifiers for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

XIDs (eXtensible IDentity, _/zid/_) are unique 32-byte identifiers that represent any entities—real or abstract—such as a person, organization, or device. Generated from the SHA-256 hash of a specific public signing key known as the inception key, a XID provides a stable identity throughout its lifecycle, even as associated keys and permissions evolve. Leveraging Gordian Envelope for XID Documents, XIDs are recursively resolvable and extensible, allowing for detailed assertions about the entity, including key declarations, permissions, controllers, and endpoints. The integration of [provenance marks](https://provemark.com) ensures a verifiable chain of document revisions, enhancing security and authenticity in decentralized identity management.

## Specification

XIDs and XID documents are discussed in [this paper](https://hackmd.io/@bc-community/SkdxVyY11g).

## Rust Reference Implementation

This TypeScript implementation is based on [bc-xid-rust](https://github.com/BlockchainCommons/bc-xid-rust) **v0.21.0** ([commit](https://github.com/BlockchainCommons/bc-xid-rust/tree/f0dc62187fc728d92063ee0ff456a9552a4698cf)).
