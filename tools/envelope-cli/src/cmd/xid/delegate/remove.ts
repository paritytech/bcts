/**
 * XID delegate remove command - 1:1 port of cmd/xid/delegate/remove.rs
 *
 * Remove the given delegate from the XID document.
 */

import { XIDDocument } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { OutputOptions } from "../output-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the delegate remove command.
 */
export interface CommandArgs {
  delegate: string;
  outputOpts: OutputOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Delegate remove command implementation.
 */
export class DelegateRemoveCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    // Parse delegate as XID document or bare XID
    const delegateEnvelope = readEnvelope(this.args.delegate);
    const delegateDoc = XIDDocument.fromEnvelope(delegateEnvelope);
    const xid = delegateDoc.xid();

    xidDocument.removeDelegate(xid);

    const signing = await signingOptions(
      this.args.signingArgs,
      this.args.passwordArgs.read,
    );

    return xidDocumentToUrString(
      xidDocument,
      this.args.outputOpts,
      this.args.passwordArgs.write,
      undefined,
      signing,
    );
  }
}

/**
 * Execute the delegate remove command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new DelegateRemoveCommand(args).exec();
}
