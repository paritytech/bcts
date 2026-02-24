#!/usr/bin/env node
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Hubert: Secure Distributed Substrate for Multiparty Transactions
 *
 * A command-line tool for storing and retrieving Gordian Envelopes using
 * distributed storage backends (BitTorrent Mainline DHT or IPFS).
 *
 * Port of bin/hubert.rs from hubert-rust.
 *
 * @module
 */

import { Command } from "commander";
import path from "path";

import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { randomData } from "@bcts/rand";

import {
  verbosePrintln,
  IpfsKv,
  MainlineDhtKv,
  HybridKv,
  Server,
  type ServerConfig,
  ServerKvClient,
  SqliteKv,
} from "../index.js";

// =============================================================================
// Types
// =============================================================================

type StorageBackend = "mainline" | "ipfs" | "hybrid" | "server";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse an ARID from ur:arid string format.
 *
 * Port of `parse_arid()` from bin/hubert.rs lines 150-153.
 */
function parseArid(s: string): ARID {
  try {
    return ARID.fromUrString(s);
  } catch {
    throw new Error("Invalid ARID format. Expected ur:arid");
  }
}

/**
 * Parse an Envelope from ur:envelope string format.
 *
 * Port of `parse_envelope()` from bin/hubert.rs lines 155-161.
 */
function parseEnvelope(s: string): Envelope {
  try {
    return Envelope.fromUrString(s);
  } catch {
    throw new Error("Invalid envelope format. Expected ur:envelope");
  }
}

/**
 * Generate a random envelope with the specified size.
 *
 * Port of `generate_random_envelope()` from bin/hubert.rs lines 163-167.
 */
function generateRandomEnvelope(size: number): Envelope {
  const randomBytes = randomData(size);
  // Pass raw Uint8Array directly - Envelope.new accepts it as EnvelopeEncodableValue
  return Envelope.new(randomBytes);
}

// =============================================================================
// Check Functions
// =============================================================================

/**
 * Check if Mainline DHT is available.
 *
 * Port of `check_mainline()` from bin/hubert.rs lines 169-182.
 */
async function checkMainline(): Promise<void> {
  try {
    const dht = await MainlineDhtKv.create();
    await dht.destroy();
    console.log("✓ Mainline DHT is available");
  } catch (e) {
    throw new Error(`✗ Mainline DHT is not available: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * Check if IPFS is available.
 *
 * Port of `check_ipfs()` from bin/hubert.rs lines 184-205.
 */
async function checkIpfs(port: number): Promise<void> {
  try {
    const url = `http://127.0.0.1:${port}/api/v0/version`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      console.log(`✓ IPFS is available at 127.0.0.1:${port}`);
    } else {
      throw new Error(`✗ IPFS daemon returned error: ${response.status}`);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`✗ IPFS is not available at 127.0.0.1:${port}: connection timeout`);
    }
    throw new Error(
      `✗ IPFS is not available at 127.0.0.1:${port}: ${e instanceof Error ? e.message : e}`,
    );
  }
}

/**
 * Check if Hubert server is available.
 */
async function checkServer(host: string, port: number): Promise<void> {
  try {
    const url = `http://${host}:${port}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const json = (await response.json()) as { server?: string; version?: string };
      if (json.server === "hubert") {
        const version = json.version ?? "unknown";
        console.log(`✓ Hubert server is available at ${host}:${port} (version ${version})`);
      } else {
        throw new Error(`✗ Server at ${host}:${port} is not a Hubert server`);
      }
    } else {
      throw new Error(`✗ Server at ${host}:${port} is not available (status: ${response.status})`);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`✗ Server is not available at ${host}:${port}: connection timeout`);
    }
    throw new Error(
      `✗ Server is not available at ${host}:${port}: ${e instanceof Error ? e.message : e}`,
    );
  }
}

// =============================================================================
// Put Functions
// =============================================================================

/**
 * Put envelope to Mainline DHT.
 *
 * Port of `put_mainline()` from bin/hubert.rs lines 207-221.
 */
async function putMainline(arid: ARID, envelope: Envelope, verbose: boolean): Promise<void> {
  const store = await MainlineDhtKv.create();
  try {
    await store.put(arid, envelope, undefined, verbose);
    if (verbose) {
      verbosePrintln("✓ Stored envelope at ARID");
    }
  } finally {
    await store.destroy();
  }
}

/**
 * Put envelope to IPFS.
 *
 * Port of `put_ipfs()` from bin/hubert.rs lines 223-250.
 */
async function putIpfs(
  arid: ARID,
  envelope: Envelope,
  port: number,
  pin: boolean,
  verbose: boolean,
): Promise<void> {
  const url = `http://127.0.0.1:${port}`;
  const store = new IpfsKv(url).withPinContent(pin);
  const result = await store.put(arid, envelope, undefined, verbose);

  if (verbose) {
    verbosePrintln("✓ Stored envelope at ARID");
  }

  // Extract and print CID if pinning was requested
  if (pin) {
    const cidPart = result.split("ipfs://")[1];
    if (cidPart) {
      console.log(`CID: ${cidPart}`);
    }
  }
}

/**
 * Put envelope to Hybrid storage.
 *
 * Port of `put_hybrid()` from bin/hubert.rs lines 278-308.
 */
async function putHybrid(
  arid: ARID,
  envelope: Envelope,
  port: number,
  pin: boolean,
  verbose: boolean,
): Promise<void> {
  const url = `http://127.0.0.1:${port}`;
  const store = (await HybridKv.create(url)).withPinContent(pin);
  try {
    const result = await store.put(arid, envelope, undefined, verbose);

    if (verbose) {
      verbosePrintln("✓ Stored envelope at ARID");
    }

    // Extract and print CID if pinning was requested and IPFS was used
    if (pin && result.includes("ipfs://")) {
      const cidPart = result.split("ipfs://")[1];
      if (cidPart) {
        console.log(`CID: ${cidPart}`);
      }
    }
  } finally {
    await store.destroy();
  }
}

/**
 * Put envelope to Hubert server.
 *
 * Port of `put_server()` from bin/hubert.rs lines 324-344.
 */
async function putServer(
  host: string,
  port: number,
  arid: ARID,
  envelope: Envelope,
  ttl: number | undefined,
  verbose: boolean,
): Promise<void> {
  const url = `http://${host}:${port}`;
  const store = new ServerKvClient(url);
  await store.put(arid, envelope, ttl, verbose);
  if (verbose) {
    verbosePrintln("✓ Stored envelope at ARID");
  }
}

// =============================================================================
// Get Functions
// =============================================================================

/**
 * Get envelope from Mainline DHT.
 *
 * Port of `get_mainline()` from bin/hubert.rs lines 252-262.
 */
async function getMainline(
  arid: ARID,
  timeout: number,
  verbose: boolean,
): Promise<Envelope | null> {
  const store = await MainlineDhtKv.create();
  try {
    return await store.get(arid, timeout, verbose);
  } finally {
    await store.destroy();
  }
}

/**
 * Get envelope from IPFS.
 *
 * Port of `get_ipfs()` from bin/hubert.rs lines 264-276.
 */
async function getIpfs(
  arid: ARID,
  timeout: number,
  port: number,
  verbose: boolean,
): Promise<Envelope | null> {
  const url = `http://127.0.0.1:${port}`;
  const store = new IpfsKv(url);
  return await store.get(arid, timeout, verbose);
}

/**
 * Get envelope from Hybrid storage.
 *
 * Port of `get_hybrid()` from bin/hubert.rs lines 310-322.
 */
async function getHybrid(
  arid: ARID,
  timeout: number,
  port: number,
  verbose: boolean,
): Promise<Envelope | null> {
  const url = `http://127.0.0.1:${port}`;
  const store = await HybridKv.create(url);
  try {
    return await store.get(arid, timeout, verbose);
  } finally {
    await store.destroy();
  }
}

/**
 * Get envelope from Hubert server.
 *
 * Port of `get_server()` from bin/hubert.rs lines 346-361.
 */
async function getServer(
  host: string,
  port: number,
  arid: ARID,
  timeout: number,
  verbose: boolean,
): Promise<Envelope | null> {
  const url = `http://${host}:${port}`;
  const store = new ServerKvClient(url);
  return await store.get(arid, timeout, verbose);
}

// =============================================================================
// CLI Setup
// =============================================================================

const program = new Command();

program
  .name("hubert")
  .description("Distributed substrate for multiparty transactions")
  .version("1.0.0-alpha.1")
  .option("-v, --verbose", "Enable verbose logging", false);

// Generate command
const generateCmd = program
  .command("generate")
  .description("Generate a new ARID or example Envelope");

generateCmd
  .command("arid")
  .description("Generate a new ARID")
  .action(() => {
    const arid = ARID.new();
    console.log(arid.urString());
  });

generateCmd
  .command("envelope <size>")
  .description("Generate a test envelope with random data")
  .action((sizeStr: string) => {
    const size = parseInt(sizeStr, 10);
    if (isNaN(size) || size < 0) {
      console.error("Size must be a positive integer");
      process.exit(1);
    }
    const envelope = generateRandomEnvelope(size);
    console.log(envelope.urString());
  });

// Put command
program
  .command("put <arid> <envelope>")
  .description("Store an envelope at an ARID")
  .option("-s, --storage <backend>", "Storage backend to use", "mainline")
  .option("--host <host>", "Server host (for --storage server)")
  .option("--port <port>", "Port (for --storage server/ipfs/hybrid)")
  .option("--ttl <seconds>", "Time-to-live in seconds (for --storage server)")
  .option("--pin", "Pin content in IPFS (only for --storage ipfs or --storage hybrid)", false)
  .action(
    async (
      aridStr: string,
      envelopeStr: string,
      options: {
        storage: StorageBackend;
        host?: string;
        port?: string;
        ttl?: string;
        pin: boolean;
      },
    ) => {
      const verbose = program.opts()["verbose"] as boolean;
      const storage = options.storage;
      const port = options.port ? parseInt(options.port, 10) : undefined;
      const ttl = options.ttl ? parseInt(options.ttl, 10) : undefined;

      try {
        // Validate options based on storage backend
        if (storage === "mainline") {
          if (port !== undefined) {
            throw new Error("--port option is not supported for --storage mainline");
          }
          if (options.host !== undefined) {
            throw new Error("--host option is not supported for --storage mainline");
          }
          if (ttl !== undefined) {
            throw new Error("--ttl option is only supported for --storage server");
          }
          if (options.pin) {
            throw new Error(
              "--pin option is only supported for --storage ipfs or --storage hybrid",
            );
          }
        } else if (storage === "ipfs") {
          if (options.host !== undefined) {
            throw new Error(
              "--host option is not supported for --storage ipfs (always uses 127.0.0.1)",
            );
          }
          if (ttl !== undefined) {
            throw new Error("--ttl option is only supported for --storage server");
          }
        } else if (storage === "hybrid") {
          if (options.host !== undefined) {
            throw new Error(
              "--host option is not supported for --storage hybrid (always uses 127.0.0.1)",
            );
          }
          if (ttl !== undefined) {
            throw new Error("--ttl option is only supported for --storage server");
          }
        } else if (storage === "server") {
          if (options.pin) {
            throw new Error(
              "--pin option is only supported for --storage ipfs or --storage hybrid",
            );
          }
        }

        const arid = parseArid(aridStr);
        const envelope = parseEnvelope(envelopeStr);

        switch (storage) {
          case "mainline":
            await putMainline(arid, envelope, verbose);
            console.log("Stored in Mainline DHT");
            break;
          case "ipfs":
            await putIpfs(arid, envelope, port ?? 5001, options.pin, verbose);
            console.log("Stored in IPFS");
            break;
          case "hybrid":
            await putHybrid(arid, envelope, port ?? 5001, options.pin, verbose);
            console.log("Stored in Hybrid storage");
            break;
          case "server": {
            const host = options.host ?? "127.0.0.1";
            await putServer(host, port ?? 45678, arid, envelope, ttl, verbose);
            console.log("Stored in server");
            break;
          }
        }
      } catch (e) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
      }
    },
  );

// Get command
program
  .command("get <arid>")
  .description("Retrieve an envelope by ARID")
  .option("-s, --storage <backend>", "Storage backend to use", "mainline")
  .option("--host <host>", "Server host (for --storage server)")
  .option("--port <port>", "Port (for --storage server/ipfs/hybrid)")
  .option("-t, --timeout <seconds>", "Maximum time to wait in seconds", "30")
  .action(
    async (
      aridStr: string,
      options: {
        storage: StorageBackend;
        host?: string;
        port?: string;
        timeout: string;
      },
    ) => {
      const verbose = program.opts()["verbose"] as boolean;
      const storage = options.storage;
      const port = options.port ? parseInt(options.port, 10) : undefined;
      const timeout = parseInt(options.timeout, 10);

      try {
        // Validate options based on storage backend
        if (storage === "mainline") {
          if (port !== undefined) {
            throw new Error("--port option is not supported for --storage mainline");
          }
          if (options.host !== undefined) {
            throw new Error("--host option is not supported for --storage mainline");
          }
        } else if (storage === "ipfs") {
          if (options.host !== undefined) {
            throw new Error(
              "--host option is not supported for --storage ipfs (always uses 127.0.0.1)",
            );
          }
        } else if (storage === "hybrid") {
          if (options.host !== undefined) {
            throw new Error(
              "--host option is not supported for --storage hybrid (always uses 127.0.0.1)",
            );
          }
        }

        const arid = parseArid(aridStr);

        let envelope: Envelope | null;
        switch (storage) {
          case "mainline":
            envelope = await getMainline(arid, timeout, verbose);
            break;
          case "ipfs":
            envelope = await getIpfs(arid, timeout, port ?? 5001, verbose);
            break;
          case "hybrid":
            envelope = await getHybrid(arid, timeout, port ?? 5001, verbose);
            break;
          case "server": {
            const host = options.host ?? "127.0.0.1";
            envelope = await getServer(host, port ?? 45678, arid, timeout, verbose);
            break;
          }
        }

        if (envelope) {
          console.log(envelope.urString());
        } else {
          throw new Error(`Value not found within ${timeout} seconds`);
        }
      } catch (e) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
      }
    },
  );

// Check command
program
  .command("check")
  .description("Check if storage backend is available")
  .option("-s, --storage <backend>", "Storage backend to use", "mainline")
  .option("--host <host>", "Server host (for --storage server)")
  .option("--port <port>", "Port (for --storage server/ipfs/hybrid)")
  .action(async (options: { storage: StorageBackend; host?: string; port?: string }) => {
    const storage = options.storage;
    const port = options.port ? parseInt(options.port, 10) : undefined;

    try {
      // Validate options based on storage backend
      if (storage === "mainline") {
        if (port !== undefined) {
          throw new Error("--port option is not supported for --storage mainline");
        }
        if (options.host !== undefined) {
          throw new Error("--host option is not supported for --storage mainline");
        }
      } else if (storage === "ipfs") {
        if (options.host !== undefined) {
          throw new Error(
            "--host option is not supported for --storage ipfs (always uses 127.0.0.1)",
          );
        }
      } else if (storage === "hybrid") {
        if (options.host !== undefined) {
          throw new Error(
            "--host option is not supported for --storage hybrid (always uses 127.0.0.1)",
          );
        }
      }

      switch (storage) {
        case "mainline":
          await checkMainline();
          break;
        case "ipfs":
          await checkIpfs(port ?? 5001);
          break;
        case "hybrid":
          await checkMainline();
          await checkIpfs(port ?? 5001);
          console.log("✓ Hybrid storage is available (DHT + IPFS)");
          break;
        case "server": {
          const host = options.host ?? "127.0.0.1";
          await checkServer(host, port ?? 45678);
          break;
        }
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  });

// Server command
program
  .command("server")
  .description("Start the Hubert HTTP server")
  .option("--port <port>", "Port for the server to listen on", "45678")
  .option("--sqlite <path>", "SQLite database file path for persistent storage")
  .action(async (options: { port: string; sqlite?: string }) => {
    const verbose = program.opts()["verbose"] as boolean;
    const port = parseInt(options.port, 10);

    try {
      const config: ServerConfig = {
        port,
        maxTtl: 86400, // 24 hours
        verbose,
      };

      if (options.sqlite) {
        // Use SQLite storage
        let sqlitePath = options.sqlite;
        // Check if it's a directory
        const fs = await import("fs");
        try {
          const stats = fs.statSync(sqlitePath);
          if (stats.isDirectory()) {
            sqlitePath = path.join(sqlitePath, "hubert.sqlite");
          }
        } catch {
          // Path doesn't exist, treat as file path
        }

        const store = new SqliteKv(sqlitePath);
        const server = Server.newSqlite(config, store);
        console.log(`Starting Hubert server on port ${port} with SQLite storage: ${sqlitePath}`);
        await server.run();
      } else {
        // Use in-memory storage
        const server = Server.newMemory(config);
        console.log(`Starting Hubert server on port ${port} with in-memory storage`);
        await server.run();
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  });

// Parse and run
program.parse();
