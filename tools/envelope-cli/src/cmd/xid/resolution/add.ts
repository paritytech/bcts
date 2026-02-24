/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID resolution add command - 1:1 port of cmd/xid/resolution/add.rs
 *
 * Add a resolution method (dereferenceVia) to the XID document.
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
 * Command arguments for the resolution add command.
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
 * Resolution add command implementation.
 */
export class ResolutionAddCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const uri = readUri(this.args.uri);
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    xidDocument.addResolutionMethod(uri.toString());

    const signing = await signingOptions(this.args.signingArgs, this.args.passwordArgs.read);

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
 * Execute the resolution add command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ResolutionAddCommand(args).exec();
}
