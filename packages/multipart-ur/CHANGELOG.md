# @bcts/multipart-ur

## 1.0.0-alpha.0

### Initial release

- TypeScript port of [`bc-mur`](https://github.com/BlockchainCommons/bc-mur-rust) v0.1.0.
- Single-frame QR code rendering from raw bytes or UR strings.
- Logo overlay with module-aligned compositing (square or circle clear shape).
- Animated multipart fountain-coded QR sequences (GIF output).
- ProRes 4444 encoding via optional ffmpeg integration (CLI / Node only).
- Frame dump as numbered PNGs for custom pipelines.
- Configurable QR error correction level, colors, quiet zone, and module size.
- Density safety checks to prevent unreadable QR codes.
- CLI tool `mur` with `single`, `animate`, and `frames` subcommands.
