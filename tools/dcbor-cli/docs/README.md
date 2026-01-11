**@bcts/dcbor-cli v1.0.0-alpha.14**

***

# Blockchain Commons dCBOR CLI (TypeScript)

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/dcbor-cli` is a command line tool for parsing, validating, and converting [dCBOR](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/) (Deterministic CBOR) data.

Features:
- Validates dCBOR inputs
- Receives inputs in hex, binary, or diagnostic notation format
- Outputs in multiple formats: diagnostic notation (compact or annotated), hexadecimal (compact or annotated), or binary
- Compose dCBOR arrays and maps from individual elements

## Rust Reference Implementation

This TypeScript implementation is based on [bc-dcbor-cli](https://github.com/BlockchainCommons/bc-dcbor-cli) **v0.16.0** ([commit](https://github.com/BlockchainCommons/bc-dcbor-cli/tree/1977ba6e2934f58d49b0dbf10d171988d9cb31d3)).

## Installation

```bash
# Install globally
bun add -g @bcts/dcbor-cli

# Or run directly with bunx
bunx @bcts/dcbor-cli --help
```

## Usage

### Basic Conversion

Convert CBOR diagnostic notation to hexadecimal (default):

```bash
dcbor '42'
# Output: 182a

dcbor '3.14'
# Output: fb40091eb851eb851f

dcbor '"Hello"'
# Output: 6548656c6c6f
```

### Input/Output Formats

```bash
# Convert hex to diagnostic notation
dcbor --in hex --out diag 6548656c6c6f
# Output: "Hello"

# Convert with annotations
dcbor --in hex --out diag --annotate 6548656c6c6f
# Output: "Hello"   / text(5) /

# Convert to binary
dcbor --in hex --out bin 6548656c6c6f > output.bin

# Read binary input
dcbor --in bin < input.bin
```

### Compose Arrays and Maps

```bash
# Compose an array
dcbor array 1 2 3
# Output: hex for [1, 2, 3]

# Compose a map
dcbor map '"key1"' 1 '"key2"' 2
# Output: hex for {"key1": 1, "key2": 2}
```

## Command Line Reference

```
Usage: dcbor [options] [input] [command]

Commands:
  array   Compose a dCBOR array from the provided elements
  map     Compose a dCBOR map from the provided keys and values

Arguments:
  input   Input dCBOR (format specified by --in)

Options:
  -i, --in <format>    Input format: diag, hex, bin (default: diag)
  -o, --out <format>   Output format: diag, hex, bin, none (default: hex)
  -a, --annotate       Add annotations to output
  -h, --help           Display help
  -V, --version        Display version
```

## Dependencies

- `@bcts/dcbor` - dCBOR encoding/decoding
- `@bcts/dcbor-parse` - Diagnostic notation parser
- `@bcts/dcbor-pattern` - Pattern matching
- `@bcts/components` - Shared components

## License

BSD-2-Clause-Patent
