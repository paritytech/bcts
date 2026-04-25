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
      // Feed bytes as a binary string so they go through Byte mode unchanged.
      let binary = "";
      for (let i = 0; i < message.length; i++) {
        binary += String.fromCharCode(message[i]);
      }
      qr.addData(binary, "Byte");
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
