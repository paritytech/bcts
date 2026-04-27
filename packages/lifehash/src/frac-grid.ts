/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Grid } from "./grid";
import type { CellGrid } from "./cell-grid";

/**
 * A grid of floating point values in [0..1], used for onion-skinning
 * the generations of the Game of Life into a single grayscale image.
 */
export class FracGrid {
  public readonly grid: Grid<number>;

  constructor(width: number, height: number) {
    this.grid = new Grid<number>(width, height, 0);
  }

  overlay(cellGrid: CellGrid, frac: number): void {
    const width = this.grid.width;
    const height = this.grid.height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cellGrid.grid.getValue(x, y)) {
          this.grid.setValue(frac, x, y);
        }
      }
    }
  }
}
