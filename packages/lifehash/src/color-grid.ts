/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Grid } from "./grid";
import { Color } from "./color";
import type { FracGrid } from "./frac-grid";
import type { ColorFunc } from "./color-func";
import { Pattern } from "./patterns";

interface Transform {
  transpose: boolean;
  reflectX: boolean;
  reflectY: boolean;
}

const snowflakeTransforms: Transform[] = [
  { transpose: false, reflectX: false, reflectY: false },
  { transpose: false, reflectX: true, reflectY: false },
  { transpose: false, reflectX: false, reflectY: true },
  { transpose: false, reflectX: true, reflectY: true },
];

const pinwheelTransforms: Transform[] = [
  { transpose: false, reflectX: false, reflectY: false },
  { transpose: true, reflectX: true, reflectY: false },
  { transpose: true, reflectX: false, reflectY: true },
  { transpose: false, reflectX: true, reflectY: true },
];

const fiducialTransforms: Transform[] = [{ transpose: false, reflectX: false, reflectY: false }];

/**
 * A class that takes a grayscale grid and applies color and
 * symmetry to it to yield the finished LifeHash.
 */
export class ColorGrid {
  public readonly grid: Grid<Color>;

  constructor(fracGrid: FracGrid, gradient: ColorFunc, pattern: Pattern) {
    const multiplier = pattern === Pattern.fiducial ? 1 : 2;
    const targetWidth = fracGrid.grid.width * multiplier;
    const targetHeight = fracGrid.grid.height * multiplier;

    this.grid = new Grid<Color>(targetWidth, targetHeight, new Color());

    const maxX = targetWidth - 1;
    const maxY = targetHeight - 1;

    const transforms: Transform[] = ColorGrid.getTransforms(pattern);

    const fracWidth = fracGrid.grid.width;
    const fracHeight = fracGrid.grid.height;
    for (let y = 0; y < fracHeight; y++) {
      for (let x = 0; x < fracWidth; x++) {
        const value = fracGrid.grid.getValue(x, y);
        const color = gradient(value);
        for (const t of transforms) {
          let px = x;
          let py = y;
          if (t.transpose) {
            [px, py] = [py, px];
          }
          if (t.reflectX) {
            px = maxX - px;
          }
          if (t.reflectY) {
            py = maxY - py;
          }
          this.grid.setValue(color, px, py);
        }
      }
    }
  }

  private static getTransforms(pattern: Pattern): Transform[] {
    switch (pattern) {
      case Pattern.snowflake:
        return snowflakeTransforms;
      case Pattern.pinwheel:
        return pinwheelTransforms;
      case Pattern.fiducial:
        return fiducialTransforms;
    }
  }

  colors(): number[] {
    const result: number[] = [];
    for (const c of this.grid.storage) {
      result.push(c.r, c.g, c.b);
    }
    return result;
  }
}
