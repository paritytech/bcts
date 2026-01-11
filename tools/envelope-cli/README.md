# Blockchain Commons Envelope CLI (TypeScript)

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/envelope-cli` is a command line tool for manipulating [Gordian Envelope](https://developer.blockchaincommons.com/envelope/) data structures. Gordian Envelope is a smart document format that supports encryption, elision, and cryptographic assertions.

Features:
- Create and manipulate Gordian Envelopes
- Add assertions (subject-predicate-object triples)
- Encrypt and decrypt envelope contents
- Sign and verify envelopes
- Elide (redact) portions of envelopes while maintaining verifiability
- Work with XID (Extensible Identifier) documents
- Pattern matching for querying envelope structures

## Rust Reference Implementation

This TypeScript implementation is based on [bc-envelope-cli-rust](https://github.com/BlockchainCommons/bc-envelope-cli-rust) **v0.31.0** ([commit](https://github.com/BlockchainCommons/bc-envelope-cli-rust/tree/93acb14cf1b76d0c8476f53861726879c3aa7ead)).

## Installation

```bash
# Install globally
bun add -g @bcts/envelope-cli

# Or run directly with bunx
bunx @bcts/envelope-cli --help
```

## Usage

### Creating Envelopes

```bash
# Create a simple envelope with a string subject
envelope subject string "Hello, World!"

# Create an envelope with assertions
envelope subject string "Alice" | envelope assertion add pred string "knows" obj string "Bob"

# Wrap an envelope
envelope subject string "Secret" | envelope wrap
```

### Working with Assertions

```bash
# Add a predicate-object assertion
envelope assertion add pred string "name" obj string "Alice"

# Find assertions matching a pattern
envelope assertion find pred string "name"

# Remove an assertion
envelope assertion remove pred string "name"
```

### Encryption and Signing

```bash
# Generate a private key
envelope generate prvkeys

# Sign an envelope
envelope sign --prvkeys $PRIVATE_KEY

# Verify a signature
envelope verify --pubkeys $PUBLIC_KEY

# Encrypt an envelope
envelope encrypt --key $SYMMETRIC_KEY

# Decrypt an envelope
envelope decrypt --key $SYMMETRIC_KEY
```

### XID Documents

```bash
# Create a new XID document
envelope xid new $PRVKEYS

# Add a service to XID
envelope xid service add --name "website" --uri "https://example.com"

# Work with provenance marks
envelope xid provenance get
envelope xid provenance next
```

### Elision

```bash
# Elide a portion of an envelope
envelope elide removing $DIGEST

# Reveal elided content
envelope elide revealing $DIGEST
```

## Command Line Reference

```
Usage: envelope [options] [command]

Commands:
  subject      Create or extract envelope subject
  assertion    Work with assertions
  wrap         Wrap an envelope
  unwrap       Unwrap an envelope
  sign         Sign an envelope
  verify       Verify envelope signatures
  encrypt      Encrypt envelope content
  decrypt      Decrypt envelope content
  elide        Elide envelope content
  compress     Compress an envelope
  decompress   Decompress an envelope
  extract      Extract data from envelope
  format       Format envelope for display
  generate     Generate keys and other values
  xid          Work with XID documents
  sskr         Split/join using SSKR
  walk         Navigate envelope structure

Options:
  -h, --help      Display help
  -V, --version   Display version
```
