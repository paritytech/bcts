/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID service count command - 1:1 port of cmd/xid/service/count.rs
 *
 * Print the count of the XID document's services.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the service count command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Service count command implementation.
 */
export class ServiceCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    return xidDocument.services().length.toString();
  }
}

/**
 * Execute the service count command.
 */
export function exec(args: CommandArgs): string {
  return new ServiceCountCommand(args).exec();
}
