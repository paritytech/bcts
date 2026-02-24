/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID new command - 1:1 port of cmd/xid/new.rs
 *
 * Create a new XID document from an inception key.
 */

import { Envelope } from "@bcts/envelope";
import { CborDate } from "@bcts/dcbor";
import { XIDDocument, type XIDInceptionKeyOptions, type XIDGenesisMarkOptions } from "@bcts/xid";
import { randomData } from "@bcts/rand";
import type { ExecAsync } from "../../exec.js";
import { GeneratorOptions } from "./generator-options.js";
import type { KeyArgsLike } from "./key-args.js";
import { defaultKeyArgs, readKeyFromArgs } from "./key-args.js";
import type { OutputOptions } from "./output-options.js";
import { defaultOutputOptions, needsEncryption } from "./output-options.js";
import type { ReadWritePasswordArgs } from "./password-args.js";
import { PasswordMethod, readEncryptPassword } from "./password-args.js";
import type { SigningArgs } from "./signing-args.js";
import { SigningOption, signingOptions } from "./signing-args.js";
import { updateKey, xidDocumentToUrString, type InputKey } from "./xid-utils.js";

// Re-export for backward compatibility
export { GeneratorOptions } from "./generator-options.js";
export { PrivateOptions } from "./private-options.js";
export { PasswordMethod } from "./password-args.js";
export { SigningOption } from "./signing-args.js";

/**
 * Command arguments for the new command.
 */
export interface CommandArgs {
  /** Key arguments (nickname, endpoints, permissions, key input) */
  keyArgs: KeyArgsLike;
  /** Generator options for provenance mark */
  generatorOpts: GeneratorOptions;
  /** Date for genesis mark */
  date?: string;
  /** Additional info UR for genesis mark */
  info?: string;
  /** UR tag for info */
  urTag?: number;
  /** Output options (private/generator display) */
  outputOpts: OutputOptions;
  /** Password arguments */
  passwordArgs: ReadWritePasswordArgs;
  /** Signing arguments */
  signingArgs: SigningArgs;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    keyArgs: defaultKeyArgs(),
    generatorOpts: GeneratorOptions.Omit,
    outputOpts: defaultOutputOptions(),
    passwordArgs: {
      read: { askpass: false },
      write: {
        encryptAskpass: false,
        encryptMethod: PasswordMethod.Argon2id,
      },
    },
    signingArgs: { sign: SigningOption.None },
  };
}

/**
 * Convert an InputKey to XIDInceptionKeyOptions.
 */
function toInceptionKeyOptions(inputKey: InputKey): XIDInceptionKeyOptions {
  switch (inputKey.type) {
    case "PrivateBase":
      return { type: "privateKeyBase", privateKeyBase: inputKey.privateKeyBase };
    case "Public":
      return { type: "publicKeys", publicKeys: inputKey.publicKeys };
    case "PrivateKeys":
      return {
        type: "privateKeys",
        privateKeys: inputKey.privateKeys,
        publicKeys: inputKey.privateKeys.publicKeys(),
      };
    case "PrivateAndPublicKeys":
      return {
        type: "privateKeys",
        privateKeys: inputKey.privateKeys,
        publicKeys: inputKey.publicKeys,
      };
  }
}

/**
 * New command implementation.
 */
export class NewCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const inputKey = readKeyFromArgs(this.args.keyArgs);

    // Read shared encryption password if needed
    let sharedPassword: string | undefined;
    if (needsEncryption(this.args.outputOpts)) {
      sharedPassword = await readEncryptPassword(
        this.args.passwordArgs.write,
        "Encryption password:",
      );
    }

    // Build genesis mark options
    let markOptions: XIDGenesisMarkOptions;
    switch (this.args.generatorOpts) {
      case GeneratorOptions.Omit:
        markOptions = { type: "none" };
        break;
      case GeneratorOptions.Include:
      case GeneratorOptions.Encrypt: {
        const date =
          this.args.date !== undefined ? CborDate.fromString(this.args.date).datetime() : undefined;

        const info =
          this.args.info !== undefined
            ? Envelope.fromUrString(this.args.info).untaggedCbor()
            : undefined;

        // Generate random seed
        const seed = randomData(32);

        const seedOpts: XIDGenesisMarkOptions = { type: "seed", seed };
        if (date !== undefined) {
          (seedOpts as { date?: Date }).date = date;
        }
        if (info !== undefined) {
          (seedOpts as { info?: unknown }).info = info;
        }
        markOptions = seedOpts;
        break;
      }
      case GeneratorOptions.Elide:
        throw new Error("Cannot elide generator when creating a new XID document");
    }

    // Create XID document with inception key
    const keyOptions = toInceptionKeyOptions(inputKey);
    const xidDocument = XIDDocument.new(keyOptions, markOptions);

    // Update inception key metadata
    const keys = xidDocument.keys();
    if (keys.length > 0) {
      const key = keys[0];
      updateKey(
        key,
        this.args.keyArgs.nickname,
        this.args.keyArgs.endpoints.map((e) => (typeof e === "string" ? e : e.toString())),
        this.args.keyArgs.permissions,
      );
    }

    // Build signing options
    const signing = await signingOptions(this.args.signingArgs, this.args.passwordArgs.read);

    return xidDocumentToUrString(
      xidDocument,
      this.args.outputOpts,
      this.args.passwordArgs.write,
      sharedPassword,
      signing,
    );
  }
}

/**
 * Execute the new command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new NewCommand(args).exec();
}
