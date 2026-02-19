/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * IPFS helper functions for content operations.
 *
 * Port of ipfs/value.rs from hubert-rust.
 *
 * @module
 */

import type { KuboRPCClient } from "kubo-rpc-client";

import { IpfsDaemonError } from "./error.js";

/**
 * Add (upload) bytes to IPFS and return the CID.
 *
 * Port of `add_bytes()` from ipfs/value.rs lines 9-15.
 *
 * @param client - Kubo RPC client
 * @param bytes - Data to add
 * @returns CID of the added content
 *
 * @category IPFS
 */
export async function addBytes(client: KuboRPCClient, bytes: Uint8Array): Promise<string> {
  try {
    const addResult = await client.add(bytes);
    return addResult.cid.toString();
  } catch (error) {
    throw new IpfsDaemonError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Cat (download) bytes from IPFS by CID.
 *
 * Port of `cat_bytes()` from ipfs/value.rs lines 18-28.
 *
 * @param client - Kubo RPC client
 * @param cid - Content identifier
 * @returns Content bytes
 *
 * @category IPFS
 */
export async function catBytes(client: KuboRPCClient, cid: string): Promise<Uint8Array> {
  try {
    const chunks: Uint8Array[] = [];
    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }
    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } catch (error) {
    throw new IpfsDaemonError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Pin a CID to ensure it persists in local IPFS storage.
 *
 * Port of `pin_cid()` from ipfs/value.rs lines 31-38.
 *
 * @param client - Kubo RPC client
 * @param cid - Content identifier to pin
 * @param recursive - Whether to recursively pin linked content
 *
 * @category IPFS
 */
export async function pinCid(
  client: KuboRPCClient,
  cid: string,
  recursive: boolean,
): Promise<void> {
  try {
    await client.pin.add(cid, { recursive });
  } catch (error) {
    throw new IpfsDaemonError(error instanceof Error ? error.message : String(error));
  }
}
