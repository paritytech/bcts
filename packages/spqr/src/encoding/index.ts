/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Erasure coding module: GF(2^16) field arithmetic and polynomial encoding.
 */

// GF(2^16) field arithmetic
export { GF16, POLY, polyReduce, parallelMult } from "./gf.js";

// Polynomial erasure coding
export {
  Poly,
  PolyEncoder,
  PolyDecoder,
  PolynomialError,
} from "./polynomial.js";

// Types
export type { Chunk, Encoder, Decoder, Pt } from "./polynomial.js";
