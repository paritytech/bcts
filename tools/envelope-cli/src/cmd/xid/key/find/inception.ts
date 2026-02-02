/**
 * XID key find inception command - 1:1 port of cmd/xid/key/find/inception.rs
 *
 * Find the XID document's inception key, if it exists.
 */

import type { ExecAsync } from "../../../../exec.js";
import type { ReadPasswordArgs } from "../../password-args.js";
import type { VerifyArgs } from "../../verify-args.js";
import { verifySignature } from "../../verify-args.js";
import { getPrivateKeyUr, readXidDocument } from "../../xid-utils.js";

/**
 * Command arguments for the key find inception command.
 */
export interface CommandArgs {
  private: boolean;
  passwordArgs: ReadPasswordArgs;
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Key find inception command implementation.
 */
export class KeyFindInceptionCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const xidDocument = readXidDocument(this.args.envelope, verifySignature(this.args.verifyArgs));
    const inceptionKey = xidDocument.inceptionKey();
    if (inceptionKey === undefined) {
      return "";
    }
    if (this.args.private) {
      return getPrivateKeyUr(inceptionKey, this.args.passwordArgs);
    } else {
      return inceptionKey.intoEnvelope().urString();
    }
  }
}

/**
 * Execute the key find inception command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyFindInceptionCommand(args).exec();
}
