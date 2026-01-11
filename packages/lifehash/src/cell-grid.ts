import { Grid } from "./grid";
import { Color } from "./color";
import { Point } from "./point";
import { type Size } from "./size";
import type { Data } from "./data";
import { BitEnumerator } from "./bit-enumerator";
import { BitAggregator } from "./bit-aggregator";
import type { ChangeGrid } from "./change-grid";

/**
 * A class that holds an array of boolean cells and that is
 * capable of running Conway's Game of Life to produce the next generation.
 */
export class CellGrid extends Grid<boolean> {
  constructor(size: Size) {
    super(size, false);
  }

  protected colorForValue(value: boolean): Color {
    return value ? Color.white : Color.black;
  }

  private static isAliveInNextGeneration(
    currentAlive: boolean,
    neighborsCount: number,
  ): boolean {
    if (currentAlive) {
      return neighborsCount === 2 || neighborsCount === 3;
    } else {
      return neighborsCount === 3;
    }
  }

  private countNeighbors(point: Point): number {
    let total = 0;
    this.forNeighborhood(point, (o, p) => {
      if (o.equals(Point.zero)) {
        return;
      }
      if (this.getValue(p)) {
        total++;
      }
    });
    return total;
  }

  data(): Data {
    const a = new BitAggregator();
    this.forAll((p) => {
      a.append(this.getValue(p));
    });
    return a.data();
  }

  setData(data: Data): void {
    if (this.capacity !== data.length * 8) {
      throw new Error(
        `Data size mismatch: expected ${this.capacity / 8} bytes, got ${data.length}`,
      );
    }
    const e = new BitEnumerator(data);
    let i = 0;
    e.forAll((b) => {
      this.storage[i] = b;
      i++;
    });
  }

  nextGeneration(
    currentChangeGrid: ChangeGrid,
    nextCellGrid: CellGrid,
    nextChangeGrid: ChangeGrid,
  ): void {
    nextCellGrid.setAll(false);
    nextChangeGrid.setAll(false);

    this.forAll((p) => {
      const currentAlive = this.getValue(p);
      if (currentChangeGrid.getValue(p)) {
        const neighborsCount = this.countNeighbors(p);
        const nextAlive = CellGrid.isAliveInNextGeneration(
          currentAlive,
          neighborsCount,
        );
        if (nextAlive) {
          nextCellGrid.setValue(true, p);
        }
        if (currentAlive !== nextAlive) {
          nextChangeGrid.setChanged(p);
        }
      } else {
        nextCellGrid.setValue(currentAlive, p);
      }
    });
  }
}
