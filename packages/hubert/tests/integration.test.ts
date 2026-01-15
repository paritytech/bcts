/**
 * Integration tests for IPFS, Mainline DHT, and Hybrid storage.
 *
 * These tests require external services (IPFS daemon, internet) and are skipped
 * by default unless explicitly enabled via environment variables.
 *
 * To run IPFS tests: HUBERT_TEST_IPFS=1 bun test
 * To run Mainline tests: HUBERT_TEST_MAINLINE=1 bun test
 * To run Hybrid tests: HUBERT_TEST_HYBRID=1 bun test
 *
 * Port of tests/test_ipfs_kv.rs, test_mainline_kv_*.rs, test_hybrid_kv.rs
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { testBasicRoundtrip, testWriteOnce, testNonexistentArid } from "./common/kv-tests.js";
import type * as IpfsModule from "../src/ipfs/index.js";
import type * as MainlineModule from "../src/mainline/index.js";
import type * as HybridModule from "../src/hybrid/index.js";

type IpfsKv = IpfsModule.IpfsKv;
type MainlineDhtKv = MainlineModule.MainlineDhtKv;
type HybridKv = HybridModule.HybridKv;

// Check environment variables to enable tests
const ENABLE_IPFS_TESTS = process.env["HUBERT_TEST_IPFS"] === "1";
const ENABLE_MAINLINE_TESTS = process.env["HUBERT_TEST_MAINLINE"] === "1";
const ENABLE_HYBRID_TESTS = process.env["HUBERT_TEST_HYBRID"] === "1";

// Helper to conditionally run tests
const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(ENABLE_IPFS_TESTS)("IPFS KvStore Integration", () => {
  // Dynamic import to avoid errors when module is not available
  let IpfsKvClass: typeof IpfsModule.IpfsKv;
  let store: IpfsKv;

  beforeAll(async () => {
    const ipfsModule = await import("../src/ipfs/index.js");
    IpfsKvClass = ipfsModule.IpfsKv;
    store = new IpfsKvClass("http://127.0.0.1:5001");
  });

  it("should pass basic roundtrip test", async () => {
    await testBasicRoundtrip(store, ARID);
  }, 60000);

  it("should pass write-once test", async () => {
    await testWriteOnce(store, ARID);
  }, 60000);

  it("should pass non-existent ARID test", async () => {
    await testNonexistentArid(store, ARID);
  }, 60000);

  it("should enforce size limits", async () => {
    const arid = ARID.new();
    const largeStore = new IpfsKvClass("http://127.0.0.1:5001").withMaxSize(100);

    // Create envelope larger than max size
    const largeData = "x".repeat(200);
    const large = Envelope.new(largeData);

    await expect(largeStore.put(arid, large)).rejects.toThrow();
  }, 60000);
});

describeIf(ENABLE_MAINLINE_TESTS)("Mainline DHT KvStore Integration", () => {
  let MainlineDhtKvClass: typeof MainlineModule.MainlineDhtKv;
  let store: MainlineDhtKv;

  beforeAll(async () => {
    const mainlineModule = await import("../src/mainline/index.js");
    MainlineDhtKvClass = mainlineModule.MainlineDhtKv;

    // Create DHT store - this connects to the real Mainline network
    store = await MainlineDhtKvClass.create();
  }, 120000);

  afterAll(async () => {
    if (store) {
      await store.destroy();
    }
  });

  it("should pass basic roundtrip test", async () => {
    await testBasicRoundtrip(store, ARID);
  }, 120000);

  it("should pass write-once test", async () => {
    await testWriteOnce(store, ARID);
  }, 120000);

  it("should pass non-existent ARID test", async () => {
    await testNonexistentArid(store, ARID);
  }, 60000);

  it("should enforce size limits (1000 bytes max)", async () => {
    const arid = ARID.new();

    // Create envelope larger than DHT max (1000 bytes)
    const largeData = "x".repeat(1500);
    const large = Envelope.new(largeData);

    await expect(store.put(arid, large)).rejects.toThrow();
  }, 60000);

  it("should support custom salt for namespace separation", async () => {
    const arid = ARID.new();
    const envelope = Envelope.new("Test with salt");

    // Create two stores with different salts
    const store1 = await MainlineDhtKvClass.create();
    const store2 = (await MainlineDhtKvClass.create()).withSalt(new Uint8Array([1, 2, 3, 4, 5]));

    // Store in first store
    await store1.put(arid, envelope);

    // Second store should not see it (different namespace)
    const result = await store2.get(arid, 10);
    expect(result).toBeNull();

    // Cleanup
    await store1.destroy();
    await store2.destroy();
  }, 120000);
});

describeIf(ENABLE_HYBRID_TESTS)("Hybrid KvStore Integration", () => {
  let HybridKvClass: typeof HybridModule.HybridKv;
  let store: HybridKv;

  beforeAll(async () => {
    const hybridModule = await import("../src/hybrid/index.js");
    HybridKvClass = hybridModule.HybridKv;

    // Create hybrid store
    store = await HybridKvClass.create("http://127.0.0.1:5001");
  }, 120000);

  afterAll(async () => {
    if (store) {
      await store.destroy();
    }
  });

  it("should pass basic roundtrip test", async () => {
    await testBasicRoundtrip(store, ARID);
  }, 120000);

  it("should store small envelopes in DHT", async () => {
    const arid = ARID.new();
    const smallEnvelope = Envelope.new("Small");

    await store.put(arid, smallEnvelope);

    const result = await store.get(arid, 60);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.extractString()).toBe("Small");
    }
  }, 120000);

  it("should store large envelopes in IPFS with reference", async () => {
    const arid = ARID.new();

    // Create large envelope (> 1000 bytes DHT limit)
    const largeData = "x".repeat(2000);
    const largeEnvelope = Envelope.new(largeData);

    await store.put(arid, largeEnvelope);

    const result = await store.get(arid, 120);
    expect(result).not.toBeNull();

    // Should retrieve original large data
    if (result) {
      const subject = result.extractString();
      expect(subject?.length).toBe(2000);
    }
  }, 180000);

  it("should handle write-once for both small and large envelopes", async () => {
    const arid1 = ARID.new();
    const arid2 = ARID.new();

    // Small envelope (DHT)
    await store.put(arid1, Envelope.new("First small"));
    await expect(store.put(arid1, Envelope.new("Second small"))).rejects.toThrow();

    // Large envelope (IPFS)
    const largeData = "y".repeat(2000);
    await store.put(arid2, Envelope.new(largeData));
    await expect(store.put(arid2, Envelope.new("Second large"))).rejects.toThrow();
  }, 180000);
});

// Simple placeholder test when no integration tests are enabled
describe("Integration Tests", () => {
  it("should be skipped by default (set HUBERT_TEST_* env vars to enable)", () => {
    if (!ENABLE_IPFS_TESTS && !ENABLE_MAINLINE_TESTS && !ENABLE_HYBRID_TESTS) {
      console.log(
        "Integration tests are skipped. Set environment variables to enable:\n" +
          "  HUBERT_TEST_IPFS=1     - Enable IPFS tests (requires IPFS daemon)\n" +
          "  HUBERT_TEST_MAINLINE=1 - Enable Mainline DHT tests (requires internet)\n" +
          "  HUBERT_TEST_HYBRID=1   - Enable Hybrid tests (requires both)",
      );
    }
    expect(true).toBe(true);
  });
});
