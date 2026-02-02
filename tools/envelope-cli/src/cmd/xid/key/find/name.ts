/**
 * XID key find name command - 1:1 port of cmd/xid/key/find/name.rs
 *
 * Find the XID document's keys by assigned name.
 */

import type { ExecAsync } from "../../../../exec.js";
import type { ReadPasswordArgs } from "../../password-args.js";
import type { VerifyArgs } from "../../verify-args.js";
import { verifySignature } from "../../verify-args.js";
import { getPrivateKeyUr, readXidDocument } from "../../xid-utils.js";

/**
 * Command arguments for the key find name command.
 */
export interface CommandArgs {
  name: string;
  private: boolean;
  passwordArgs: ReadPasswordArgs;
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Key find name command implementation.
 */
export class KeyFindNameCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const xidDocument = readXidDocument(this.args.envelope, verifySignature(this.args.verifyArgs));
    const keys = xidDocument.keys();

    if (this.args.private) {
      const results: string[] = [];
      for (const key of keys) {
        if (key.nickname() === this.args.name) {
          results.push(await getPrivateKeyUr(key, this.args.passwordArgs));
        }
      }
      return results.join("\n");
    } else {
      const results = keys
        .filter((key) => key.nickname() === this.args.name)
        .map((key) => key.intoEnvelope().urString());
      return results.join("\n");
    }
  }
}

/**
 * Execute the key find name command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyFindNameCommand(args).exec();
}
