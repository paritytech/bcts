/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID provenance get command - 1:1 port of cmd/xid/provenance/get.rs
 *
 * Extract the provenance mark from an XID document.
 */

import { PROVENANCE } from "@bcts/known-values";
import { ProvenanceMark } from "@bcts/provenance-mark";
import { XIDVerifySignature } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import {
  readXidDocumentWithPassword,
  xidDocumentEnvelope,
  xidFromDocumentEnvelope,
} from "../xid-utils.js";

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
    const verify = verifySignature(this.args.verifyArgs);
    // In no-verify mode, read the PROVENANCE assertion directly off the
    // envelope so the command works on enriched documents. This path does not
    // decrypt, so the read password is intentionally not used here.
    if (verify === XIDVerifySignature.None) {
      const envelope = readEnvelope(this.args.envelope);
      xidFromDocumentEnvelope(envelope);
      const inner = xidDocumentEnvelope(envelope);
      const assertion = inner.optionalAssertionWithPredicate(PROVENANCE);
      if (assertion === undefined) {
        return "";
      }
      return ProvenanceMark.fromEnvelope(assertion.tryObject()).urString();
    }

    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verify,
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
