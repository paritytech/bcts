/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
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
// interface to produce random numbers compatible with the `RandomNumberGenerator`
// trait used in `bc-rand-rust`, which in turn is compatible with the Swift
// protocol used in MacOS and iOS — important for cross-platform testing
// against the deterministic random number generator.

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
  rngNextWithUpperBoundU8,
  rngNextWithUpperBoundU16,
  rngNextWithUpperBoundU32,
  rngNextWithUpperBoundU64,
  rngNextInRange,
  rngNextInRangeU8,
  rngNextInRangeU16,
  rngNextInRangeU32,
  rngNextInRangeU64,
  rngNextInRangeI8,
  rngNextInRangeI16,
  rngNextInRangeI32,
  rngNextInRangeI64,
  rngNextInClosedRange,
  rngNextInClosedRangeU8,
  rngNextInClosedRangeU16,
  rngNextInClosedRangeU32,
  rngNextInClosedRangeU64,
  rngNextInClosedRangeI8,
  rngNextInClosedRangeI16,
  rngNextInClosedRangeI32,
  rngNextInClosedRangeI64,
  rngRandomArray,
  rngRandomBool,
  rngRandomU32,
} from "./random-number-generator.js";

// Secure random number generator (cryptographically strong)
export {
  SecureRandomNumberGenerator,
  randomData,
  fillRandomData,
  threadRng,
} from "./secure-random.js";

// Seeded random number generator (deterministic, for testing)
export {
  SeededRandomNumberGenerator,
  makeFakeRandomNumberGenerator,
  fakeRandomData,
} from "./seeded-random.js";
