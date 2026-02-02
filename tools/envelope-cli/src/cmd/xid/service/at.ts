/**
 * XID service at command - 1:1 port of cmd/xid/service/at.rs
 *
 * Retrieve the service at the given index.
 */

import { SERVICE } from "@bcts/known-values";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";

/**
 * Command arguments for the service at command.
 */
export interface CommandArgs {
  index: number;
  envelope?: string;
}

/**
 * Service at command implementation.
 */
export class ServiceAtCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.None); // Validation only
    const serviceAssertions = envelope.assertionsWithPredicate(SERVICE);
    if (this.args.index >= serviceAssertions.length) {
      throw new Error("Index out of bounds");
    }
    return serviceAssertions[this.args.index].object().urString();
  }
}

/**
 * Execute the service at command.
 */
export function exec(args: CommandArgs): string {
  return new ServiceAtCommand(args).exec();
}
