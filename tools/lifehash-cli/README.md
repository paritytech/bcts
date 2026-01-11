# Blockchain Commons LifeHash CLI (TypeScript)

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/lifehash-cli` is a command line tool for generating [LifeHash](https://github.com/BlockchainCommons/bc-lifehash) images as PNG files. LifeHash is a beautiful method of hash visualization based on Conway's Game of Life.

Features:
- Generate LifeHash PNG images from any input string
- Support for all 5 LifeHash versions (version1, version2, detailed, fiducial, grayscaleFiducial)
- Configurable module (pixel) size for image scaling
- Automatic random input generation if none provided
- Cross-platform (Node.js/Bun)

## Installation

```bash
# Install globally
bun add -g @bcts/lifehash-cli

# Or run directly with bunx
bunx @bcts/lifehash-cli --help
```

## Usage

### Generate a LifeHash

```bash
# Generate a version2 (default), 32x32 pixel LifeHash from the string "Hello"
lifehash Hello

# Output: Hello.png
```

### Specify Version

```bash
# Generate a version1 LifeHash (deprecated HSB colors)
lifehash -v version1 Hello

# Generate a detailed (64x64) LifeHash
lifehash -v detailed Hello

# Generate a fiducial LifeHash (for machine vision)
lifehash -v fiducial Hello

# Generate a grayscale fiducial LifeHash
lifehash -v grayscaleFiducial Hello
```

### Module Size (Scaling)

```bash
# Generate a 256x256 image (32x32 with module size 8)
lifehash -m 8 Hello

# Generate a 512x512 detailed image (64x64 with module size 8)
lifehash -v detailed -m 8 Hello
```

### Output Path

```bash
# Save to a specific directory
lifehash -p ./output Hello

# Output: ./output/Hello.png
```

### Random Input

```bash
# Generate with a random input of the form "XXX-XXX"
lifehash

# Output: ABC-DEF.png (random letters)
```

## Command Line Reference

```
Usage: lifehash [options] [input]

Arguments:
  input                    Input string to hash (default: random XXX-XXX)

Options:
  -v, --version <version>  LifeHash version: version1, version2, detailed, fiducial, grayscaleFiducial (default: "version2")
  -m, --module <size>      Size of each module ("pixel") (default: 1)
  -p, --path <path>        Output directory path (default: current directory)
  -h, --help               Display help
  -V, --version            Display version number
```

## LifeHash Versions

| Version | Size | Description |
|---------|------|-------------|
| `version1` | 32x32 | Original version using HSB color space (deprecated) |
| `version2` | 32x32 | Default version using CMYK-safe colors |
| `detailed` | 64x64 | Higher resolution version |
| `fiducial` | 64x64 | Optimized for machine vision applications |
| `grayscaleFiducial` | 64x64 | Grayscale version for machine vision |

## C++ Reference Implementation

This TypeScript implementation is based on [bc-lifehash-cli](https://github.com/BlockchainCommons/bc-lifehash-cli).
