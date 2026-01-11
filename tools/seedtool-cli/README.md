# Blockchain Commons Seedtool CLI (TypeScript)

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/seedtool-cli` is a command line tool for generating and transforming cryptographic seeds. It supports multiple input and output formats including BIP39 mnemonic phrases, hex, SSKR shares, and more.

Features:
- Generate random cryptographic seeds
- Convert between seed formats (hex, BIP39, SSKR, etc.)
- Split seeds using SSKR (Sharded Secret Key Reconstruction)
- Recover seeds from SSKR shares
- Support for deterministic seed generation

## Rust Reference Implementation

This TypeScript implementation is based on [seedtool-cli-rust](https://github.com/BlockchainCommons/seedtool-cli-rust).

## Installation

```bash
# Install globally
bun add -g @bcts/seedtool-cli

# Or run directly with bunx
bunx @bcts/seedtool-cli --help
```

## Usage

### Generate a Random Seed

```bash
# Generate a 16-byte (128-bit) seed (default)
seedtool

# Generate a 32-byte (256-bit) seed
seedtool --count 32
```

### Input/Output Formats

```bash
# Output as BIP39 mnemonic
seedtool --out bip39

# Output as hex
seedtool --out hex

# Input from hex, output as BIP39
seedtool --in hex --out bip39 7e31b2b14b895e75cdb82c22b013527c
```

### SSKR Shares

```bash
# Split a seed into SSKR shares (2-of-3)
seedtool --out sskr --groups 2-of-3

# Recover from SSKR shares
seedtool --in sskr <share1> <share2>
```

## Command Line Reference

```
Usage: seedtool [options] [input...]

Arguments:
  input                Input data (format specified by --in)

Options:
  -c, --count <n>      Number of bytes to generate (default: 16)
  -i, --in <format>    Input format: hex, bip39, sskr, random (default: random)
  -o, --out <format>   Output format: hex, bip39, sskr, ur (default: hex)
  -g, --groups <spec>  SSKR group specification (e.g., "2-of-3")
  -h, --help           Display help
  -V, --version        Display version
```
