/**
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
      const { ServerKv } = await import("@bcts/hubert/server");
      const client = await ServerKv.create(serverUrl ?? "http://localhost:8080");
      return {
        async put(arid: ARID, envelope: Envelope): Promise<void> {
          await client.put(arid, envelope);
        },
        async get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined> {
          return client.get(arid, timeoutSeconds);
        },
        async exists(arid: ARID): Promise<boolean> {
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
          return client.get(arid, timeoutSeconds);
        },
        async exists(arid: ARID): Promise<boolean> {
          return client.exists(arid);
        },
      };
    }
    case "ipfs": {
      const { IpfsKv } = await import("@bcts/hubert/ipfs");
      const client = await IpfsKv.create();
      return {
        async put(arid: ARID, envelope: Envelope): Promise<void> {
          await client.put(arid, envelope);
        },
        async get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined> {
          return client.get(arid, timeoutSeconds);
        },
        async exists(arid: ARID): Promise<boolean> {
          return client.exists(arid);
        },
      };
    }
    case "hybrid": {
      const { HybridKv } = await import("@bcts/hubert/hybrid");
      const client = await HybridKv.create();
      return {
        async put(arid: ARID, envelope: Envelope): Promise<void> {
          await client.put(arid, envelope);
        },
        async get(arid: ARID, timeoutSeconds?: number): Promise<Envelope | undefined> {
          return client.get(arid, timeoutSeconds);
        },
        async exists(arid: ARID): Promise<boolean> {
          return client.exists(arid);
        },
      };
    }
  }
}
