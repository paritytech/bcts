/**
 * SSKR split command - 1:1 port of cmd/sskr/split.rs
 *
 * Split an envelope into several shares using SSKR.
 */

import { Envelope } from "@bcts/envelope";
import { SymmetricKey, PublicKeys, SSKRSpec, SSKRGroupSpec } from "@bcts/components";
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
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.groupThreshold > this.args.groups.length) {
      throw new Error("Group threshold must be less than or equal to the number of groups");
    }

    const regex = /(\d{1,2})-of-(\d{1,2})/;
    const groups: Array<[number, number]> = this.args.groups.map((group) => {
      const matches = group.match(regex);
      if (!matches) {
        throw new Error(`Invalid group specifier: ${group}`);
      }
      const m = parseInt(matches[1], 10);
      const n = parseInt(matches[2], 10);
      return [m, n];
    });

    const contentKey = this.args.key
      ? SymmetricKey.fromURString(this.args.key)
      : SymmetricKey.new();

    const wrapped = envelope.wrap();
    const encrypted = wrapped.encryptSubject(contentKey);

    const groupSpecs = groups.map(([m, n]) => SSKRGroupSpec.new(m, n));
    const spec = SSKRSpec.new(this.args.groupThreshold, groupSpecs);
    const groupedShares = encrypted.sskrSplit(spec, contentKey);

    let flattenedShares = groupedShares.flat();

    if (this.args.recipients.length > 0) {
      const recipients = this.args.recipients.map((r) => PublicKeys.fromURString(r));
      flattenedShares = flattenedShares.map((share) => {
        let result = share;
        for (const recipient of recipients) {
          result = result.addRecipient(recipient, contentKey);
        }
        return result;
      });
    }

    return flattenedShares.map((share) => share.urString()).join(" ");
  }
}

/**
 * Execute the split command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SplitCommand(args).exec();
}
