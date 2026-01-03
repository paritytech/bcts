/**
 * Digest command - 1:1 port of cmd/digest.rs
 *
 * Print the envelope's digest.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import type { Digest } from "@bcts/components";

/**
 * Depth options for digest extraction.
 */
export enum Depth {
  /** Return just the envelope's top digest */
  Top = "top",
  /** Return the digests necessary to reveal the subject */
  Shallow = "shallow",
  /** Return the digests needed to reveal the entire contents of the envelope */
  Deep = "deep",
}

/**
 * Command arguments for the digest command.
 */
export interface CommandArgs {
  /** Depth of digest extraction */
  depth: Depth;
  /** Output as hex instead of UR */
  hex: boolean;
  /** The envelope to get digest from */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    depth: Depth.Top,
    hex: false,
  };
}

/**
 * Digest command implementation.
 */
export class DigestCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    let digests: Set<string>;

    switch (this.args.depth) {
      case Depth.Top: {
        const digest = envelope.digest();
        digests = new Set([digest.urString()]);
        break;
      }
      case Depth.Shallow: {
        const shallowDigests = envelope.shallowDigests();
        digests = new Set(
          Array.from(shallowDigests).map((d: Digest) => (this.args.hex ? d.hex() : d.urString())),
        );
        break;
      }
      case Depth.Deep: {
        const deepDigests = envelope.deepDigests();
        digests = new Set(
          Array.from(deepDigests).map((d: Digest) => (this.args.hex ? d.hex() : d.urString())),
        );
        break;
      }
    }

    // Sort and join with spaces
    const ordered = Array.from(digests).sort();
    return ordered.join(" ");
  }
}

/**
 * Execute the digest command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new DigestCommand(args).exec();
}
