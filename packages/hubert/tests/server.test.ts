/**
 * Server module tests.
 *
 * Port of tests/test_server.rs from hubert-rust.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import {
  Server,
  ServerKvClient,
  MemoryKv,
  type ServerConfig,
  defaultServerConfig,
} from "../src/server/index.js";
import {
  testBasicRoundtrip,
  testWriteOnce,
  testNonexistentArid,
  testMultipleArids,
  testConcurrentOperations,
} from "./common/kv-tests.js";

// Test server configurations with different ports
let testPort = 45679;
function getTestPort(): number {
  return testPort++;
}

describe("Server Module", () => {
  describe("MemoryKv", () => {
    it("should pass basic roundtrip test", async () => {
      const store = new MemoryKv();
      await testBasicRoundtrip(store, ARID);
    }, 60000);

    it("should pass write-once test", async () => {
      const store = new MemoryKv();
      await testWriteOnce(store, ARID);
    }, 60000);

    it("should pass non-existent ARID test", async () => {
      const store = new MemoryKv();
      await testNonexistentArid(store, ARID);
    }, 60000);

    it("should pass multiple ARIDs test", async () => {
      const store = new MemoryKv();
      await testMultipleArids(store, ARID);
    }, 60000);

    it("should pass concurrent operations test", async () => {
      const store = new MemoryKv();
      await testConcurrentOperations(store, ARID);
    }, 60000);
  });

  describe("Server with MemoryKv", () => {
    let server: Server;
    let client: ServerKvClient;
    let port: number;

    beforeEach(async () => {
      port = getTestPort();
      const config: ServerConfig = {
        ...defaultServerConfig,
        port,
      };
      server = Server.newMemory(config);

      // Start server in background
      server.run().catch(() => {
        // Server will error when closed
      });

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      client = new ServerKvClient(`http://127.0.0.1:${port}`);
    });

    afterEach(async () => {
      await server.close();
    });

    it("should put and get envelope roundtrip", async () => {
      const arid = ARID.new();
      const envelope = Envelope.new("Test message for server");

      // Put the envelope
      const receipt = await client.put(arid, envelope);
      expect(receipt).toBeTruthy();
      expect(receipt.length).toBeGreaterThan(0);

      // Get the envelope back
      const retrieved = await client.get(arid, 30);
      expect(retrieved).not.toBeNull();
      if (retrieved) {
        // Compare using taggedCborData() for byte-level comparison
        expect(retrieved.taggedCborData()).toEqual(envelope.taggedCborData());
      }
    }, 60000);

    it("should enforce write-once semantics", async () => {
      const arid = ARID.new();
      const envelope1 = Envelope.new("First message");
      const envelope2 = Envelope.new("Second message");

      // First put should succeed
      await client.put(arid, envelope1);

      // Second put to same ARID should fail
      await expect(client.put(arid, envelope2)).rejects.toThrow();
    }, 60000);

    it("should return null for non-existent ARID", async () => {
      const arid = ARID.new();
      const retrieved = await client.get(arid, 30);
      expect(retrieved).toBeNull();
    }, 60000);

    it("should handle TTL expiration", async () => {
      const arid = ARID.new();
      const envelope = Envelope.new("Message with TTL");

      // Put with 1 second TTL
      await client.put(arid, envelope, 1);

      // Should be available immediately
      const retrieved = await client.get(arid, 30);
      expect(retrieved).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Should be expired
      const expired = await client.get(arid, 30);
      expect(expired).toBeNull();
    }, 120000);

    it("should clamp TTL to max_ttl", async () => {
      // Create server with short max_ttl
      const shortTtlPort = getTestPort();
      const shortTtlConfig: ServerConfig = {
        port: shortTtlPort,
        maxTtl: 2, // 2 seconds max
        verbose: false,
      };
      const shortTtlServer = Server.newMemory(shortTtlConfig);

      shortTtlServer.run().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 100));

      const shortTtlClient = new ServerKvClient(`http://127.0.0.1:${shortTtlPort}`);

      try {
        const arid = ARID.new();
        const envelope = Envelope.new("Message with clamped TTL");

        // Put with 10 seconds (should be clamped to 2 seconds)
        await shortTtlClient.put(arid, envelope, 10);

        // Should be available immediately
        const retrieved = await shortTtlClient.get(arid, 30);
        expect(retrieved).not.toBeNull();

        // Wait for clamped TTL (2 seconds, not 10)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Should be expired after 2 seconds (not 10)
        const expired = await shortTtlClient.get(arid, 30);
        expect(expired).toBeNull();
      } finally {
        await shortTtlServer.close();
      }
    }, 120000);

    it("should respect get timeout", async () => {
      const arid = ARID.new(); // Non-existent ARID

      // Measure time to timeout
      const start = Date.now();
      const result = await client.get(arid, 2);
      const elapsed = (Date.now() - start) / 1000;

      // Should return null after timeout
      expect(result).toBeNull();

      // Verify timeout was respected (allow some margin)
      expect(elapsed).toBeGreaterThanOrEqual(1.5);
      expect(elapsed).toBeLessThan(4);
    }, 10000);
  });
});
