/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import type { Data } from "./data";

const HEX_CHARS = "0123456789abcdef";

function byteToHex(byte: number): string {
  return HEX_CHARS[(byte >> 4) & 0xf] + HEX_CHARS[byte & 0xf];
}

/**
 * Convert data to a hex string.
 */
export function dataToHex(data: Data): string {
  let result = "";
  for (const c of data) {
    result += byteToHex(c);
  }
  return result;
}

function hexDigitToBin(hex: string): number {
  if (hex >= "0" && hex <= "9") {
    return hex.charCodeAt(0) - "0".charCodeAt(0);
  } else if (hex >= "A" && hex <= "F") {
    return hex.charCodeAt(0) - "A".charCodeAt(0) + 10;
  } else if (hex >= "a" && hex <= "f") {
    return hex.charCodeAt(0) - "a".charCodeAt(0) + 10;
  } else {
    throw new Error("Invalid hex digit");
  }
}

/**
 * Convert a hex string to data.
 */
export function hexToData(hex: string): Data {
  const len = hex.length;
  if (len % 2 !== 0) {
    throw new Error("Hex string must have even number of characters.");
  }

  const count = len / 2;
  const result = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const b1 = hexDigitToBin(hex[i * 2]);
    const b2 = hexDigitToBin(hex[i * 2 + 1]);
    result[i] = (b1 << 4) | b2;
  }

  return result;
}
