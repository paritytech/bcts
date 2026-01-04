/**
 * Walk module - 1:1 port of cmd/walk/mod.rs
 *
 * Walk an envelope's nodes.
 */

import type { Envelope } from "@bcts/envelope";
import { Digest } from "@bcts/components";
import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";
import * as decompressCmd from "./decompress.js";
import * as decryptCmd from "./decrypt.js";
import * as matchingCmd from "./matching.js";
import * as replaceCmd from "./replace.js";
import * as unelideCmd from "./unelide.js";

export * as decompress from "./decompress.js";
export * as decrypt from "./decrypt.js";
export * as matching from "./matching.js";
export * as replace from "./replace.js";
export * as unelide from "./unelide.js";

/**
 * Parse target digests from strings.
 */
export function parseTargetDigests(target: string[]): Set<Digest> | undefined {
  if (target.length === 0) {
    return undefined;
  }

  const digests = new Set<Digest>();
  for (const urString of target) {
    const digest = Digest.fromURString(urString);
    digests.add(digest);
  }
  return digests;
}

/**
 * Output digests as space-separated UR strings.
 */
export function outputDigests(digests: Set<Digest>): string {
  const orderedDigests = Array.from(digests).sort((a, b) =>
    a.urString().localeCompare(b.urString())
  );
  return orderedDigests.map((d) => d.urString()).join(" ");
}

/**
 * Walk subcommand types.
 */
export type WalkSubcommand =
  | { type: "matching"; args: matchingCmd.CommandArgs }
  | { type: "unelide"; args: unelideCmd.CommandArgs }
  | { type: "decrypt"; args: decryptCmd.CommandArgs }
  | { type: "decompress"; args: decompressCmd.CommandArgs }
  | { type: "replace"; args: replaceCmd.CommandArgs };

/**
 * Command arguments for the walk command.
 */
export interface CommandArgs {
  /** Optional target digests to filter nodes */
  target: string[];
  /** The envelope to walk */
  envelope?: string;
  /** The subcommand to execute */
  command?: WalkSubcommand;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    target: [],
  };
}

/**
 * Walk command implementation.
 */
export class WalkCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const target = parseTargetDigests(this.args.target);

    if (!this.args.command) {
      // Default: output all digests
      const digests = envelope.nodesMatching(target, []);
      return outputDigests(digests);
    }

    switch (this.args.command.type) {
      case "matching":
        return matchingCmd.execWithEnvelopeAndTarget(
          this.args.command.args,
          envelope,
          target
        );
      case "unelide":
        return unelideCmd.execWithEnvelope(this.args.command.args, envelope);
      case "decrypt":
        return decryptCmd.execWithEnvelope(this.args.command.args, envelope);
      case "decompress":
        return decompressCmd.execWithEnvelopeAndTarget(
          this.args.command.args,
          envelope,
          target
        );
      case "replace":
        return replaceCmd.execWithEnvelopeAndTarget(
          this.args.command.args,
          envelope,
          target
        );
    }
  }
}

/**
 * Execute the walk command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new WalkCommand(args).exec();
}
