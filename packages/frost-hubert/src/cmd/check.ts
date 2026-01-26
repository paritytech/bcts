/**
 * Check command utilities.
 *
 * Port of cmd/check.rs from frost-hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";

import { type StorageClient } from "./storage.js";

/**
 * Check if an ARID exists in storage.
 *
 * Port of check functionality from cmd/check.rs.
 */
export async function checkAridExists(client: StorageClient, arid: ARID): Promise<boolean> {
  return client.exists(arid);
}
