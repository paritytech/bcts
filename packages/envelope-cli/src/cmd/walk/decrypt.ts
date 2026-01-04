/**
 * Walk decrypt command - 1:1 port of cmd/walk/decrypt.rs
 *
 * Decrypt nodes using provided keys.
 */

import type { Envelope } from "@bcts/envelope";
import { SymmetricKey } from "@bcts/components";

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
export function execWithEnvelope(args: CommandArgs, envelope: Envelope): string {
  const symmetricKeys = args.keys.map((urString) =>
    SymmetricKey.fromUrString(urString)
  );
  const result = envelope.walkDecrypt(symmetricKeys);
  return result.urString();
}
