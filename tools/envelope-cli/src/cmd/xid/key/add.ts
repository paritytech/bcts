/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID key add command - 1:1 port of cmd/xid/key/add.rs
 *
 * Add a key to the XID document.
 */

import { Key } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import type { KeyArgsLike } from "../key-args.js";
import { readKeyFromArgs } from "../key-args.js";
import type { GeneratorOptions } from "../generator-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { updateKey, readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the key add command.
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
 * Key add command implementation.
 */
export class KeyAddCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const inputKey = readKeyFromArgs(this.args.keyArgs);

    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    let key: Key;
    switch (inputKey.type) {
      case "PrivateBase":
        key = Key.newWithPrivateKeyBase(inputKey.privateKeyBase);
        break;
      case "Public":
        key = Key.new(inputKey.publicKeys);
        break;
      case "PrivateKeys": {
        const publicKeys = inputKey.privateKeys.publicKeys();
        key = Key.newWithPrivateKeys(inputKey.privateKeys, publicKeys);
        break;
      }
      case "PrivateAndPublicKeys":
        key = Key.newWithPrivateKeys(inputKey.privateKeys, inputKey.publicKeys);
        break;
    }

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
 * Execute the key add command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyAddCommand(args).exec();
}
