import { Grid } from "./grid";
import { Color } from "./color";
import { Point } from "./point";
import { Size } from "./size";

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
