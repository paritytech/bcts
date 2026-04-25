/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * `@bcts/multipart-ur` — Multipart UR QR code generator.
 *
 * Port of [`bc-mur`](https://github.com/BlockchainCommons/bc-mur-rust). The
 * library half is browser-compatible; the `mur` CLI and `encodeProres`
 * helper require Node.
 */

export {
  type AnimateParams,
  QrFrame,
  encodeAnimatedGif,
  generateFrames,
  writeFramePngs,
} from "./animate.js";
export { Color } from "./color.js";
export {
  CorrectionLevel,
  correctionLevelFromString,
  correctionLevelToLetter,
  correctionLevelToString,
} from "./correction.js";
export {
  MurError,
  Error,
  type ErrorVariant,
  type Result,
} from "./error.js";
export {
  Logo,
  LogoClearShape,
  logoClearShapeFromString,
  logoClearShapeToString,
} from "./logo.js";
export { encodeProres } from "./prores.js";
export {
  DEFAULT_MAX_MODULES,
  QrMatrix,
  checkQrDensity,
  qrModuleCount,
} from "./qr-matrix.js";
export {
  RenderedImage,
  bilinearScale,
  nearestNeighborScale,
  renderFromMatrix,
  renderQr,
  renderUrQr,
} from "./render.js";
export { initSvgRenderer } from "./svg.js";
