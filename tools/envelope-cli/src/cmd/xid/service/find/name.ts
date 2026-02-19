/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID service find name command - 1:1 port of cmd/xid/service/find/name.rs
 *
 * Find services by their assigned name.
 */

import type { Exec } from "../../../../exec.js";
import { readXidDocument } from "../../xid-utils.js";

/**
 * Command arguments for the service find name command.
 */
export interface CommandArgs {
  name: string;
  envelope?: string;
}

/**
 * Service find name command implementation.
 */
export class ServiceFindNameCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const services = xidDocument.services();
    const found = services
      .filter((s) => s.name() === this.args.name)
      .map((s) => s.intoEnvelope().urString());
    return found.join("\n");
  }
}

/**
 * Execute the service find name command.
 */
export function exec(args: CommandArgs): string {
  return new ServiceFindNameCommand(args).exec();
}
