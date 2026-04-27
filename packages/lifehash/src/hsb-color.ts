/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Color, clamped, modulo } from "./color";

/**
 * A struct representing a color in the HSB space.
 * Only used by version1 LifeHashes.
 */
export class HSBColor {
  constructor(
    public hue: number,
    public saturation = 1,
    public brightness = 1,
  ) {}

  /**
   * Create an HSBColor from a hue alone, with saturation and brightness both set to 1.
   */
  static fromHue(hue: number): HSBColor {
    return new HSBColor(hue, 1, 1);
  }

  /**
   * Convert to RGB Color.
   */
  color(): Color {
    const v = clamped(this.brightness);
    const s = clamped(this.saturation);

    if (s <= 0) {
      return new Color(v, v, v);
    }

    let h = modulo(this.hue, 1);
    if (h < 0) {
      h += 1;
    }
    h *= 6;

    // C++/Rust use floorf on an f32, which can pick a different sextant than
    // a plain f64 floor when h is just below an integer boundary.
    const i = Math.floor(Math.fround(h));
    const f = h - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));

    switch (i) {
      case 0:
        return new Color(v, t, p);
      case 1:
        return new Color(q, v, p);
      case 2:
        return new Color(p, v, t);
      case 3:
        return new Color(p, q, v);
      case 4:
        return new Color(t, p, v);
      case 5:
        return new Color(v, p, q);
      default:
        throw new Error("Internal error in HSB conversion");
    }
  }
}
