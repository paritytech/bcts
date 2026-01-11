import { clamped, max, min, sqrtf, powf } from "./numeric";

/**
 * A struct representing a color.
 */
export class Color {
  constructor(
    public r: number = 0,
    public g: number = 0,
    public b: number = 0,
  ) {}

  static white = new Color(1, 1, 1);
  static black = new Color(0, 0, 0);
  static red = new Color(1, 0, 0);
  static green = new Color(0, 1, 0);
  static blue = new Color(0, 0, 1);
  static cyan = new Color(0, 1, 1);
  static magenta = new Color(1, 0, 1);
  static yellow = new Color(1, 1, 0);

  /**
   * Create a Color from uint8 values [0..255].
   */
  static fromUint8Values(r: number, g: number, b: number): Color {
    return new Color(r / 255, g / 255, b / 255);
  }

  /**
   * Linearly interpolate from this color to another.
   */
  lerpTo(other: Color, t: number): Color {
    const f = clamped(t);
    const red = clamped(this.r * (1 - f) + other.r * f);
    const green = clamped(this.g * (1 - f) + other.g * f);
    const blue = clamped(this.b * (1 - f) + other.b * f);
    return new Color(red, green, blue);
  }

  /**
   * Lighten this color by interpolating towards white.
   */
  lighten(t: number): Color {
    return this.lerpTo(Color.white, t);
  }

  /**
   * Darken this color by interpolating towards black.
   */
  darken(t: number): Color {
    return this.lerpTo(Color.black, t);
  }

  /**
   * Apply a burn effect to this color.
   */
  burn(t: number): Color {
    const f = max(1.0 - t, 1.0e-7);
    return new Color(
      min(1.0 - (1.0 - this.r) / f, 1.0),
      min(1.0 - (1.0 - this.g) / f, 1.0),
      min(1.0 - (1.0 - this.b) / f, 1.0),
    );
  }

  /**
   * Calculate the luminance of this color.
   * Uses sqrtf/powf for C++ parity.
   */
  luminance(): number {
    return sqrtf(
      powf(0.299 * this.r, 2) +
        powf(0.587 * this.g, 2) +
        powf(0.114 * this.b, 2),
    );
  }
}
