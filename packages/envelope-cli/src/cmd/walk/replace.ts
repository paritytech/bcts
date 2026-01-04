/**
 * Walk replace command - 1:1 port of cmd/walk/replace.rs
 *
 * Replace nodes matching target digests with a replacement envelope.
 */

import { Envelope } from "@bcts/envelope";
import type { Digest } from "@bcts/components";

/**
 * Command arguments for the replace command.
 */
export interface CommandArgs {
  /** Replacement envelope (UR format) */
  replacement: string;
}

/**
 * Execute replace with envelope and target.
 */
export function execWithEnvelopeAndTarget(
  args: CommandArgs,
  envelope: Envelope,
  targetDigests: Set<Digest> | undefined
): string {
  if (!targetDigests) {
    throw new Error(
      "walk replace requires --target digests to specify which nodes to replace"
    );
  }

  const replacement = Envelope.fromUrString(args.replacement);
  const result = envelope.walkReplace(targetDigests, replacement);
  return result.urString();
}
