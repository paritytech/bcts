/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::correction`.
 */

/** QR error correction level. */
export enum CorrectionLevel {
  Low = "Low",
  Medium = "Medium",
  Quartile = "Quartile",
  High = "High",
}

export type EcLetter = "L" | "M" | "Q" | "H";

/** Convert to underlying `qrcode-generator` letter. */
export function correctionLevelToLetter(level: CorrectionLevel): EcLetter {
  switch (level) {
    case CorrectionLevel.Low:
      return "L";
    case CorrectionLevel.Medium:
      return "M";
    case CorrectionLevel.Quartile:
      return "Q";
    case CorrectionLevel.High:
      return "H";
  }
}

export function correctionLevelToString(level: CorrectionLevel): string {
  switch (level) {
    case CorrectionLevel.Low:
      return "low";
    case CorrectionLevel.Medium:
      return "medium";
    case CorrectionLevel.Quartile:
      return "quartile";
    case CorrectionLevel.High:
      return "high";
  }
}

export function correctionLevelFromString(s: string): CorrectionLevel {
  switch (s.toLowerCase()) {
    case "low":
    case "l":
      return CorrectionLevel.Low;
    case "medium":
    case "m":
      return CorrectionLevel.Medium;
    case "quartile":
    case "q":
      return CorrectionLevel.Quartile;
    case "high":
    case "h":
      return CorrectionLevel.High;
    default:
      throw new Error(`unknown correction level: ${s} (expected low, medium, quartile, or high)`);
  }
}
