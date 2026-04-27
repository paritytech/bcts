/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

/**
 * A class that holds a 2-dimensional grid of values,
 * and allows the reading, writing, and iteration through those values.
 */
export class Grid<T> {
  public readonly storage: T[];

  constructor(
    public readonly width: number,
    public readonly height: number,
    defaultValue: T,
  ) {
    this.storage = new Array<T>(width * height).fill(defaultValue);
  }

  private offset(x: number, y: number): number {
    return y * this.width + x;
  }

  private static circularIndex(index: number, modulus: number): number {
    return ((index % modulus) + modulus) % modulus;
  }

  setAll(value: T): void {
    this.storage.fill(value);
  }

  setValue(value: T, x: number, y: number): void {
    this.storage[this.offset(x, y)] = value;
  }

  getValue(x: number, y: number): T {
    return this.storage[this.offset(x, y)];
  }

  forAll(f: (x: number, y: number) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        f(x, y);
      }
    }
  }

  forNeighborhood(
    px: number,
    py: number,
    f: (ox: number, oy: number, nx: number, ny: number) => void,
  ): void {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const nx = Grid.circularIndex(ox + px, this.width);
        const ny = Grid.circularIndex(oy + py, this.height);
        f(ox, oy, nx, ny);
      }
    }
  }
}
