/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Storage client abstraction for Hubert.
 *
 * Port of cmd/storage.rs from frost-hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

/**
 * Storage backend selection.
 *
 * Port of `enum StorageSelection` from cmd/storage.rs.
 */
export type StorageSelection = "server" | "mainline" | "ipfs" | "hybrid";

/**
 * Storage client interface for Hubert operations.
 *
 * Port of `struct StorageClient` from cmd/storage.rs.
 */
export interface StorageClient {
  /**
   * Put an envelope at the given ARID.
   */
  put(arid: ARID, envelope: Envelope): Promise<void>;

  /**
   * Get an envelope from the given ARID.
   */
  get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined>;

  /**
   * Check if an envelope exists at the given ARID.
   */
  exists(arid: ARID): Promise<boolean>;
}

/**
 * Create a storage client based on the selection.
 *
 * Port of storage client creation from cmd/storage.rs.
 */
export async function createStorageClient(
  selection: StorageSelection,
  serverUrl?: string,
): Promise<StorageClient> {
  switch (selection) {
    case "server": {
      const { ServerKvClient } = await import("@bcts/hubert/server");
      const client = new ServerKvClient(serverUrl ?? "http://localhost:8080");
      return {
        async put(arid: ARID, envelope: Envelope): Promise<void> {
          await client.put(arid, envelope);
        },
        async get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined> {
          const result = await client.get(arid, timeoutSeconds);
          return result ?? undefined;
        },
        exists(arid: ARID): Promise<boolean> {
          return client.exists(arid);
        },
      };
    }
    case "mainline": {
      const { MainlineDhtKv } = await import("@bcts/hubert/mainline");
      const client = await MainlineDhtKv.create();
      return {
        async put(arid: ARID, envelope: Envelope): Promise<void> {
          await client.put(arid, envelope);
        },
        async get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined> {
          const result = await client.get(arid, timeoutSeconds);
          return result ?? undefined;
        },
        exists(arid: ARID): Promise<boolean> {
          return client.exists(arid);
        },
      };
    }
    case "ipfs": {
      const { IpfsKv } = await import("@bcts/hubert/ipfs");
      const client = new IpfsKv("http://127.0.0.1:5001");
      return {
        async put(arid: ARID, envelope: Envelope): Promise<void> {
          await client.put(arid, envelope);
        },
        async get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined> {
          const result = await client.get(arid, timeoutSeconds);
          return result ?? undefined;
        },
        exists(arid: ARID): Promise<boolean> {
          return client.exists(arid);
        },
      };
    }
    case "hybrid": {
      const { HybridKv } = await import("@bcts/hubert/hybrid");
      const client = await HybridKv.create("http://127.0.0.1:5001");
      return {
        async put(arid: ARID, envelope: Envelope): Promise<void> {
          await client.put(arid, envelope);
        },
        async get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined> {
          const result = await client.get(arid, timeoutSeconds);
          return result ?? undefined;
        },
        exists(arid: ARID): Promise<boolean> {
          return client.exists(arid);
        },
      };
    }
  }
}
