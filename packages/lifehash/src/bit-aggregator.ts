/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { Data } from "./data";

/**
 * A class that accumulates bits fed into it and returns a block of data containing those bits.
 */
export class BitAggregator {
  private readonly _data: number[] = [];
  private bitMask = 0;

  append(bit: boolean): void {
    if (this.bitMask === 0) {
      this.bitMask = 0x80;
      this._data.push(0);
    }

    if (bit) {
      this._data[this._data.length - 1] |= this.bitMask;
    }

    this.bitMask >>= 1;
  }

  data(): Data {
    return new Uint8Array(this._data);
  }
}
