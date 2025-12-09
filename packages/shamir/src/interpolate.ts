// Ported from bc-shamir-rust/src/interpolate.rs

import { memzero, memzeroVecVecU8 } from "@bcts/crypto";
import { MAX_SECRET_LEN } from "./index.js";
import { bitslice, bitsliceSetall, gf256Add, gf256Inv, gf256Mul, unbitslice } from "./hazmat.js";

/**
 * Calculate the lagrange basis coefficients for the lagrange polynomial
 * defined by the x coordinates xc at the value x.
 *
 * After the function runs, the values array should hold data satisfying:
 *                ---     (x-xc[j])
 *   values[i] =  | |   -------------
 *              j != i  (xc[i]-xc[j])
 *
 * @param values - Output array for the lagrange basis values
 * @param n - Number of points (length of the xc array, 0 < n <= 32)
 * @param xc - Array of x components to use as interpolating points
 * @param x - x coordinate to evaluate lagrange polynomials at
 */
function hazmatLagrangeBasis(values: Uint8Array, n: number, xc: Uint8Array, x: number): void {
  // call the contents of xc [ x0 x1 x2 ... xn-1 ]
  const xx = new Uint8Array(32 + 16);
  const xSlice = new Uint32Array(8);
  const lxi: Uint32Array[] = [];
  for (let i = 0; i < n; i++) {
    lxi.push(new Uint32Array(8));
  }
  const numerator = new Uint32Array(8);
  const denominator = new Uint32Array(8);
  const temp = new Uint32Array(8);

  xx.set(xc.subarray(0, n), 0);

  // xx now contains bitsliced [ x0 x1 x2 ... xn-1 0 0 0 ... ]
  for (let i = 0; i < n; i++) {
    // lxi = bitsliced [ xi xi+1 xi+2 ... xi-1 0 0 0 ]
    bitslice(lxi[i], xx.subarray(i));
    xx[i + n] = xx[i];
  }

  bitsliceSetall(xSlice, x);
  bitsliceSetall(numerator, 1);
  bitsliceSetall(denominator, 1);

  for (let i = 1; i < n; i++) {
    temp.set(xSlice);
    gf256Add(temp, lxi[i]);
    // temp = [ x-xi+i x-xi+2 x-xi+3 ... x-xi x x x]
    const numerator2 = new Uint32Array(numerator);
    gf256Mul(numerator, numerator2, temp);

    temp.set(lxi[0]);
    gf256Add(temp, lxi[i]);
    // temp = [x0-xi+1 x1-xi+1 x2-xi+2 ... xn-x0 0 0 0]
    const denominator2 = new Uint32Array(denominator);
    gf256Mul(denominator, denominator2, temp);
  }

  // At this stage the numerator contains
  // [ num0 num1 num2 ... numn 0 0 0]
  //
  // where numi = prod(j, j!=i, x-xj )
  //
  // and the denominator contains
  // [ d0 d1 d2 ... dn 0 0 0]
  //
  // where di = prod(j, j!=i, xi-xj)

  gf256Inv(temp, denominator);

  // gf256_inv uses exponentiation to calculate inverse, so the zeros end up
  // remaining zeros.

  // tmp = [ 1/d0 1/d1 1/d2 ... 1/dn 0 0 0]

  const numerator2 = new Uint32Array(numerator);
  gf256Mul(numerator, numerator2, temp);

  // numerator now contains [ l_n_0(x) l_n_1(x) ... l_n_n-1(x) 0 0 0]
  // use the xx array to unpack it

  unbitslice(xx, numerator);

  // copy results to output array
  values.set(xx.subarray(0, n), 0);
}

/**
 * Safely interpolate the polynomial going through
 * the points (x0 [y0_0 y0_1 y0_2 ... y0_31]) , (x1 [y1_0 ...]), ...
 *
 * where
 *   xi points to [x0 x1 ... xn-1 ]
 *   y contains an array of pointers to 32-bit arrays of y values
 *   y contains [y0 y1 y2 ... yn-1]
 *   and each of the yi arrays contain [yi_0 yi_i ... yi_31].
 *
 * @param n - Number of points to interpolate
 * @param xi - x coordinates for points (array of length n)
 * @param yl - Length of y coordinate arrays
 * @param yij - Array of n arrays of length yl
 * @param x - Coordinate to interpolate at
 * @returns The interpolated result of length yl
 */
export function interpolate(
  n: number,
  xi: Uint8Array,
  yl: number,
  yij: Uint8Array[],
  x: number,
): Uint8Array {
  // The hazmat gf256 implementation needs the y-coordinate data
  // to be in 32-byte blocks
  const y: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    y.push(new Uint8Array(MAX_SECRET_LEN));
  }
  const values = new Uint8Array(MAX_SECRET_LEN);

  for (let i = 0; i < n; i++) {
    y[i].set(yij[i].subarray(0, yl), 0);
  }

  const lagrange = new Uint8Array(n);
  const ySlice = new Uint32Array(8);
  const resultSlice = new Uint32Array(8);
  const temp = new Uint32Array(8);

  hazmatLagrangeBasis(lagrange, n, xi, x);

  bitsliceSetall(resultSlice, 0);

  for (let i = 0; i < n; i++) {
    bitslice(ySlice, y[i]);
    bitsliceSetall(temp, lagrange[i]);
    const temp2 = new Uint32Array(temp);
    gf256Mul(temp, temp2, ySlice);
    gf256Add(resultSlice, temp);
  }

  unbitslice(values, resultSlice);

  // the calling code is only expecting yl bytes back
  const result = new Uint8Array(yl);
  result.set(values.subarray(0, yl), 0);

  // clean up stack
  memzero(lagrange);
  memzero(ySlice);
  memzero(resultSlice);
  memzero(temp);
  memzeroVecVecU8(y);
  memzero(values);

  return result;
}
