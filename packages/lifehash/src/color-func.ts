/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Color, modulo } from "./color";

/**
 * A function that takes a fraction [0..1] and returns a color along a gradient.
 */
export type ColorFunc = (t: number) => Color;

/**
 * Returns the reverse of the given color function.
 */
export function reverse(c: ColorFunc): ColorFunc {
  return (t: number) => c(1 - t);
}

/**
 * Returns a color function that blends from one color to another.
 */
export function blend2(color1: Color, color2: Color): ColorFunc {
  return (t: number) => color1.lerpTo(color2, t);
}

/**
 * Returns a color function that blends through each of the given colors at equal intervals.
 */
export function blend(colors: Color[]): ColorFunc {
  const count = colors.length;
  switch (count) {
    case 0:
      return blend2(Color.black, Color.black);
    case 1:
      return blend2(colors[0], colors[0]);
    case 2:
      return blend2(colors[0], colors[1]);
    default:
      return (t: number) => {
        if (t >= 1) {
          return colors[count - 1];
        } else if (t <= 0) {
          return colors[0];
        }
        const segments = count - 1;
        const s = t * segments;
        const segment = Math.floor(s);
        const segmentFrac = modulo(s, 1);
        const c1 = colors[segment];
        const c2 = colors[segment + 1];
        return c1.lerpTo(c2, segmentFrac);
      };
  }
}
