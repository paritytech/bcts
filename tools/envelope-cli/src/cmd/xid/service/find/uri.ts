/**
 * XID service find uri command - 1:1 port of cmd/xid/service/find/uri.rs
 *
 * Find services by their URI.
 */

import type { Exec } from "../../../../exec.js";
import { readXidDocument } from "../../xid-utils.js";

/**
 * Command arguments for the service find uri command.
 */
export interface CommandArgs {
  uri: string;
  envelope?: string;
}

/**
 * Service find uri command implementation.
 */
export class ServiceFindUriCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const service = xidDocument.findServiceByUri(this.args.uri);
    if (service === undefined) {
      return "";
    }
    return service.intoEnvelope().urString();
  }
}

/**
 * Execute the service find uri command.
 */
export function exec(args: CommandArgs): string {
  return new ServiceFindUriCommand(args).exec();
}
