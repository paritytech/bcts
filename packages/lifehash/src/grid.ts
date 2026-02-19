/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { type Color } from "./color";
import { Point } from "./point";
import { type Size } from "./size";

/**
 * A class that holds a 2-dimensional grid of values,
 * and allows the reading, writing, and iteration through those values.
 */
export abstract class Grid<T> {
  protected readonly capacity: number;
  protected readonly maxX: number;
  protected readonly maxY: number;
  protected readonly storage: T[];

  constructor(
    public readonly size: Size,
    defaultValue: T,
  ) {
    this.capacity = size.width * size.height;
    this.maxX = size.width - 1;
    this.maxY = size.height - 1;
    this.storage = new Array<T>(this.capacity).fill(defaultValue);
  }

  protected abstract colorForValue(value: T): Color;

  private offset(p: Point): number {
    return p.y * this.size.width + p.x;
  }

  private static circularIndex(index: number, modulus: number): number {
    return (index + modulus) % modulus;
  }

  setAll(value: T): void {
    this.storage.fill(value);
  }

  setValue(value: T, p: Point): void {
    this.storage[this.offset(p)] = value;
  }

  getValue(p: Point): T {
    return this.storage[this.offset(p)];
  }

  forAll(f: (p: Point) => void): void {
    for (let y = 0; y <= this.maxY; y++) {
      for (let x = 0; x <= this.maxX; x++) {
        f(new Point(x, y));
      }
    }
  }

  forNeighborhood(point: Point, f: (offset: Point, p: Point) => void): void {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const o = new Point(ox, oy);
        const px = Grid.circularIndex(ox + point.x, this.size.width);
        const py = Grid.circularIndex(oy + point.y, this.size.height);
        const p = new Point(px, py);
        f(o, p);
      }
    }
  }

  colors(): number[] {
    const result: number[] = [];
    for (const value of this.storage) {
      const c = this.colorForValue(value);
      result.push(c.r, c.g, c.b);
    }
    return result;
  }
}
