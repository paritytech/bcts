# Signal's Triple Ratchet for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`triple-ratchet` is a TypeScript implementation of the Triple Ratchet protocol. It extends the Double Ratchet with SPQR post-quantum ratchet steps, implementing Signal Protocol v4: X3DH + ML-KEM (Kyber) hybrid key agreement for quantum-resistant end-to-end encryption.

## Rust Reference Implementation

This TypeScript implementation is based on [libsignal](https://github.com/signalapp/libsignal) **v0.87.1** ([commit](https://github.com/signalapp/libsignal/tree/f08390b0e2f67d5faf47bb9d1a3db191314db93c)).
