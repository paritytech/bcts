/**
 * SSKR split command - 1:1 port of cmd/sskr/split.rs
 *
 * Split an envelope into several shares using SSKR.
 *
 * NOTE: SSKR functionality is not yet implemented in the TypeScript version.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the split command.
 */
export interface CommandArgs {
  /** The number of groups that must meet their threshold (1-16) */
  groupThreshold: number;
  /** Group specifications (e.g., "2-of-3") */
  groups: string[];
  /** The symmetric key to use for encryption */
  key?: string;
  /** Public keys to also encrypt the message to */
  recipients: string[];
  /** The envelope to split */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    groupThreshold: 1,
    groups: ["1-of-1"],
    recipients: [],
  };
}

/**
 * Split command implementation.
 */
export class SplitCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    // Validate that an envelope was provided
    readEnvelope(this.args.envelope);

    // Validate group threshold
    if (this.args.groupThreshold > this.args.groups.length) {
      throw new Error("Group threshold must be less than or equal to the number of groups");
    }

    // SSKR is not yet implemented in @bcts/envelope
    // The Rust version uses Shamir's Secret Sharing for Key Recovery
    throw new Error(
      "SSKR split is not yet implemented in the TypeScript CLI. " +
        "This requires SSKR (Sharded Secret Key Reconstruction) support in @bcts/envelope.",
    );
  }
}

/**
 * Execute the split command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SplitCommand(args).exec();
}
