/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from provenance-mark-rust/src/xoshiro256starstar.rs

/**
 * Xoshiro256** PRNG implementation.
 * A fast, high-quality pseudorandom number generator.
 */
export class Xoshiro256StarStar {
  private s: [bigint, bigint, bigint, bigint];

  private constructor(s: [bigint, bigint, bigint, bigint]) {
    this.s = s;
  }

  /**
   * Get the internal state as an array of 4 u64 values.
   */
  toState(): [bigint, bigint, bigint, bigint] {
    return [...this.s] as [bigint, bigint, bigint, bigint];
  }

  /**
   * Create a new PRNG from a state array.
   */
  static fromState(state: [bigint, bigint, bigint, bigint]): Xoshiro256StarStar {
    return new Xoshiro256StarStar([...state] as [bigint, bigint, bigint, bigint]);
  }

  /**
   * Serialize the state to 32 bytes (little-endian).
   */
  toData(): Uint8Array {
    const data = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
      const val = this.s[i];
      for (let j = 0; j < 8; j++) {
        data[i * 8 + j] = Number((val >> BigInt(j * 8)) & 0xffn);
      }
    }
    return data;
  }

  /**
   * Create a new PRNG from 32 bytes of seed data (little-endian).
   */
  static fromData(data: Uint8Array): Xoshiro256StarStar {
    if (data.length !== 32) {
      throw new Error(`expected 32 bytes, got ${data.length}`);
    }
    const s: [bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n];
    for (let i = 0; i < 4; i++) {
      let val = 0n;
      for (let j = 0; j < 8; j++) {
        val |= BigInt(data[i * 8 + j]) << BigInt(j * 8);
      }
      s[i] = val;
    }
    return new Xoshiro256StarStar(s);
  }

  /**
   * Generate the next u64 value.
   */
  nextU64(): bigint {
    const result = this.starstarU64(this.s[1]);
    this.advance();
    return result;
  }

  /**
   * Generate the next u32 value (upper bits of u64 for better quality).
   */
  nextU32(): number {
    return Number((this.nextU64() >> 32n) & 0xffffffffn);
  }

  /**
   * Generate the next byte.
   */
  nextByte(): number {
    return Number(this.nextU64() & 0xffn);
  }

  /**
   * Generate the next n bytes.
   */
  nextBytes(len: number): Uint8Array {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = this.nextByte();
    }
    return bytes;
  }

  /**
   * Fill a buffer with random bytes.
   */
  fillBytes(dest: Uint8Array): void {
    // Use fill_bytes_via_next strategy - fill 8 bytes at a time
    let i = 0;
    while (i + 8 <= dest.length) {
      const val = this.nextU64();
      for (let j = 0; j < 8; j++) {
        dest[i + j] = Number((val >> BigInt(j * 8)) & 0xffn);
      }
      i += 8;
    }
    // Handle remaining bytes
    if (i < dest.length) {
      const val = this.nextU64();
      for (let j = 0; i < dest.length; i++, j++) {
        dest[i] = Number((val >> BigInt(j * 8)) & 0xffn);
      }
    }
  }

  /**
   * The starstar transformation: x * 5, rotate left 7, * 9
   */
  private starstarU64(x: bigint): bigint {
    const mask64 = 0xffffffffffffffffn;
    const mul5 = (x * 5n) & mask64;
    const rotated = this.rotateLeft64(mul5, 7n);
    return (rotated * 9n) & mask64;
  }

  /**
   * Rotate a 64-bit value left by n bits.
   */
  private rotateLeft64(x: bigint, n: bigint): bigint {
    const mask64 = 0xffffffffffffffffn;
    return ((x << n) | (x >> (64n - n))) & mask64;
  }

  /**
   * Advance the PRNG state.
   */
  private advance(): void {
    const mask64 = 0xffffffffffffffffn;
    const t = (this.s[1] << 17n) & mask64;

    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];

    this.s[2] ^= t;

    this.s[3] = this.rotateLeft64(this.s[3], 45n);
  }
}
