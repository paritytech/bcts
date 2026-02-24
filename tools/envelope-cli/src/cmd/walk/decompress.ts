/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Walk decompress command - 1:1 port of cmd/walk/decompress.rs
 *
 * Decompress nodes.
 *
 * NOTE: Walk decompress is not yet implemented in the TypeScript version.
 */

import type { Envelope } from "@bcts/envelope";
import type { Digest } from "@bcts/components";

/**
 * Command arguments for the decompress command.
 */
export type CommandArgs = Record<string, never>;

/**
 * Execute decompress with envelope and target.
 */
export function execWithEnvelopeAndTarget(
  _args: CommandArgs,
  _envelope: Envelope,
  _target: Set<Digest> | undefined,
): string {
  // walkDecompress is not yet implemented in @bcts/envelope
  // The Rust version walks the tree and decompresses all compressed nodes
  throw new Error(
    "Walk decompress is not yet implemented in the TypeScript CLI. " +
      "Use the 'decompress' command for single envelope decompression.",
  );
}
