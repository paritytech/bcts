/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Polynomial erasure coding over GF(2^16).
 * Ported from the Rust SPQR implementation.
 *
 * The encoder splits a message into 16 parallel polynomials and can produce
 * an unlimited number of coded chunks. Any sufficient subset of chunks
 * allows the decoder to reconstruct the original message via Lagrange
 * interpolation.
 */

import { GF16, parallelMult } from "./gf.js";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class PolynomialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolynomialError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A point on a polynomial in GF(2^16). */
export interface Pt {
  x: GF16;
  y: GF16;
}

/** A coded chunk: an index plus exactly 32 bytes of data. */
export interface Chunk {
  index: number; // u16
  data: Uint8Array; // exactly 32 bytes
}

/** Encoder interface. */
export interface Encoder {
  nextChunk(): Chunk;
}

/** Decoder interface. */
export interface Decoder {
  addChunk(chunk: Chunk): void;
  decodedMessage(): Uint8Array | null;
}

// ---------------------------------------------------------------------------
// Number of polynomials used for interleaving
// ---------------------------------------------------------------------------

const NUM_POLYS = 16;
const CHUNK_DATA_SIZE = 32; // 16 GF16 values * 2 bytes each

// ---------------------------------------------------------------------------
// Poly class
// ---------------------------------------------------------------------------

/**
 * A polynomial over GF(2^16) in coefficient form.
 *
 * Coefficients are stored in little-endian order:
 *   coefficients[0] = constant term (x^0)
 *   coefficients[1] = linear term (x^1)
 *   ...
 */
export class Poly {
  coefficients: GF16[];

  constructor(coefficients: GF16[]) {
    this.coefficients = coefficients;
  }

  /** Create a zero polynomial of a given length. */
  static zeros(len: number): Poly {
    const coeffs: GF16[] = new Array(len);
    for (let i = 0; i < len; i++) {
      coeffs[i] = GF16.ZERO;
    }
    return new Poly(coeffs);
  }

  /** Number of coefficients. */
  get length(): number {
    return this.coefficients.length;
  }

  // -- Evaluation -----------------------------------------------------------

  /**
   * Evaluate the polynomial at a given point using a divide-and-conquer
   * approach for computing powers of x, then a dot product.
   *
   * xs[0] = 1, xs[1] = x, xs[i] = xs[floor(i/2)] * xs[floor(i/2) + (i%2)]
   */
  computeAt(x: GF16): GF16 {
    const n = this.coefficients.length;
    if (n === 0) return GF16.ZERO;
    if (n === 1) return this.coefficients[0];

    // Build powers of x
    const xs: GF16[] = new Array(n);
    xs[0] = GF16.ONE;
    if (n > 1) xs[1] = x;

    for (let i = 2; i < n; i++) {
      const half = i >>> 1;
      const rem = i & 1;
      xs[i] = xs[half].mul(xs[half + rem]);
    }

    // Dot product: sum(coefficients[i] * xs[i])
    let result = GF16.ZERO;
    for (let i = 0; i < n; i++) {
      result = result.add(this.coefficients[i].mul(xs[i]));
    }
    return result;
  }

  // -- In-place arithmetic --------------------------------------------------

  /** Add another polynomial to this one in-place. */
  addAssign(other: Poly): void {
    // Extend if necessary
    while (this.coefficients.length < other.coefficients.length) {
      this.coefficients.push(GF16.ZERO);
    }
    for (let i = 0; i < other.coefficients.length; i++) {
      this.coefficients[i] = this.coefficients[i].add(other.coefficients[i]);
    }
  }

  /** Multiply all coefficients by a scalar in-place. */
  multAssign(m: GF16): void {
    parallelMult(m, this.coefficients);
  }

  // -- Serialization --------------------------------------------------------

  /** Serialize coefficients as big-endian u16 pairs. */
  serialize(): Uint8Array {
    const out = new Uint8Array(this.coefficients.length * 2);
    for (let i = 0; i < this.coefficients.length; i++) {
      const v = this.coefficients[i].value;
      out[i * 2] = (v >>> 8) & 0xff;
      out[i * 2 + 1] = v & 0xff;
    }
    return out;
  }

  /** Deserialize from big-endian u16 pairs. */
  static deserialize(data: Uint8Array): Poly {
    if (data.length % 2 !== 0) {
      throw new PolynomialError("Poly data length must be even");
    }
    const n = data.length / 2;
    const coeffs: GF16[] = new Array(n);
    for (let i = 0; i < n; i++) {
      coeffs[i] = new GF16((data[i * 2] << 8) | data[i * 2 + 1]);
    }
    return new Poly(coeffs);
  }

  // -- Lagrange interpolation -----------------------------------------------

  /**
   * Lagrange interpolation over a set of points.
   *
   * Given N points (x_i, y_i), produces the unique polynomial of degree < N
   * passing through all of them.
   */
  static lagrangeInterpolate(pts: Pt[]): Poly {
    const n = pts.length;
    if (n === 0) return new Poly([]);

    // Step 1: Compute the "master" product polynomial
    //   P(x) = PRODUCT_{i=0}^{n-1} (x - x_i)
    //
    // In GF(2^n), (x - x_i) = (x + x_i) since subtraction = addition.
    // We represent (x + x_i) as [x_i, 1] (constant, linear).
    let product = new Poly([pts[0].x, GF16.ONE]);
    for (let i = 1; i < n; i++) {
      product = polyMultiply(product, new Poly([pts[i].x, GF16.ONE]));
    }

    // Step 2: For each point, compute the Lagrange basis polynomial
    //   L_i(x) = y_i * PRODUCT_{j != i} (x - x_j) / PRODUCT_{j != i} (x_i - x_j)
    //
    // We obtain PRODUCT_{j != i} (x - x_j) by dividing the master product by
    // (x - x_i) using synthetic division.
    let result = Poly.zeros(n);

    for (let i = 0; i < n; i++) {
      // Synthetic division of `product` by (x - x_i) = (x + x_i)
      const basis = syntheticDivide(product, pts[i].x);

      // Compute the denominator: PRODUCT_{j != i} (x_i - x_j)
      // This is just basis.computeAt(x_i) since basis = product / (x - x_i)
      // and product(x_i) = 0, so we evaluate the quotient at x_i.
      const denom = basis.computeAt(pts[i].x);

      // Scale: L_i(x) = basis(x) * y_i / denom
      const scale = pts[i].y.div(denom);
      const scaled = clonePoly(basis);
      scaled.multAssign(scale);

      result.addAssign(scaled);
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Polynomial helpers (private)
// ---------------------------------------------------------------------------

/** Multiply two polynomials (convolution over GF(2^16)). */
function polyMultiply(a: Poly, b: Poly): Poly {
  if (a.length === 0 || b.length === 0) return new Poly([]);
  const result = Poly.zeros(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result.coefficients[i + j] = result.coefficients[i + j].add(
        a.coefficients[i].mul(b.coefficients[j]),
      );
    }
  }
  return result;
}

/**
 * Synthetic division: divide poly by (x - root) = (x + root) in GF(2^n).
 *
 * Returns the quotient polynomial (degree one less than input).
 */
function syntheticDivide(poly: Poly, root: GF16): Poly {
  const n = poly.length;
  if (n <= 1) return new Poly([]);

  // Work from high degree down
  const quotient: GF16[] = new Array(n - 1);
  let carry = GF16.ZERO;

  for (let i = n - 1; i >= 1; i--) {
    const coeff = poly.coefficients[i].add(carry);
    quotient[i - 1] = coeff;
    // In GF(2^n), multiply by root (same as negated root since -root = root)
    carry = coeff.mul(root);
  }

  return new Poly(quotient);
}

/** Clone a polynomial (shallow copy of coefficient array). */
function clonePoly(p: Poly): Poly {
  return new Poly(p.coefficients.slice());
}

// ---------------------------------------------------------------------------
// SortedPtSet - maintains points sorted by x.value, no duplicate x's
// ---------------------------------------------------------------------------

class SortedPtSet {
  private pts: Pt[] = [];

  get length(): number {
    return this.pts.length;
  }

  /** Insert a point, maintaining sorted order. Returns false if duplicate x. */
  insert(pt: Pt): boolean {
    const idx = this.findIndex(pt.x.value);
    if (idx < this.pts.length && this.pts[idx].x.value === pt.x.value) {
      return false; // duplicate x
    }
    this.pts.splice(idx, 0, pt);
    return true;
  }

  /** Binary search for the insertion point of a given x value. */
  private findIndex(xVal: number): number {
    let lo = 0;
    let hi = this.pts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.pts[mid].x.value < xVal) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /** Look up a point by x value. Returns undefined if not found. */
  findByX(xVal: number): Pt | undefined {
    const idx = this.findIndex(xVal);
    if (idx < this.pts.length && this.pts[idx].x.value === xVal) {
      return this.pts[idx];
    }
    return undefined;
  }

  /** Return all points as an array (for interpolation). */
  toArray(): Pt[] {
    return this.pts.slice();
  }

  /** Serialize all points as big-endian u16 pairs (x then y). */
  serialize(): Uint8Array {
    const out = new Uint8Array(this.pts.length * 4);
    for (let i = 0; i < this.pts.length; i++) {
      const pt = this.pts[i];
      out[i * 4] = (pt.x.value >>> 8) & 0xff;
      out[i * 4 + 1] = pt.x.value & 0xff;
      out[i * 4 + 2] = (pt.y.value >>> 8) & 0xff;
      out[i * 4 + 3] = pt.y.value & 0xff;
    }
    return out;
  }

  /** Deserialize from big-endian u16 pairs (x then y). */
  static deserialize(data: Uint8Array): SortedPtSet {
    if (data.length % 4 !== 0) {
      throw new PolynomialError("SortedPtSet data length must be multiple of 4");
    }
    const set = new SortedPtSet();
    const n = data.length / 4;
    for (let i = 0; i < n; i++) {
      const x = new GF16((data[i * 4] << 8) | data[i * 4 + 1]);
      const y = new GF16((data[i * 4 + 2] << 8) | data[i * 4 + 3]);
      set.insert({ x, y });
    }
    return set;
  }
}

// ---------------------------------------------------------------------------
// Encoder state
// ---------------------------------------------------------------------------

/** Points-based state: raw GF16 values for each of 16 polynomials. */
interface PointsState {
  kind: "points";
  /** 16 arrays of GF16 y-values (x is implicit: 0, 1, 2, ...). */
  points: GF16[][];
}

/** Polys-based state: Lagrange-interpolated polynomials. */
interface PolysState {
  kind: "polys";
  polys: Poly[];
}

type EncoderState = PointsState | PolysState;

// ---------------------------------------------------------------------------
// PolyEncoder
// ---------------------------------------------------------------------------

export class PolyEncoder implements Encoder {
  private idx: number;
  private state: EncoderState;

  private constructor(idx: number, state: EncoderState) {
    this.idx = idx;
    this.state = state;
  }

  /**
   * Create an encoder from a message byte array.
   *
   * The message is split into 16 interleaved streams of GF16 values.
   * Each pair of consecutive bytes becomes one GF16 element. If the message
   * length is odd, it is padded with a zero byte.
   */
  static encodeBytes(msg: Uint8Array): PolyEncoder {
    // Pad to even length
    let padded: Uint8Array;
    if (msg.length % 2 !== 0) {
      padded = new Uint8Array(msg.length + 1);
      padded.set(msg);
      // Last byte is already 0
    } else {
      padded = msg;
    }

    // Total number of GF16 values
    const totalValues = padded.length / 2;

    // Initialize 16 point arrays
    const points: GF16[][] = new Array(NUM_POLYS);
    for (let p = 0; p < NUM_POLYS; p++) {
      points[p] = [];
    }

    // Distribute values across 16 polynomials round-robin
    for (let i = 0; i < totalValues; i++) {
      const poly = i % NUM_POLYS;
      const value = (padded[i * 2] << 8) | padded[i * 2 + 1];
      points[poly].push(new GF16(value));
    }

    return new PolyEncoder(0, { kind: "points", points });
  }

  /** Return the next chunk and advance the index. */
  nextChunk(): Chunk {
    const chunk = this.chunkAt(this.idx);
    this.idx++;
    return chunk;
  }

  /** Compute the chunk at a specific index. */
  chunkAt(idx: number): Chunk {
    const data = new Uint8Array(CHUNK_DATA_SIZE);

    for (let i = 0; i < NUM_POLYS; i++) {
      const totalIdx = idx * NUM_POLYS + i;
      const poly = totalIdx % NUM_POLYS;
      const polyIdx = Math.floor(totalIdx / NUM_POLYS);
      const val = this.pointAt(poly, polyIdx);
      data[i * 2] = (val.value >>> 8) & 0xff;
      data[i * 2 + 1] = val.value & 0xff;
    }

    return { index: idx & 0xffff, data };
  }

  /**
   * Get the GF16 value for polynomial `poly` at index `idx`.
   *
   * If we are in Points state and the index is within range, return directly.
   * Otherwise, convert to Polys state and evaluate.
   */
  private pointAt(poly: number, idx: number): GF16 {
    if (this.state.kind === "points") {
      const pts = this.state.points[poly];
      if (idx < pts.length) {
        return pts[idx];
      }
      // Need to convert to polys for extrapolation
      this.convertToPolys();
    }

    // State is now "polys"
    const polys = (this.state as PolysState).polys;
    return polys[poly].computeAt(new GF16(idx));
  }

  /** Convert from Points state to Polys state via Lagrange interpolation. */
  private convertToPolys(): void {
    if (this.state.kind === "polys") return;

    const { points } = this.state;
    const polys: Poly[] = new Array(NUM_POLYS);

    for (let p = 0; p < NUM_POLYS; p++) {
      const pts: Pt[] = points[p].map((y, i) => ({
        x: new GF16(i),
        y,
      }));
      polys[p] = Poly.lagrangeInterpolate(pts);
    }

    this.state = { kind: "polys", polys };
  }

  /** Serialize encoder state for protobuf transport. */
  toProto(): { idx: number; pts: Uint8Array[]; polys: Uint8Array[] } {
    if (this.state.kind === "points") {
      const pts: Uint8Array[] = this.state.points.map((arr) => {
        const buf = new Uint8Array(arr.length * 2);
        for (let i = 0; i < arr.length; i++) {
          buf[i * 2] = (arr[i].value >>> 8) & 0xff;
          buf[i * 2 + 1] = arr[i].value & 0xff;
        }
        return buf;
      });
      return { idx: this.idx, pts, polys: [] };
    }
    const polys: Uint8Array[] = (this.state as PolysState).polys.map((p) =>
      p.serialize(),
    );
    return { idx: this.idx, pts: [], polys };
  }

  /** Restore encoder from protobuf data. */
  static fromProto(data: {
    idx: number;
    pts: Uint8Array[];
    polys: Uint8Array[];
  }): PolyEncoder {
    if (data.polys.length > 0) {
      const polys = data.polys.map((buf) => Poly.deserialize(buf));
      return new PolyEncoder(data.idx, { kind: "polys", polys });
    }
    const points: GF16[][] = data.pts.map((buf) => {
      const arr: GF16[] = [];
      for (let i = 0; i < buf.length; i += 2) {
        arr.push(new GF16((buf[i] << 8) | buf[i + 1]));
      }
      return arr;
    });
    return new PolyEncoder(data.idx, { kind: "points", points });
  }
}

// ---------------------------------------------------------------------------
// PolyDecoder
// ---------------------------------------------------------------------------

export class PolyDecoder implements Decoder {
  /** Total number of GF16 values needed (= message byte length / 2, rounded up). */
  ptsNeeded: number;
  private pts: SortedPtSet[];
  private _isComplete: boolean;

  private constructor(ptsNeeded: number, pts: SortedPtSet[], isComplete: boolean) {
    this.ptsNeeded = ptsNeeded;
    this.pts = pts;
    this._isComplete = isComplete;
  }

  /**
   * Create a decoder for a message of `lenBytes` bytes.
   *
   * The caller must know the original message length to know when enough
   * chunks have been received.
   */
  static create(lenBytes: number): PolyDecoder {
    const paddedLen = lenBytes % 2 !== 0 ? lenBytes + 1 : lenBytes;
    const ptsNeeded = paddedLen / 2;

    const pts: SortedPtSet[] = new Array(NUM_POLYS);
    for (let i = 0; i < NUM_POLYS; i++) {
      pts[i] = new SortedPtSet();
    }

    return new PolyDecoder(ptsNeeded, pts, false);
  }

  /** Whether all polynomial sets have enough points to decode. */
  get isComplete(): boolean {
    return this._isComplete;
  }

  /**
   * Number of points necessary for polynomial `poly`.
   *
   * The total points (ptsNeeded) are distributed across 16 polynomials
   * round-robin, so some may need one more point than others.
   */
  private necessaryPoints(poly: number): number {
    const base = Math.floor(this.ptsNeeded / NUM_POLYS);
    return poly < this.ptsNeeded % NUM_POLYS ? base + 1 : base;
  }

  /** Add a chunk to the decoder. */
  addChunk(chunk: Chunk): void {
    if (this._isComplete) return;

    for (let i = 0; i < NUM_POLYS; i++) {
      const totalIdx = chunk.index * NUM_POLYS + i;
      const poly = totalIdx % NUM_POLYS;
      const polyIdx = Math.floor(totalIdx / NUM_POLYS);

      const needed = this.necessaryPoints(poly);
      if (this.pts[poly].length >= needed) {
        continue; // Already have enough points for this polynomial
      }

      const y = new GF16((chunk.data[i * 2] << 8) | chunk.data[i * 2 + 1]);
      const pt: Pt = { x: new GF16(polyIdx), y };
      this.pts[poly].insert(pt);
    }

    // Check completeness
    this._isComplete = this.checkComplete();
  }

  /** Check whether all 16 polynomial sets have enough points. */
  private checkComplete(): boolean {
    for (let p = 0; p < NUM_POLYS; p++) {
      if (this.pts[p].length < this.necessaryPoints(p)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Attempt to decode the message.
   *
   * Returns the decoded byte array if enough chunks have been received,
   * or null if more chunks are needed.
   */
  decodedMessage(): Uint8Array | null {
    if (!this._isComplete) return null;

    const result = new Uint8Array(this.ptsNeeded * 2);

    for (let i = 0; i < this.ptsNeeded; i++) {
      const poly = i % NUM_POLYS;
      const polyIdx = Math.floor(i / NUM_POLYS);
      const xVal = polyIdx;

      // Try direct lookup first (fast path)
      let val: GF16;
      const direct = this.pts[poly].findByX(xVal);
      if (direct !== undefined) {
        val = direct.y;
      } else {
        // Fall back to Lagrange interpolation
        const allPts = this.pts[poly].toArray();
        const interpolated = Poly.lagrangeInterpolate(allPts);
        val = interpolated.computeAt(new GF16(xVal));
      }

      result[i * 2] = (val.value >>> 8) & 0xff;
      result[i * 2 + 1] = val.value & 0xff;
    }

    return result;
  }

  /** Serialize decoder state for protobuf transport. */
  toProto(): {
    ptsNeeded: number;
    polys: number;
    pts: Uint8Array[];
    isComplete: boolean;
  } {
    return {
      ptsNeeded: this.ptsNeeded,
      polys: NUM_POLYS,
      pts: this.pts.map((s) => s.serialize()),
      isComplete: this._isComplete,
    };
  }

  /** Restore decoder from protobuf data. */
  static fromProto(data: {
    ptsNeeded: number;
    polys: number;
    pts: Uint8Array[];
    isComplete: boolean;
  }): PolyDecoder {
    const pts: SortedPtSet[] = data.pts.map((buf) =>
      SortedPtSet.deserialize(buf),
    );
    // Ensure we always have exactly 16 sets
    while (pts.length < NUM_POLYS) {
      pts.push(new SortedPtSet() as unknown as SortedPtSet);
    }
    return new PolyDecoder(data.ptsNeeded, pts, data.isComplete);
  }
}
