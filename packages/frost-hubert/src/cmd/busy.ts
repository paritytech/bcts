/**
 * Progress indicator utilities.
 *
 * Port of cmd/busy.rs from frost-hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { type StorageClient } from "./storage.js";

/**
 * Put an envelope to storage with a progress indicator.
 *
 * Port of `put_with_indicator()` from cmd/busy.rs.
 */
export async function putWithIndicator(
  client: StorageClient,
  arid: ARID,
  envelope: Envelope,
  message: string,
  verbose: boolean,
): Promise<void> {
  if (verbose) {
    console.log(`${message}...`);
  }

  await client.put(arid, envelope);

  if (verbose) {
    console.log(`${message}... done`);
  }
}

/**
 * Get an envelope from storage with a progress indicator.
 *
 * Port of `get_with_indicator()` from cmd/busy.rs.
 */
export async function getWithIndicator(
  client: StorageClient,
  arid: ARID,
  message: string,
  timeoutSeconds: number | undefined,
  verbose: boolean,
): Promise<Envelope | undefined> {
  if (verbose) {
    console.log(`${message}...`);
  }

  const envelope = await client.get(arid, timeoutSeconds);

  if (verbose) {
    if (envelope) {
      console.log(`${message}... found`);
    } else {
      console.log(`${message}... not found`);
    }
  }

  return envelope;
}
