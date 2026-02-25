/**
 * Incremental MAC tests.
 *
 * Validates the streaming HMAC-SHA256 implementation against libsignal's
 * test vectors and behavioral expectations.
 *
 * Reference: libsignal/rust/protocol/src/incremental_mac.rs (test module)
 */

import { describe, it, expect } from "vitest";
import {
  IncrementalMac,
  IncrementalMacValidator,
  calculateChunkSize,
} from "../src/crypto/incremental-mac.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

// Test key from libsignal
const TEST_KEY = hexToBytes("a83481457efecc69ad1342e21d9c0297f71debbf5c9304b4c1b2e433c1a78f98");
const TEST_CHUNK_SIZE = 32;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

describe("IncrementalMac", () => {
  it("throws on zero chunk size", () => {
    expect(() => new IncrementalMac(TEST_KEY, 0)).toThrow("chunk size must be positive");
  });

  it("throws on negative chunk size", () => {
    expect(() => new IncrementalMac(TEST_KEY, -1)).toThrow("chunk size must be positive");
  });

  it("final MAC matches non-incremental HMAC", () => {
    const input = new TextEncoder().encode(
      "this is a simple test input string which is longer than the chunk",
    );
    const expected = hmac(sha256, TEST_KEY, input);

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    inc.update(input);
    const actual = inc.finalize();

    expect(actual).toEqual(expected);
  });

  it("final MAC matches for empty input", () => {
    const input = new Uint8Array(0);
    const expected = hmac(sha256, TEST_KEY, input);

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const macs = inc.update(input);
    expect(macs).toHaveLength(0);

    const actual = inc.finalize();
    expect(actual).toEqual(expected);
  });

  it("produces MACs for complete chunks", () => {
    const input = new TextEncoder().encode(
      "this is a simple test input string which is longer than the chunk",
    );
    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);

    // With 65 bytes and chunk size 32, we get 2 chunk MACs
    expect(chunkMacs.length).toBe(2);

    // Each chunk MAC should be 32 bytes (SHA-256 output)
    for (const mac of chunkMacs) {
      expect(mac.length).toBe(32);
    }
  });

  it("chunk MACs are cumulative HMAC over all data so far", () => {
    // 64 bytes = exactly 2 chunks of 32
    const input = new TextEncoder().encode(
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    );

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const macs = inc.update(input);

    expect(macs.length).toBe(2);

    // First MAC covers first 32 bytes
    const first32 = input.slice(0, 32);
    expect(macs[0]).toEqual(hmac(sha256, TEST_KEY, first32));

    // Second MAC covers all 64 bytes
    expect(macs[1]).toEqual(hmac(sha256, TEST_KEY, input));
  });

  it("works with data fed in small pieces", () => {
    const input = new TextEncoder().encode(
      "this is a test string that is more than 32 bytes long for testing",
    );
    const expected = hmac(sha256, TEST_KEY, input);

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    // Feed 10 bytes at a time
    for (let i = 0; i < input.length; i += 10) {
      inc.update(input.slice(i, Math.min(i + 10, input.length)));
    }
    const actual = inc.finalize();

    expect(actual).toEqual(expected);
  });

  it("works with data fed one byte at a time", () => {
    const input = new TextEncoder().encode("exactly thirty two bytes long!!");
    // Pad to 32 bytes exactly
    const padded = new Uint8Array(32);
    padded.set(input.subarray(0, 32));

    const expected = hmac(sha256, TEST_KEY, padded);
    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);

    let allMacs: Uint8Array[] = [];
    for (let i = 0; i < padded.length; i++) {
      const macs = inc.update(padded.subarray(i, i + 1));
      allMacs = allMacs.concat(macs);
    }
    // Exactly one chunk boundary crossed
    expect(allMacs).toHaveLength(1);
    expect(allMacs[0]).toEqual(expected);
  });

  it("incremental MACs match manually computed cumulative HMACs", () => {
    const input = new TextEncoder().encode(
      "abcdefghij1234567890abcdefghij1234567890abcdefghij1234567890abcd",
    );
    // 64 bytes = exactly 2 chunks of 32

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);

    // Compute expected: HMAC over each prefix at chunk boundaries
    const expected: Uint8Array[] = [];
    for (let end = TEST_CHUNK_SIZE; end <= input.length; end += TEST_CHUNK_SIZE) {
      expected.push(hmac(sha256, TEST_KEY, input.slice(0, end)));
    }

    const actual = inc.update(input);
    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toEqual(expected[i]);
    }
  });

  it("handles input that is not a multiple of chunk size", () => {
    // 50 bytes: 1 full chunk (32) + 18 byte remainder
    const input = new TextEncoder().encode("12345678901234567890123456789012345678901234567890");

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const macs = inc.update(input);

    // One full chunk MAC
    expect(macs.length).toBe(1);
    expect(macs[0]).toEqual(hmac(sha256, TEST_KEY, input.slice(0, 32)));

    // Final MAC covers all 50 bytes
    const finalMac = inc.finalize();
    expect(finalMac).toEqual(hmac(sha256, TEST_KEY, input));
  });

  it("split delivery produces same MACs as single delivery", () => {
    const input = new TextEncoder().encode(
      "this is a simple test input string which is longer than the chunk",
    );

    // Single delivery
    const inc1 = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const singleMacs = inc1.update(input);
    const singleFinal = inc1.finalize();

    // Split delivery: first 20, then 20, then rest
    const inc2 = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const splitMacs: Uint8Array[] = [];
    splitMacs.push(...inc2.update(input.slice(0, 20)));
    splitMacs.push(...inc2.update(input.slice(20, 40)));
    splitMacs.push(...inc2.update(input.slice(40)));
    const splitFinal = inc2.finalize();

    expect(splitMacs.length).toBe(singleMacs.length);
    for (let i = 0; i < singleMacs.length; i++) {
      expect(splitMacs[i]).toEqual(singleMacs[i]);
    }
    expect(splitFinal).toEqual(singleFinal);
  });
});

describe("IncrementalMacValidator", () => {
  it("validates correct MACs", () => {
    const input = new TextEncoder().encode("this is a simple test input string");

    // Compute expected MACs
    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);
    const finalMac = inc.finalize();
    const expectedMacs = [...chunkMacs, finalMac];

    // Validate
    const validator = new IncrementalMacValidator(TEST_KEY, TEST_CHUNK_SIZE, expectedMacs);
    validator.update(input);
    validator.finalize();
  });

  it("returns correct validated byte counts", () => {
    const input = new TextEncoder().encode("this is a simple test input string");
    // 34 bytes: 1 full chunk (32) + 2 bytes remainder

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);
    const finalMac = inc.finalize();
    const expectedMacs = [...chunkMacs, finalMac];

    const validator = new IncrementalMacValidator(TEST_KEY, TEST_CHUNK_SIZE, expectedMacs);

    // Feed in 16-byte chunks (matching libsignal's validating_returns_right_size)
    const chunks = [];
    for (let i = 0; i < input.length; i += 16) {
      chunks.push(input.slice(i, Math.min(i + 16, input.length)));
    }
    // 34 bytes / 16 = 3 chunks: [16, 16, 2]
    expect(chunks.length).toBe(3);

    // First 16 bytes: no full chunk yet
    expect(validator.update(chunks[0])).toBe(0);
    // Next 16 bytes: completes chunk at 32
    expect(validator.update(chunks[1])).toBe(TEST_CHUNK_SIZE);
    // Last 2 bytes: no full chunk
    expect(validator.update(chunks[2])).toBe(0);
    // Finalize: remainder = 34 - 32 = 2
    expect(validator.finalize()).toBe(2);
  });

  it("throws on wrong chunk MAC", () => {
    const input = new TextEncoder().encode("this is a simple test input string");

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);
    const finalMac = inc.finalize();
    const expectedMacs = [...chunkMacs, finalMac];

    // Corrupt first MAC
    const corrupted = expectedMacs.map((m) => new Uint8Array(m));
    corrupted[0][0] ^= 0xff;
    const validator = new IncrementalMacValidator(TEST_KEY, TEST_CHUNK_SIZE, corrupted);
    expect(() => validator.update(input)).toThrow("MAC validation failed");
  });

  it("throws on wrong final MAC", () => {
    const input = new TextEncoder().encode("this is a simple test input string");

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);
    const finalMac = inc.finalize();
    const expectedMacs = [...chunkMacs, finalMac];

    // Corrupt last MAC
    const corrupted = expectedMacs.map((m) => new Uint8Array(m));
    const lastIdx = corrupted.length - 1;
    corrupted[lastIdx][0] ^= 0xff;
    const validator = new IncrementalMacValidator(TEST_KEY, TEST_CHUNK_SIZE, corrupted);
    // Chunk MACs should still pass
    validator.update(input);
    expect(() => validator.finalize()).toThrow("MAC validation failed");
  });

  it("throws when missing the final MAC", () => {
    const input = new TextEncoder().encode("this is a simple test input string");

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);
    inc.finalize();

    // Only provide chunk MACs, not final
    const validator = new IncrementalMacValidator(TEST_KEY, TEST_CHUNK_SIZE, chunkMacs);
    validator.update(input);
    expect(() => validator.finalize()).toThrow("MAC validation failed");
  });

  it("throws when missing a chunk MAC", () => {
    const input = new TextEncoder().encode("this is a simple test input string");

    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);
    const finalMac = inc.finalize();

    // Skip the first chunk MAC
    const missing = [...chunkMacs.slice(1), finalMac];
    const validator = new IncrementalMacValidator(TEST_KEY, TEST_CHUNK_SIZE, missing);
    expect(() => validator.update(input)).toThrow("MAC validation failed");
  });

  it("validates with data fed in small pieces", () => {
    const input = new TextEncoder().encode(
      "this is a longer test input string that spans multiple chunks for coverage",
    );

    // Compute expected MACs
    const inc = new IncrementalMac(TEST_KEY, TEST_CHUNK_SIZE);
    const chunkMacs = inc.update(input);
    const finalMac = inc.finalize();
    const expectedMacs = [...chunkMacs, finalMac];

    // Validate with small pieces
    const validator = new IncrementalMacValidator(TEST_KEY, TEST_CHUNK_SIZE, expectedMacs);
    for (let i = 0; i < input.length; i += 7) {
      validator.update(input.slice(i, Math.min(i + 7, input.length)));
    }
    validator.finalize();
  });
});

describe("calculateChunkSize", () => {
  const KiB = 1024;
  const MiB = 1024 * KiB;

  it("returns minimum chunk size for small data", () => {
    expect(calculateChunkSize(0)).toBe(64 * KiB);
    expect(calculateChunkSize(KiB)).toBe(64 * KiB);
    expect(calculateChunkSize(10 * KiB)).toBe(64 * KiB);
    expect(calculateChunkSize(100 * KiB)).toBe(64 * KiB);
    expect(calculateChunkSize(MiB)).toBe(64 * KiB);
    expect(calculateChunkSize(10 * MiB)).toBe(64 * KiB);
  });

  it("scales linearly for medium data", () => {
    expect(calculateChunkSize(20 * MiB)).toBe(80 * KiB);
    expect(calculateChunkSize(100 * MiB)).toBe(400 * KiB);
    expect(calculateChunkSize(200 * MiB)).toBe(800 * KiB);
    expect(calculateChunkSize(256 * MiB)).toBe(MiB);
  });

  it("caps at maximum chunk size for large data", () => {
    expect(calculateChunkSize(512 * MiB)).toBe(2 * MiB);
    expect(calculateChunkSize(1024 * MiB)).toBe(2 * MiB);
    expect(calculateChunkSize(2048 * MiB)).toBe(2 * MiB);
  });
});
