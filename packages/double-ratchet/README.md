# Signal's Double Ratchet for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`double-ratchet` is a TypeScript implementation of the Signal Protocol Double Ratchet. It includes X3DH key agreement, session management, group messaging (Sender Keys), sealed sender (anonymous delivery), fingerprint verification, and cryptographic primitives (AES-CBC, AES-GCM-SIV, XEdDSA, incremental MAC).

## Rust Reference Implementation

This TypeScript implementation is based on [libsignal](https://github.com/signalapp/libsignal) **v0.87.1** ([commit](https://github.com/signalapp/libsignal/tree/f08390b0e2f67d5faf47bb9d1a3db191314db93c)).
