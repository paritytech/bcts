/**
 * Walk matching command - 1:1 port of cmd/walk/matching.rs
 *
 * Find nodes matching obscuration types.
 */

import type { Envelope, ObscureType } from "@bcts/envelope";
import type { Digest } from "@bcts/components";
import { outputDigests } from "./index.js";

/**
 * Command arguments for the matching command.
 */
export interface CommandArgs {
  /** Match elided nodes */
  elided: boolean;
  /** Match encrypted nodes */
  encrypted: boolean;
  /** Match compressed nodes */
  compressed: boolean;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    elided: false,
    encrypted: false,
    compressed: false,
  };
}

/**
 * Execute matching with envelope and target.
 */
export function execWithEnvelopeAndTarget(
  args: CommandArgs,
  envelope: Envelope,
  target: Set<Digest> | undefined
): string {
  const obscureTypes: ObscureType[] = [];

  if (args.elided) {
    obscureTypes.push("elided");
  }
  if (args.encrypted) {
    obscureTypes.push("encrypted");
  }
  if (args.compressed) {
    obscureTypes.push("compressed");
  }

  const digests = envelope.nodesMatching(target, obscureTypes);
  return outputDigests(digests);
}
