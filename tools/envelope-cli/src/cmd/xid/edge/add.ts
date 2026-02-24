/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID edge add command - 1:1 port of cmd/xid/edge/add.rs
 *
 * Add an edge to the XID document.
 */

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
 * Command arguments for the edge add command.
 */
export interface CommandArgs {
  edge: string;
  outputOpts: OutputOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Edge add command implementation.
 */
export class EdgeAddCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    const edgeEnvelope = readEnvelope(this.args.edge);
    xidDocument.addEdge(edgeEnvelope);

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
 * Execute the edge add command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new EdgeAddCommand(args).exec();
}
