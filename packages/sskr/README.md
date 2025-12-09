# Blockchain Commons Sharded Secret Key Reconstruction for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

Sharded Secret Key Reconstruction (SSKR) is a protocol for splitting a _secret_ into a set of _shares_ across one or more _groups_, such that the secret can be reconstructed from any combination of shares totaling or exceeding a _threshold_ number of shares within each group and across all groups. SSKR is a generalization of Shamir's Secret Sharing (SSS) that allows for multiple groups and multiple thresholds.

## Specification

SSKR is described in [BCR-2020-011](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-011-sskr.md).

## Rust Reference Implementation

This TypeScript implementation is based on [bc-sskr-rust](https://github.com/BlockchainCommons/bc-sskr-rust) **v0.12.0** ([commit](https://github.com/BlockchainCommons/bc-sskr-rust/tree/177cd9305c152b6cc1b9768651e65e7d563b4e8e)).
