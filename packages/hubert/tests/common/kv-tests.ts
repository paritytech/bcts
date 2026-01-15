/**
 * Unified test suite for KvStore implementations.
 *
 * Port of tests/common/kv_tests.rs from hubert-rust.
 *
 * @module
 */

import { expect } from "vitest";
import type { ARID, SecureRandomNumberGenerator } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import type { KvStore } from "../../src/kv-store.js";

/**
 * Create a new ARID for testing.
 *
 * @param ARIDClass - ARID class with new() method
 * @param rng - Random number generator
 * @returns New ARID instance
 */
export function createTestArid(
  ARIDClass: { new: (rng?: SecureRandomNumberGenerator) => ARID },
  rng?: SecureRandomNumberGenerator,
): ARID {
  return ARIDClass.new(rng);
}

/**
 * Create a test envelope with the given subject.
 *
 * @param subject - Subject string for the envelope
 * @returns New Envelope instance
 */
export function createTestEnvelope(subject: string): Envelope {
  return Envelope.new(subject);
}

/**
 * Test basic put/get roundtrip.
 *
 * Verifies:
 * - exists() returns false for new ARID
 * - put() stores envelope
 * - exists() returns true after put
 * - get() retrieves the correct envelope
 */
export async function testBasicRoundtrip(
  store: KvStore,
  ARIDClass: { new: (rng?: SecureRandomNumberGenerator) => ARID },
): Promise<void> {
  const arid = createTestArid(ARIDClass);
  const envelope = createTestEnvelope("Test");

  // ARID should not exist initially
  expect(await store.exists(arid)).toBe(false);

  // Put the envelope
  await store.put(arid, envelope);

  // ARID should exist now
  expect(await store.exists(arid)).toBe(true);

  // Get the envelope back
  const retrieved = await store.get(arid, 30);
  expect(retrieved).not.toBeNull();
  if (retrieved) {
    expect(retrieved.toCBOR()).toEqual(envelope.toCBOR());
  }
}

/**
 * Test write-once semantics.
 *
 * Verifies that putting to the same ARID twice fails.
 */
export async function testWriteOnce(
  store: KvStore,
  ARIDClass: { new: (rng?: SecureRandomNumberGenerator) => ARID },
): Promise<void> {
  const arid = createTestArid(ARIDClass);

  // First put should succeed
  await store.put(arid, createTestEnvelope("First"));

  // Second put should fail
  await expect(store.put(arid, createTestEnvelope("Second"))).rejects.toThrow();
}

/**
 * Test getting non-existent ARID.
 *
 * Verifies:
 * - exists() returns false
 * - get() returns null
 */
export async function testNonexistentArid(
  store: KvStore,
  ARIDClass: { new: (rng?: SecureRandomNumberGenerator) => ARID },
): Promise<void> {
  const arid = createTestArid(ARIDClass);

  expect(await store.exists(arid)).toBe(false);
  expect(await store.get(arid, 30)).toBeNull();
}

/**
 * Test multiple ARID storage.
 *
 * Verifies that multiple different ARIDs can be stored independently.
 */
export async function testMultipleArids(
  store: KvStore,
  ARIDClass: { new: (rng?: SecureRandomNumberGenerator) => ARID },
): Promise<void> {
  const arids = Array.from({ length: 5 }, () => createTestArid(ARIDClass));

  // Store envelopes
  for (let i = 0; i < arids.length; i++) {
    await store.put(arids[i], createTestEnvelope(`Msg ${i}`));
  }

  // Verify each can be retrieved
  for (let i = 0; i < arids.length; i++) {
    const retrieved = await store.get(arids[i], 30);
    expect(retrieved).not.toBeNull();

    // Extract subject and verify
    if (retrieved) {
      const subject = retrieved.extractSubject();
      expect(subject).toBe(`Msg ${i}`);
    }
  }
}

/**
 * Test size limit enforcement.
 *
 * Verifies that envelopes exceeding the size limit are rejected.
 */
export async function testSizeLimit(
  store: KvStore,
  ARIDClass: { new: (rng?: SecureRandomNumberGenerator) => ARID },
  maxSize: number,
): Promise<void> {
  const arid = createTestArid(ARIDClass);
  const largeData = "x".repeat(maxSize + 1000);
  const large = createTestEnvelope(largeData);

  await expect(store.put(arid, large)).rejects.toThrow();
}

/**
 * Test concurrent operations (simplified version).
 *
 * Verifies that multiple concurrent puts and gets work correctly.
 */
export async function testConcurrentOperations(
  store: KvStore,
  ARIDClass: { new: (rng?: SecureRandomNumberGenerator) => ARID },
): Promise<void> {
  const testData = [
    { subject: "Alice's data", body: "Secret from Alice" },
    { subject: "Bob's data", body: "Secret from Bob" },
    { subject: "Carol's data", body: "Secret from Carol" },
  ];

  const arids = testData.map(() => createTestArid(ARIDClass));

  // Concurrent puts
  await Promise.all(
    testData.map((data, i) => store.put(arids[i], createTestEnvelope(data.subject))),
  );

  // Small delay for propagation
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Concurrent gets
  const results = await Promise.all(arids.map((arid) => store.get(arid, 30)));

  // Verify all retrieved
  expect(results.every((r) => r !== null)).toBe(true);

  // Verify data matches
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result) {
      const subject = result.extractSubject();
      expect(subject).toBe(testData[i].subject);
    }
  }
}
