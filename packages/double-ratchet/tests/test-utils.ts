/**
 * Test utilities for the ratchet package.
 */

import type { RandomNumberGenerator } from "@bcts/rand";

/**
 * Create a simple RNG that uses globalThis.crypto.getRandomValues for testing.
 * In production, @bcts/rand provides SecureRandomNumberGenerator.
 */
export function createTestRng(): RandomNumberGenerator {
  return {
    nextU32(): number {
      const buf = new Uint8Array(4);
      globalThis.crypto.getRandomValues(buf);
      return (buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24)) >>> 0;
    },
    nextU64(): bigint {
      const buf = new Uint8Array(8);
      globalThis.crypto.getRandomValues(buf);
      const lo = BigInt((buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24)) >>> 0);
      const hi = BigInt((buf[4] | (buf[5] << 8) | (buf[6] << 16) | (buf[7] << 24)) >>> 0);
      return (hi << 32n) | lo;
    },
    fillBytes(dest: Uint8Array): void {
      globalThis.crypto.getRandomValues(dest);
    },
    randomData(count: number): Uint8Array {
      const data = new Uint8Array(count);
      globalThis.crypto.getRandomValues(data);
      return data;
    },
    fillRandomData(data: Uint8Array): void {
      globalThis.crypto.getRandomValues(data);
    },
  };
}
