/**
 * Test utilities for the ratchet package.
 */

import type { RandomNumberGenerator } from "@bcts/rand";

/**
 * Create a simple RNG that uses crypto.getRandomValues for testing.
 * In production, @bcts/rand provides SecureRandomNumberGenerator.
 */
export function createTestRng(): RandomNumberGenerator {
  return {
    randomData(count: number): Uint8Array {
      const data = new Uint8Array(count);
      crypto.getRandomValues(data);
      return data;
    },
  };
}
