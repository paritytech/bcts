/**
 * XID key remove command - 1:1 port of cmd/xid/key/remove.rs
 *
 * Remove the given key from the XID document.
 */

import type { ExecAsync } from "../../../exec.js";
import type { GeneratorOptions } from "../generator-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import { PrivateOptions } from "../private-options.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readPublicKey, readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the key remove command.
 */
export interface CommandArgs {
  keys?: string;
  privateOpts: PrivateOptions;
  generatorOpts: GeneratorOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Key remove command implementation.
 */
export class KeyRemoveCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const publicKeys = readPublicKey(this.args.keys);
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    xidDocument.removeKey(publicKeys);

    const signing = await signingOptions(
      this.args.signingArgs,
      this.args.passwordArgs.read,
    );

    const outputOpts = {
      privateOpts: this.args.privateOpts,
      generatorOpts: this.args.generatorOpts,
    };

    return xidDocumentToUrString(
      xidDocument,
      outputOpts,
      this.args.passwordArgs.write,
      undefined,
      signing,
    );
  }
}

/**
 * Execute the key remove command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyRemoveCommand(args).exec();
}
