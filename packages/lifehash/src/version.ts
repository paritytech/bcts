/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * The available versions of LifeHash.
 */
export enum Version {
  /** DEPRECATED. Uses HSB gamut. Not CMYK-friendly. Has some minor gradient bugs. */
  version1 = 0,
  /** CMYK-friendly gamut. Recommended for most purposes. */
  version2 = 1,
  /** Double resolution. CMYK-friendly gamut. */
  detailed = 2,
  /** Optimized for generating machine-vision fiducials. High-contrast. CMYK-friendly gamut. */
  fiducial = 3,
  /** Optimized for generating machine-vision fiducials. High-contrast. Grayscale. */
  grayscale_fiducial = 4,
}
