/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::qr_matrix`.
 */

import qrcode from "qrcode-generator";

import { type CorrectionLevel, correctionLevelToLetter } from "./correction.js";
import { MurError } from "./error.js";

/**
 * Default maximum QR module count for reliable phone scanning.
 * Corresponds to QR version 25 (117×117 modules).
 */
export const DEFAULT_MAX_MODULES = 117;

/** Get the QR module count for a message without rendering. */
export function qrModuleCount(message: Uint8Array, correction: CorrectionLevel): number {
  const matrix = QrMatrix.encode(message, correction);
  return matrix.width();
}

/**
 * Check that a module count is within a density limit.
 *
 * Throws `MurError.qrCodeTooDense` if `moduleCount > maxModules`.
 */
export function checkQrDensity(moduleCount: number, maxModules: number): void {
  if (moduleCount > maxModules) {
    throw MurError.qrCodeTooDense(moduleCount, maxModules);
  }
}

/**
 * QR Alphanumeric mode character set (0-9, A-Z uppercase, plus
 * space, `$`, `%`, `*`, `+`, `-`, `.`, `/`, `:`).
 *
 * Mirrors the Rust `qrcode` crate's mode-selection table — see
 * `qrcode-0.12.0/src/types.rs::Mode::from_byte`.
 */
const QR_ALPHANUMERIC_SET = new Set<number>([
  ...Array.from({ length: 10 }, (_, i) => 0x30 + i), // 0-9
  ...Array.from({ length: 26 }, (_, i) => 0x41 + i), // A-Z
  0x20, // space
  0x24, // $
  0x25, // %
  0x2a, // *
  0x2b, // +
  0x2d, // -
  0x2e, // .
  0x2f, // /
  0x3a, // :
]);

/**
 * Pick the most compact QR mode for a byte payload, mirroring Rust
 * `qrcode::Builder` which tries Numeric → Alphanumeric → Byte (→
 * Kanji, omitted here) and picks the first that fits.
 *
 * `qrcode-generator` does NOT auto-select — it defaults to Byte
 * regardless of input. Forcing Byte for uppercase UR strings
 * inflates Version 1 Low (max 17 bytes) into Version 2 (25×25)
 * where Alphanumeric (max 25 chars) would have fit at 21×21. This
 * is the M1 fix from `PARITY_OUTSTANDING.md`.
 */
function selectQrMode(message: Uint8Array): "Numeric" | "Alphanumeric" | "Byte" {
  if (message.length === 0) return "Byte";
  let allNumeric = true;
  let allAlphanumeric = true;
  for (const b of message) {
    if (b < 0x30 || b > 0x39) allNumeric = false;
    if (!QR_ALPHANUMERIC_SET.has(b)) allAlphanumeric = false;
    if (!allNumeric && !allAlphanumeric) return "Byte";
  }
  if (allNumeric) return "Numeric";
  if (allAlphanumeric) return "Alphanumeric";
  return "Byte";
}

/** A boolean QR module matrix. */
export class QrMatrix {
  private readonly _modules: boolean[];
  private readonly _width: number;

  private constructor(modules: boolean[], width: number) {
    this._modules = modules;
    this._width = width;
  }

  /** Encode a byte message into a QR matrix at the given correction level. */
  static encode(message: Uint8Array, correction: CorrectionLevel): QrMatrix {
    let qr;
    try {
      qr = qrcode(0, correctionLevelToLetter(correction));
      const mode = selectQrMode(message);
      // Feed bytes as a binary string so the chosen mode encodes them
      // unchanged. For Alphanumeric / Numeric inputs every byte is
      // already in the ASCII range, so `String.fromCharCode` is a
      // 1:1 mapping; for Byte mode it is the standard Latin-1
      // round-trip qrcode-generator expects.
      let binary = "";
      for (let i = 0; i < message.length; i++) {
        binary += String.fromCharCode(message[i]);
      }
      qr.addData(binary, mode);
      qr.make();
    } catch (e) {
      throw MurError.qrEncode(e instanceof Error ? e.message : String(e));
    }

    const width = qr.getModuleCount();
    const modules: boolean[] = new Array(width * width);
    for (let row = 0; row < width; row++) {
      for (let col = 0; col < width; col++) {
        modules[row * width + col] = qr.isDark(row, col);
      }
    }
    return new QrMatrix(modules, width);
  }

  /** Module count (width == height for QR codes). */
  width(): number {
    return this._width;
  }

  /** True if the module at (col, row) is dark. */
  isDark(col: number, row: number): boolean {
    return this._modules[row * this._width + col];
  }
}
