// Ported from bc-shamir-rust/src/hazmat.rs
// GF(2^8) bitsliced polynomial operations for Shamir secret sharing

import { memzero } from "@blockchain-commons/crypto";

/**
 * Convert an array of bytes into a bitsliced representation.
 * Takes the first 32 bytes from x and produces 8 u32 values.
 *
 * @param r - Output array of 8 u32 values (bitsliced representation)
 * @param x - Input array of at least 32 bytes
 */
export function bitslice(r: Uint32Array, x: Uint8Array): void {
  if (x.length < 32) {
    throw new Error("bitslice: input must be at least 32 bytes");
  }
  if (r.length !== 8) {
    throw new Error("bitslice: output must have 8 elements");
  }

  memzero(r);

  for (let arrIdx = 0; arrIdx < 32; arrIdx++) {
    const cur = x[arrIdx];
    for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
      // r[bitIdx] |= ((cur & (1 << bitIdx)) >> bitIdx) << arrIdx
      r[bitIdx] |= ((cur & (1 << bitIdx)) >>> bitIdx) << arrIdx;
    }
  }
}

/**
 * Convert a bitsliced representation back to bytes.
 *
 * @param r - Output array of at least 32 bytes
 * @param x - Input array of 8 u32 values (bitsliced representation)
 */
export function unbitslice(r: Uint8Array, x: Uint32Array): void {
  if (r.length < 32) {
    throw new Error("unbitslice: output must be at least 32 bytes");
  }
  if (x.length !== 8) {
    throw new Error("unbitslice: input must have 8 elements");
  }

  memzero(r.subarray(0, 32));

  for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
    const cur = x[bitIdx];
    for (let arrIdx = 0; arrIdx < 32; arrIdx++) {
      // r[arrIdx] |= ((cur & (1 << arrIdx)) >> arrIdx) << bitIdx
      r[arrIdx] |= ((cur & (1 << arrIdx)) >>> arrIdx) << bitIdx;
    }
  }
}

/**
 * Set all 32 positions in a bitsliced array to the same byte value.
 *
 * @param r - Output array of 8 u32 values
 * @param x - Byte value to set in all positions
 */
export function bitsliceSetall(r: Uint32Array, x: number): void {
  if (r.length !== 8) {
    throw new Error("bitsliceSetall: output must have 8 elements");
  }

  for (let idx = 0; idx < 8; idx++) {
    // JavaScript needs special handling for the arithmetic right shift
    // This mirrors: *r = (((((x as u32) & (1u32.wrapping_shl(idx as u32)))
    //                       .wrapping_shl(31 - idx as u32)) as i32)
    //                       .wrapping_shr(31)) as u32;
    const bit = (x >>> idx) & 1;
    r[idx] = bit === 1 ? 0xffffffff : 0;
  }
}

/**
 * Add (XOR) r with x and store the result in r.
 * In GF(2^8), addition is XOR.
 *
 * @param r - First operand and result
 * @param x - Second operand
 */
export function gf256Add(r: Uint32Array, x: Uint32Array): void {
  if (r.length !== 8 || x.length !== 8) {
    throw new Error("gf256Add: arrays must have 8 elements");
  }

  for (let i = 0; i < 8; i++) {
    r[i] ^= x[i];
  }
}

/**
 * Safely multiply two bitsliced polynomials in GF(2^8) reduced by
 * x^8 + x^4 + x^3 + x + 1. r and a may overlap, but overlapping of r
 * and b will produce an incorrect result! If you need to square a polynomial
 * use gf256Square instead.
 *
 * @param r - Result array (8 u32 values)
 * @param a - First operand (may overlap with r)
 * @param b - Second operand (must NOT overlap with r)
 */
export function gf256Mul(r: Uint32Array, a: Uint32Array, b: Uint32Array): void {
  if (r.length !== 8 || a.length !== 8 || b.length !== 8) {
    throw new Error("gf256Mul: arrays must have 8 elements");
  }

  // Russian Peasant multiplication on two bitsliced polynomials
  const a2 = new Uint32Array(a);

  r[0] = a2[0] & b[0];
  r[1] = a2[1] & b[0];
  r[2] = a2[2] & b[0];
  r[3] = a2[3] & b[0];
  r[4] = a2[4] & b[0];
  r[5] = a2[5] & b[0];
  r[6] = a2[6] & b[0];
  r[7] = a2[7] & b[0];
  a2[0] ^= a2[7]; // reduce
  a2[2] ^= a2[7];
  a2[3] ^= a2[7];

  r[0] ^= a2[7] & b[1]; // add
  r[1] ^= a2[0] & b[1];
  r[2] ^= a2[1] & b[1];
  r[3] ^= a2[2] & b[1];
  r[4] ^= a2[3] & b[1];
  r[5] ^= a2[4] & b[1];
  r[6] ^= a2[5] & b[1];
  r[7] ^= a2[6] & b[1];
  a2[7] ^= a2[6]; // reduce
  a2[1] ^= a2[6];
  a2[2] ^= a2[6];

  r[0] ^= a2[6] & b[2]; // add
  r[1] ^= a2[7] & b[2];
  r[2] ^= a2[0] & b[2];
  r[3] ^= a2[1] & b[2];
  r[4] ^= a2[2] & b[2];
  r[5] ^= a2[3] & b[2];
  r[6] ^= a2[4] & b[2];
  r[7] ^= a2[5] & b[2];
  a2[6] ^= a2[5]; // reduce
  a2[0] ^= a2[5];
  a2[1] ^= a2[5];

  r[0] ^= a2[5] & b[3]; // add
  r[1] ^= a2[6] & b[3];
  r[2] ^= a2[7] & b[3];
  r[3] ^= a2[0] & b[3];
  r[4] ^= a2[1] & b[3];
  r[5] ^= a2[2] & b[3];
  r[6] ^= a2[3] & b[3];
  r[7] ^= a2[4] & b[3];
  a2[5] ^= a2[4]; // reduce
  a2[7] ^= a2[4];
  a2[0] ^= a2[4];

  r[0] ^= a2[4] & b[4]; // add
  r[1] ^= a2[5] & b[4];
  r[2] ^= a2[6] & b[4];
  r[3] ^= a2[7] & b[4];
  r[4] ^= a2[0] & b[4];
  r[5] ^= a2[1] & b[4];
  r[6] ^= a2[2] & b[4];
  r[7] ^= a2[3] & b[4];
  a2[4] ^= a2[3]; // reduce
  a2[6] ^= a2[3];
  a2[7] ^= a2[3];

  r[0] ^= a2[3] & b[5]; // add
  r[1] ^= a2[4] & b[5];
  r[2] ^= a2[5] & b[5];
  r[3] ^= a2[6] & b[5];
  r[4] ^= a2[7] & b[5];
  r[5] ^= a2[0] & b[5];
  r[6] ^= a2[1] & b[5];
  r[7] ^= a2[2] & b[5];
  a2[3] ^= a2[2]; // reduce
  a2[5] ^= a2[2];
  a2[6] ^= a2[2];

  r[0] ^= a2[2] & b[6]; // add
  r[1] ^= a2[3] & b[6];
  r[2] ^= a2[4] & b[6];
  r[3] ^= a2[5] & b[6];
  r[4] ^= a2[6] & b[6];
  r[5] ^= a2[7] & b[6];
  r[6] ^= a2[0] & b[6];
  r[7] ^= a2[1] & b[6];
  a2[2] ^= a2[1]; // reduce
  a2[4] ^= a2[1];
  a2[5] ^= a2[1];

  r[0] ^= a2[1] & b[7]; // add
  r[1] ^= a2[2] & b[7];
  r[2] ^= a2[3] & b[7];
  r[3] ^= a2[4] & b[7];
  r[4] ^= a2[5] & b[7];
  r[5] ^= a2[6] & b[7];
  r[6] ^= a2[7] & b[7];
  r[7] ^= a2[0] & b[7];
}

/**
 * Square x in GF(2^8) and write the result to r.
 * r and x may overlap.
 *
 * @param r - Result array (8 u32 values)
 * @param x - Value to square
 */
export function gf256Square(r: Uint32Array, x: Uint32Array): void {
  if (r.length !== 8 || x.length !== 8) {
    throw new Error("gf256Square: arrays must have 8 elements");
  }

  // Use the Freshman's Dream rule to square the polynomial
  // Assignments are done from 7 downto 0, because this allows
  // in-place operation (e.g. gf256Square(r, r))
  const r14 = x[7];
  const r12 = x[6];
  let r10 = x[5];
  let r8 = x[4];
  r[6] = x[3];
  r[4] = x[2];
  r[2] = x[1];
  r[0] = x[0];

  // Reduce with x^8 + x^4 + x^3 + x + 1 until order is less than 8
  r[7] = r14; // r[7] was 0
  r[6] ^= r14;
  r10 ^= r14;
  // Skip, because r13 is always 0
  r[4] ^= r12;
  r[5] = r12; // r[5] was 0
  r[7] ^= r12;
  r8 ^= r12;
  // Skip, because r11 is always 0
  r[2] ^= r10;
  r[3] = r10; // r[3] was 0
  r[5] ^= r10;
  r[6] ^= r10;
  r[1] = r14; // r[1] was 0
  r[2] ^= r14; // Substitute r9 by r14 because they will always be equal
  r[4] ^= r14;
  r[5] ^= r14;
  r[0] ^= r8;
  r[1] ^= r8;
  r[3] ^= r8;
  r[4] ^= r8;
}

/**
 * Invert x in GF(2^8) and write the result to r.
 *
 * @param r - Result array (8 u32 values)
 * @param x - Value to invert (will be modified)
 */
export function gf256Inv(r: Uint32Array, x: Uint32Array): void {
  if (r.length !== 8 || x.length !== 8) {
    throw new Error("gf256Inv: arrays must have 8 elements");
  }

  const y = new Uint32Array(8);
  const z = new Uint32Array(8);

  gf256Square(y, x); // y = x^2
  const y2 = new Uint32Array(y);
  gf256Square(y, y2); // y = x^4
  gf256Square(r, y); // r = x^8
  gf256Mul(z, r, x); // z = x^9
  const r2a = new Uint32Array(r);
  gf256Square(r, r2a); // r = x^16
  const r2b = new Uint32Array(r);
  gf256Mul(r, r2b, z); // r = x^25
  const r2c = new Uint32Array(r);
  gf256Square(r, r2c); // r = x^50
  gf256Square(z, r); // z = x^100
  const z2 = new Uint32Array(z);
  gf256Square(z, z2); // z = x^200
  const r2d = new Uint32Array(r);
  gf256Mul(r, r2d, z); // r = x^250
  const r2e = new Uint32Array(r);
  gf256Mul(r, r2e, y); // r = x^254
}
