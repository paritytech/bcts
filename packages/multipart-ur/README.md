# Blockchain Commons Multipart UR for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

`@bcts/multipart-ur` is a multipart [Uniform Resource (UR)](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md) QR code generator. It produces single-frame and animated fountain-coded QR sequences — suitable for transmitting arbitrarily large UR-encoded payloads through an airgap — with an optional logo overlay.

This package provides:

- Single-frame QR code rendering from raw bytes or UR strings
- Logo overlay with module-aligned compositing (square or circle clear shape)
- Animated multipart fountain-coded QR sequences (GIF output)
- ProRes 4444 encoding via optional ffmpeg integration (Node only)
- Frame dump as numbered PNGs for custom pipelines
- Configurable QR error correction level, colors, quiet zone, and module size
- Density safety checks to prevent unreadable QR codes
- CLI tool `mur` with `single`, `animate`, and `frames` subcommands

The library is browser-compatible. The `mur` CLI and the `encodeProres` helper require Node.js; ProRes output additionally requires `ffmpeg` on `PATH`.

## Specification

Built on top of the [Uniform Resources (UR)](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md) specification — specifically its multipart fountain-coded form for QR animations.

## Rust Reference Implementation

This TypeScript implementation is based on [bc-mur-rust](https://github.com/BlockchainCommons/bc-mur-rust) **v0.1.0** ([commit](https://github.com/BlockchainCommons/bc-mur-rust/tree/15c7c701d0b7bce8215d092014510595d577f827)).

## Install

```sh
bun add @bcts/multipart-ur
```

## Usage

```ts
import { Color, CorrectionLevel, renderUrQr } from "@bcts/multipart-ur";

const img = renderUrQr(
  "ur:bytes/hdcxdwinvezm",
  CorrectionLevel.Low,
  512, // target pixel size (square)
  Color.BLACK,
  Color.WHITE,
  1, // quiet zone modules
  null, // no logo
);
const pngBytes = img.toPng();
```

## CLI

```sh
mur single ur:bytes/hdcxdwinvezm -o out.png
mur animate ur:bytes/... -o out.gif
mur frames ur:bytes/... -o out_frames/
```
