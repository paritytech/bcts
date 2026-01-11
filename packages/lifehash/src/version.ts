/**
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
