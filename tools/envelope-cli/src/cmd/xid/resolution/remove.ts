/**
 * XID resolution remove command - 1:1 port of cmd/xid/resolution/remove.rs
 *
 * Remove a resolution method (dereferenceVia) from the XID document.
 */

import type { ExecAsync } from "../../../exec.js";
import type { OutputOptions } from "../output-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readUri, readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the resolution remove command.
 */
export interface CommandArgs {
  uri?: string;
  outputOpts: OutputOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Resolution remove command implementation.
 */
export class ResolutionRemoveCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const uri = readUri(this.args.uri);
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    if (!xidDocument.removeResolutionMethod(uri.toString())) {
      throw new Error(`Resolution method not found: ${uri.toString()}`);
    }

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
 * Execute the resolution remove command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ResolutionRemoveCommand(args).exec();
}
