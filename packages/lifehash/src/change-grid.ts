/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Grid } from "./grid";

/**
 * A grid used to optimize the running of Conway's Game of Life by keeping
 * track of cells that need consideration in the next generation, which
 * allows the pruning of cells that don't need consideration.
 */
export class ChangeGrid {
  public readonly grid: Grid<boolean>;

  constructor(width: number, height: number) {
    this.grid = new Grid<boolean>(width, height, false);
  }

  setChanged(px: number, py: number): void {
    const width = this.grid.width;
    const height = this.grid.height;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const nx = (((ox + px) % width) + width) % width;
        const ny = (((oy + py) % height) + height) % height;
        this.grid.setValue(true, nx, ny);
      }
    }
  }
}
