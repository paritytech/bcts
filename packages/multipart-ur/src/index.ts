/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * `@bcts/multipart-ur` — Multipart UR QR code generator.
 *
 * Port of [`bc-mur`](https://github.com/BlockchainCommons/bc-mur-rust). The
 * public surface mirrors rust `lib.rs` exactly. The library half is
 * browser-compatible; the `mur` CLI and `encodeProres` helper require
 * Node.
 */

// Mirrors rust: `pub use animate::{AnimateParams, QrFrame, encode_animated_gif, generate_frames, write_frame_pngs};`
export {
  type AnimateParams,
  QrFrame,
  encodeAnimatedGif,
  generateFrames,
  writeFramePngs,
} from "./animate.js";

// Mirrors rust: `pub use color::Color;`
export { Color } from "./color.js";

// Mirrors rust: `pub use correction::CorrectionLevel;`
// TS-only additions: fromString/toString free functions (rust uses FromStr/Display traits).
export {
  CorrectionLevel,
  correctionLevelFromString,
  correctionLevelToString,
} from "./correction.js";

// Mirrors rust: `pub use error::{Error, Result};`
// TS-only additions: MurError (class flavour of rust's enum) + ErrorVariant (discriminant for .isKind narrowing).
export { MurError, Error, type ErrorVariant, type Result } from "./error.js";

// Mirrors rust: `pub use logo::{Logo, LogoClearShape};`
// TS-only additions: fromString/toString free functions.
export { Logo, LogoClearShape, logoClearShapeFromString, logoClearShapeToString } from "./logo.js";

// Mirrors rust: `pub use prores::encode_prores;`
export { encodeProres } from "./prores.js";

// Mirrors rust: `pub use qr_matrix::{DEFAULT_MAX_MODULES, check_qr_density, qr_module_count};`
// (QrMatrix itself is crate-private in rust — not re-exported.)
export { DEFAULT_MAX_MODULES, checkQrDensity, qrModuleCount } from "./qr-matrix.js";

// Mirrors rust: `pub use render::{RenderedImage, render_qr, render_ur_qr};`
// (render_from_matrix is pub(crate), nearest_neighbor_scale/bilinear_scale are private — not re-exported.)
export { RenderedImage, renderQr, renderUrQr } from "./render.js";

// TS-only: required for browser callers to bootstrap the SVG rasterizer WASM module.
// In Node this is called automatically the first time `Logo.fromSvg` runs.
export { initSvgRenderer } from "./svg.js";
