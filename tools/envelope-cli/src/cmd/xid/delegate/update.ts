/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID delegate update command - 1:1 port of cmd/xid/delegate/update.rs
 *
 * Update a delegate's permissions in a XID document.
 */

import { XIDDocument, Delegate } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { OutputOptions } from "../output-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { type XIDPrivilege, toPrivilege } from "../xid-privilege.js";
import { readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the delegate update command.
 */
export interface CommandArgs {
  delegate: string;
  allow: XIDPrivilege[];
  outputOpts: OutputOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Delegate update command implementation.
 */
export class DelegateUpdateCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    if (this.args.allow.length === 0) {
      throw new Error("At least one permission must be specified for a delegate");
    }

    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    const delegateEnvelope = readEnvelope(this.args.delegate);
    const delegateDoc = XIDDocument.fromEnvelope(delegateEnvelope);
    const xid = delegateDoc.xid();

    // Take the existing delegate
    const existing = xidDocument.takeDelegate(xid);
    if (existing === undefined) {
      throw new Error("Delegate not found");
    }

    // Create new delegate with updated permissions
    const newDelegate = Delegate.new(delegateDoc);
    for (const priv of this.args.allow) {
      const privilege = toPrivilege(priv);
      newDelegate.permissions().addAllow(privilege);
    }

    xidDocument.addDelegate(newDelegate);

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
 * Execute the delegate update command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new DelegateUpdateCommand(args).exec();
}
