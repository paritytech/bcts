/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID service all command - 1:1 port of cmd/xid/service/all.rs
 *
 * Retrieve all the XID document's services.
 */

import { SERVICE } from "@bcts/known-values";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";

/**
 * Command arguments for the service all command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Service all command implementation.
 */
export class ServiceAllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.None); // Validation only
    const serviceAssertions = envelope.assertionsWithPredicate(SERVICE);
    const services = serviceAssertions.map((s) => s.object().urString());
    return services.join("\n");
  }
}

/**
 * Execute the service all command.
 */
export function exec(args: CommandArgs): string {
  return new ServiceAllCommand(args).exec();
}
