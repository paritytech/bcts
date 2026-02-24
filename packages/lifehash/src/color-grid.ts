/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Grid } from "./grid";
import { Color } from "./color";
import { Point } from "./point";
import { Size } from "./size";
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
export class ColorGrid extends Grid<Color> {
  constructor(fracGrid: FracGrid, gradient: ColorFunc, pattern: Pattern) {
    super(ColorGrid.targetSize(fracGrid.size, pattern), new Color());

    const transforms = ColorGrid.getTransforms(pattern);

    fracGrid.forAll((p) => {
      const color = gradient(fracGrid.getValue(p));
      this.draw(p, color, transforms);
    });
  }

  protected colorForValue(color: Color): Color {
    return color;
  }

  private static targetSize(inSize: Size, pattern: Pattern): Size {
    const multiplier = pattern === Pattern.fiducial ? 1 : 2;
    return new Size(inSize.width * multiplier, inSize.height * multiplier);
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

  private transformPoint(point: Point, transform: Transform): Point {
    let x = point.x;
    let y = point.y;

    if (transform.transpose) {
      [x, y] = [y, x];
    }
    if (transform.reflectX) {
      x = this.maxX - x;
    }
    if (transform.reflectY) {
      y = this.maxY - y;
    }

    return new Point(x, y);
  }

  private draw(p: Point, color: Color, transforms: Transform[]): void {
    for (const t of transforms) {
      const p2 = this.transformPoint(p, t);
      this.setValue(color, p2);
    }
  }
}
