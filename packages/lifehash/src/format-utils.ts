/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import type { Data } from "./data";
import { dataToHex } from "./hex";
import { BitEnumerator } from "./bit-enumerator";

export { dataToHex as toHex };

/**
 * Convert the given UTF-8 string to a block of data.
 */
export function toData(utf8: string): Data {
  return new TextEncoder().encode(utf8);
}

/**
 * Convert the given block of data to a string of 1s and 0s.
 */
export function toBinary(data: Data): string {
  const e = new BitEnumerator(data);
  let result = "";
  e.forAll((b) => {
    result += b ? "1" : "0";
  });
  return result;
}
