/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Walk decrypt command - 1:1 port of cmd/walk/decrypt.rs
 *
 * Decrypt nodes using provided keys.
 *
 * NOTE: Walk decrypt is not yet implemented in the TypeScript version.
 */

import type { Envelope } from "@bcts/envelope";

/**
 * Command arguments for the decrypt command.
 */
export interface CommandArgs {
  /** Symmetric keys to use for decryption (UR crypto-keys) */
  keys: string[];
}

/**
 * Execute decrypt with envelope.
 */
export function execWithEnvelope(_args: CommandArgs, _envelope: Envelope): string {
  // walkDecrypt is not yet implemented in @bcts/envelope
  // The Rust version walks the tree and decrypts all encrypted nodes
  throw new Error(
    "Walk decrypt is not yet implemented in the TypeScript CLI. " +
      "Use the 'decrypt' command for single envelope decryption.",
  );
}
