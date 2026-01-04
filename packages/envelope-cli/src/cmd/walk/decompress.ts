/**
 * Walk decompress command - 1:1 port of cmd/walk/decompress.rs
 *
 * Decompress nodes.
 */

import type { Envelope } from "@bcts/envelope";
import type { Digest } from "@bcts/components";

/**
 * Command arguments for the decompress command.
 */
export interface CommandArgs {}

/**
 * Execute decompress with envelope and target.
 */
export function execWithEnvelopeAndTarget(
  _args: CommandArgs,
  envelope: Envelope,
  target: Set<Digest> | undefined
): string {
  const result = envelope.walkDecompress(target);
  return result.urString();
}
