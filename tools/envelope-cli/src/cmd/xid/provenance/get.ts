/**
 * XID provenance get command - 1:1 port of cmd/xid/provenance/get.rs
 *
 * Extract the provenance mark from an XID document.
 */

import type { ExecAsync } from "../../../exec.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readXidDocumentWithPassword } from "../xid-utils.js";

/**
 * Command arguments for the provenance get command.
 */
export interface CommandArgs {
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Provenance get command implementation.
 */
export class ProvenanceGetCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    const provenanceMark = xidDocument.provenance();
    if (provenanceMark === undefined) {
      return "";
    }
    return provenanceMark.urString();
  }
}

/**
 * Execute the provenance get command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ProvenanceGetCommand(args).exec();
}
