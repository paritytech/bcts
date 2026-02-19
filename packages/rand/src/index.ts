/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Blockchain Commons Random Number Utilities
// Ported from bc-rand-rust
//
// `bc-rand` exposes a uniform API for the random number primitives used
// in higher-level Blockchain Commons projects, including a cryptographically
// strong random number generator `SecureRandomNumberGenerator` and a
// deterministic random number generator `SeededRandomNumberGenerator`.
//
// These primitive random number generators implement the `RandomNumberGenerator`
// interface to produce random numbers compatible with the RandomNumberGenerator
// Swift protocol used in MacOS and iOS, which is important when using the
// deterministic random number generator for cross-platform testing.

// Widening multiplication utilities
export {
  wideMul,
  wideMulU8,
  wideMulU16,
  wideMulU32,
  wideMulU64,
  type WideMulResult,
} from "./widening.js";

// Magnitude conversion utilities
export { toMagnitude, toMagnitude64, fromMagnitude, fromMagnitude64 } from "./magnitude.js";

// Random number generator interface and utilities
export {
  type RandomNumberGenerator,
  rngRandomData,
  rngFillRandomData,
  rngNextWithUpperBound,
  rngNextWithUpperBoundU32,
  rngNextInRange,
  rngNextInRangeI32,
  rngNextInClosedRange,
  rngNextInClosedRangeI32,
  rngRandomArray,
  rngRandomBool,
  rngRandomU32,
} from "./random-number-generator.js";

// Secure random number generator (cryptographically strong)
export {
  SecureRandomNumberGenerator,
  randomData,
  fillRandomData,
  nextU64,
} from "./secure-random.js";

// Seeded random number generator (deterministic, for testing)
export {
  SeededRandomNumberGenerator,
  TEST_SEED,
  makeFakeRandomNumberGenerator,
  fakeRandomData,
} from "./seeded-random.js";
