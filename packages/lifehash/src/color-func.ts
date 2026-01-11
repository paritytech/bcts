import { Color } from "./color";
import { modulo } from "./numeric";

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
export function blend(color1: Color, color2: Color): ColorFunc;
/**
 * Returns a color function that blends through each of the given colors at equal intervals.
 */
// eslint-disable-next-line no-redeclare
export function blend(colors: Color[]): ColorFunc;
// eslint-disable-next-line no-redeclare
export function blend(arg1: Color | Color[], arg2?: Color): ColorFunc {
  if (Array.isArray(arg1)) {
    const colors = arg1;
    const count = colors.length;

    switch (count) {
      case 0:
        return blend(Color.black, Color.black);
      case 1:
        return blend(colors[0], colors[0]);
      case 2:
        return blend(colors[0], colors[1]);
      default:
        return (t: number) => {
          if (t >= 1) {
            return colors[count - 1];
          } else if (t <= 0) {
            return colors[0];
          } else {
            const segments = count - 1;
            const s = t * segments;
            const segment = Math.floor(s);
            const segmentFrac = modulo(s, 1);
            const c1 = colors[segment];
            const c2 = colors[segment + 1];
            return c1.lerpTo(c2, segmentFrac);
          }
        };
    }
  } else {
    const color1 = arg1;
    // arg2 is guaranteed to be defined when arg1 is not an array (from overload signature)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const color2 = arg2!;
    return (t: number) => color1.lerpTo(color2, t);
  }
}
