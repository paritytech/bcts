/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Grid } from "./grid";
import { Color } from "./color";
import { type Size } from "./size";
import type { CellGrid } from "./cell-grid";

/**
 * A grid of floating point values in [0..1], used for onion-skinning
 * the generations of the Game of Life into a single grayscale image.
 */
export class FracGrid extends Grid<number> {
  constructor(size: Size) {
    super(size, 0);
  }

  protected colorForValue(value: number): Color {
    return Color.black.lerpTo(Color.white, value);
  }

  overlay(cellGrid: CellGrid, frac: number): void {
    this.forAll((p) => {
      if (cellGrid.getValue(p)) {
        this.setValue(frac, p);
      }
    });
  }
}
