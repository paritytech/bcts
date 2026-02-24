/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID key update command - 1:1 port of cmd/xid/key/update.rs
 *
 * Updates the permissions, endpoints, or name of a key in a XID document.
 */

import type { ExecAsync } from "../../../exec.js";
import type { KeyArgsLike } from "../key-args.js";
import { readPublicKeyFromArgs } from "../key-args.js";
import type { GeneratorOptions } from "../generator-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { updateKey, readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the key update command.
 */
export interface CommandArgs {
  keyArgs: KeyArgsLike;
  generatorOpts: GeneratorOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Key update command implementation.
 */
export class KeyUpdateCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const publicKeys = readPublicKeyFromArgs(this.args.keyArgs);

    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    const existingKey = xidDocument.findKeyByPublicKeys(publicKeys);
    if (existingKey === undefined) {
      throw new Error("Key not found");
    }

    const key = existingKey.clone();
    xidDocument.takeKey(publicKeys);

    updateKey(
      key,
      this.args.keyArgs.nickname,
      this.args.keyArgs.endpoints.map((e) => e.toString()),
      this.args.keyArgs.permissions,
    );

    xidDocument.addKey(key);

    const signing = await signingOptions(this.args.signingArgs, this.args.passwordArgs.read);

    const outputOpts = {
      privateOpts: this.args.keyArgs.privateOpts,
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
 * Execute the key update command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyUpdateCommand(args).exec();
}
