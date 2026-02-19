/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * A struct representing an integer cartesian point.
 */
export class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}

  static readonly zero = new Point(0, 0);

  equals(other: Point): boolean {
    return this.x === other.x && this.y === other.y;
  }
}
