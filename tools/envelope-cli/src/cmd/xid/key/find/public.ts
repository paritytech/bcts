/**
 * XID key find public command - 1:1 port of cmd/xid/key/find/public.rs
 *
 * Find the XID document's keys by their public key.
 */

import type { ExecAsync } from "../../../../exec.js";
import type { ReadPasswordArgs } from "../../password-args.js";
import type { VerifyArgs } from "../../verify-args.js";
import { verifySignature } from "../../verify-args.js";
import { readPublicKey, getPrivateKeyUr, readXidDocument } from "../../xid-utils.js";

/**
 * Command arguments for the key find public command.
 */
export interface CommandArgs {
  keys?: string;
  private: boolean;
  passwordArgs: ReadPasswordArgs;
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Key find public command implementation.
 */
export class KeyFindPublicCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const publicKeys = readPublicKey(this.args.keys);
    const xidDocument = readXidDocument(
      this.args.envelope,
      verifySignature(this.args.verifyArgs),
    );
    const keys = xidDocument.keys();

    if (this.args.private) {
      const results: string[] = [];
      for (const key of keys) {
        if (key.publicKeys().equals(publicKeys)) {
          results.push(await getPrivateKeyUr(key, this.args.passwordArgs));
        }
      }
      return results.join("\n");
    } else {
      const results = keys
        .filter((key) => key.publicKeys().equals(publicKeys))
        .map((key) => key.intoEnvelope().urString());
      return results.join("\n");
    }
  }
}

/**
 * Execute the key find public command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyFindPublicCommand(args).exec();
}
