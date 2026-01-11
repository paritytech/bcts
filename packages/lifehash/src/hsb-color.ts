import { Color } from "./color";
import { clamped, max, min, modulo, floorf } from "./numeric";

/**
 * A struct representing a color in the HSB space.
 * Only used by version1 LifeHashes.
 */
export class HSBColor {
  constructor(
    public hue: number,
    public saturation: number = 1,
    public brightness: number = 1,
  ) {}

  /**
   * Create HSBColor from RGB Color.
   */
  static fromColor(color: Color): HSBColor {
    const r = color.r;
    const g = color.g;
    const b = color.b;

    const maxValue = max(r, g, b);
    const minValue = min(r, g, b);

    const brightness = maxValue;
    const d = maxValue - minValue;
    const saturation = maxValue === 0 ? 0 : d / maxValue;

    let hue: number;
    if (maxValue === minValue) {
      hue = 0; // achromatic
    } else if (maxValue === r) {
      hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (maxValue === g) {
      hue = ((b - r) / d + 2) / 6;
    } else if (maxValue === b) {
      hue = ((r - g) / d + 4) / 6;
    } else {
      throw new Error("Internal error.");
    }

    return new HSBColor(hue, saturation, brightness);
  }

  /**
   * Convert to RGB Color.
   */
  toColor(): Color {
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

    const i = floorf(h);
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
        throw new Error("Internal error.");
    }
  }
}
