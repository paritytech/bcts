# @bcts/multipart-ur

Multipart UR QR code generator — single-frame and animated fountain-coded QR sequences with optional logo overlay. TypeScript port of [`bc-mur`](https://github.com/BlockchainCommons/bc-mur-rust).

## Install

```sh
bun add @bcts/multipart-ur
```

## Usage

```ts
import { Color, CorrectionLevel, renderQr } from "@bcts/multipart-ur";

const img = renderQr(
  new TextEncoder().encode("UR:BYTES/HDCXDWINVEZM"),
  CorrectionLevel.Low,
  512,
  Color.BLACK,
  Color.WHITE,
  1, // quiet zone modules
  null, // no logo
);
const pngBytes = await img.toPng();
```

## CLI

```sh
mur single ur:bytes/hdcxdwinvezm -o out.png
mur animate ur:bytes/... -o out.gif
mur frames ur:bytes/... -o out_frames/
```

The library is browser-compatible. The CLI requires Node.js, and the `prores` output format additionally requires `ffmpeg` on `PATH`.
