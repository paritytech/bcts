/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Grid } from "./grid";
import { Color } from "./color";
import { type Point } from "./point";
import { type Size } from "./size";

/**
 * A grid used to optimize the running of Conway's Game of Life by keeping
 * track of cells that need consideration in the next generation, which
 * allows the pruning of cells that don't need consideration.
 */
export class ChangeGrid extends Grid<boolean> {
  constructor(size: Size) {
    super(size, false);
  }

  protected colorForValue(value: boolean): Color {
    return value ? Color.red : Color.blue;
  }

  setChanged(point: Point): void {
    this.forNeighborhood(point, (_o, p) => {
      this.setValue(true, p);
    });
  }
}
