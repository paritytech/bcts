/**
 * SSKR split command - 1:1 port of cmd/sskr/split.rs
 *
 * Split an envelope into several shares using SSKR.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";
import { SymmetricKey, PublicKeys, SSKRGroupSpec, SSKRSpec } from "@bcts/components";
import { type Envelope, PublicKeyBase as EnvelopePublicKeyBase } from "@bcts/envelope";

// SSKR extension methods are added to Envelope.prototype at import time
// but the module augmentation uses relative paths that don't resolve across packages.
interface EnvelopeWithSskr extends Envelope {
  sskrSplit(spec: SSKRSpec, contentKey: SymmetricKey): Envelope[][];
}

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
 * Parse a group specification string like "2-of-3" into [threshold, total].
 */
function parseGroupSpec(spec: string): [number, number] {
  const match = /^(\d{1,2})-of-(\d{1,2})$/.exec(spec);
  if (!match) {
    throw new Error(`Invalid group specification: "${spec}". Expected format: "M-of-N"`);
  }
  const m = parseInt(match[1], 10);
  const n = parseInt(match[2], 10);
  return [m, n];
}

/**
 * Split command implementation.
 */
export class SplitCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    // Validate group threshold
    if (this.args.groupThreshold > this.args.groups.length) {
      throw new Error("Group threshold must be less than or equal to the number of groups");
    }

    // Parse group specifications
    const groups = this.args.groups.map(parseGroupSpec);

    // Get or create the content key
    const contentKey = this.args.key
      ? SymmetricKey.fromURString(this.args.key)
      : SymmetricKey.new();

    // Wrap and encrypt the envelope subject
    const wrapped = envelope.wrap();
    const encrypted = wrapped.encryptSubject(contentKey);

    // Create SSKRGroupSpec objects from parsed tuples
    const groupSpecs = groups.map(([m, n]) => SSKRGroupSpec.new(m, n));

    // Create SSKRSpec with group threshold and group specifications
    const spec = SSKRSpec.new(this.args.groupThreshold, groupSpecs);

    // Split: adds SSKR share assertions to the encrypted envelope
    const groupedShares = (encrypted as EnvelopeWithSskr).sskrSplit(spec, contentKey);

    // Flatten the grouped shares
    let flatShares: Envelope[] = groupedShares.flat();

    // If recipients are specified, encrypt each share to those recipients
    if (this.args.recipients.length > 0) {
      const recipients = this.args.recipients.map((r) => {
        const pk = PublicKeys.fromURString(r);
        const encKey = pk.encapsulationPublicKey();
        const publicData = encKey.x25519PublicKey().data();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
        return new (EnvelopePublicKeyBase as any)(publicData) as EnvelopePublicKeyBase;
      });
      flatShares = flatShares.map((share) => {
        let s = share;
        for (const recipient of recipients) {
          s = s.addRecipient(recipient, contentKey);
        }
        return s;
      });
    }

    // Convert each share envelope to UR string and join with spaces
    return flatShares.map((share) => share.urString()).join(" ");
  }
}

/**
 * Execute the split command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SplitCommand(args).exec();
}
