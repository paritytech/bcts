# Blockchain Commons Provenance Mark CLI (TypeScript)

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/provenance-mark-cli` is a command line tool for creating and managing [Provenance Mark](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2025-001-provenance-mark.md) chains.

Provenance Marks are cryptographically-secured markers that establish authenticity and provenance of digital works. They form chains where each mark references the previous one, creating an unforgeable timeline.

Features:
- Create new provenance mark chains with a genesis mark
- Add new marks to existing chains
- Print marks in publishable formats (Markdown, UR, JSON)
- Validate provenance mark chains for integrity
- Support for multiple resolution levels (low, medium, quartile, high)

## Rust Reference Implementation

This TypeScript implementation is based on [provenance-mark-cli-rust](https://github.com/BlockchainCommons/provenance-mark-cli-rust) **v0.6.0** ([commit](https://github.com/BlockchainCommons/provenance-mark-cli-rust/tree/2efd567c78ca0d457f2bc10263917d4829e422f9)).

## Installation

```bash
# Install globally
bun add -g @bcts/provenance-mark-cli

# Or run directly with bunx
bunx @bcts/provenance-mark-cli --help
```

## Usage

### Creating a New Chain

```bash
# Create a new provenance mark chain
provenance new mychain

# Create with a specific resolution
provenance new mychain --resolution high

# Create with a custom comment
provenance new mychain --comment "Genesis mark for my project"

# Create with a specific seed (base64)
provenance new mychain --seed "base64encodedSeed=="
```

Output:
```
Provenance mark chain created at: /path/to/mychain

Mark 0 written to: /path/to/mychain/marks/mark-0.json

---

2025-01-27T21:59:52Z

#### ur:provenance/lfaohdft...

#### `🅟 PLAY WASP FLUX SWAN`

🅟 💎 🦄 🍓 🧢

Genesis mark.
```

### Adding New Marks

```bash
# Add next mark to the chain
provenance next mychain --comment "New release v1.0"

# Output as UR only
provenance next mychain --format ur --quiet

# Output as JSON
provenance next mychain --format json
```

### Printing Marks

```bash
# Print all marks in the chain
provenance print mychain

# Print specific range
provenance print mychain --start 0 --end 5

# Print only the genesis mark
provenance print mychain --start 0 --end 0
```

### Validating Marks

```bash
# Validate a chain directory
provenance validate --dir mychain

# Validate specific URs
provenance validate ur:provenance/... ur:provenance/...

# Validate with warnings instead of errors
provenance validate --warn --dir mychain
```

## Directory Structure

When you create a new chain, the following structure is created:

```
mychain/
├── generator.json    # Chain state (KEEP SECRET!)
└── marks/
    ├── mark-0.json   # Genesis mark
    ├── mark-1.json   # Second mark
    └── ...
```

**Important:** The `generator.json` file contains the seed and must be kept secret. If compromised, an attacker could forge marks in your chain.

## Command Line Reference

```
Usage: provenance [options] [command]

Commands:
  new <dir>        Create a new provenance mark chain
  next <dir>       Generate the next mark in a chain
  print <dir>      Print marks from a chain
  validate         Validate provenance marks

new Options:
  --seed <base64>       Seed for the chain (default: random)
  --resolution <level>  Resolution: low, medium, quartile, high (default: quartile)
  --comment <text>      Comment for genesis mark

next Options:
  --comment <text>      Comment for the new mark
  --format <fmt>        Output format: markdown, ur, json (default: markdown)
  --quiet               Suppress status messages

print Options:
  --start <n>           First mark to print (default: 0)
  --end <n>             Last mark to print (default: last)

validate Options:
  --dir <path>          Validate all marks in directory
  --warn                Warn instead of error on issues

Global Options:
  -h, --help            Display help
  -V, --version         Display version
```

## Mark Formats

Each mark includes:
- **UR**: Complete data structure in Uniform Resource format
- **Bytewords**: Human-readable identifier (e.g., `🅟 PLAY WASP FLUX SWAN`)
- **Bytemoji**: Emoji identifier (e.g., `🅟 💎 🦄 🍓 🧢`)
- **Comment**: Optional descriptive text
