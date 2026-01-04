/**
 * XID new command - 1:1 port of cmd/xid/new.rs
 *
 * Create a new XID document from an inception key.
 */

import { XIDDocument, XIDInceptionKeyOptions } from "@bcts/xid";
import { PrivateKeyBase, PrivateKeys, PublicKeys } from "@bcts/components";
import type { Exec } from "../../exec.js";

/**
 * Generator options for provenance marks.
 */
export enum GeneratorOptions {
  /** No provenance mark */
  Omit = "omit",
  /** Include provenance mark generator */
  Include = "include",
  /** Encrypt provenance mark generator */
  Encrypt = "encrypt",
  /** Elide provenance mark generator */
  Elide = "elide",
}

/**
 * Private key options.
 */
export enum PrivateOptions {
  /** Omit private keys */
  Omit = "omit",
  /** Include private keys */
  Include = "include",
  /** Encrypt private keys */
  Encrypt = "encrypt",
}

/**
 * Command arguments for the new command.
 */
export interface CommandArgs {
  /** The inception key (ur:crypto-prvkeys, ur:crypto-pubkeys, or ur:prvkeys) */
  keys?: string;
  /** Nickname for the key */
  nickname: string;
  /** Private key options */
  privateOpts: PrivateOptions;
  /** Generator options */
  generatorOpts: GeneratorOptions;
  /** Endpoints for the key */
  endpoints: string[];
  /** Permissions for the key */
  permissions: string[];
  /** Password for encryption */
  password?: string;
  /** Date for genesis mark */
  date?: string;
  /** Additional info for genesis mark */
  info?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    nickname: "",
    privateOpts: PrivateOptions.Omit,
    generatorOpts: GeneratorOptions.Omit,
    endpoints: [],
    permissions: [],
  };
}

/**
 * New command implementation.
 */
export class NewCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    if (!this.args.keys) {
      throw new Error("Inception key is required");
    }

    // Try parsing as different key types
    let xidDocument: XIDDocument;

    try {
      const privateKeyBase = PrivateKeyBase.fromURString(this.args.keys);
      xidDocument = XIDDocument.new(XIDInceptionKeyOptions.privateKeyBase(privateKeyBase));
    } catch {
      try {
        const privateKeys = PrivateKeys.fromURString(this.args.keys);
        const publicKeys = privateKeys.publicKeys();
        xidDocument = XIDDocument.new(
          XIDInceptionKeyOptions.publicAndPrivateKeys(publicKeys, privateKeys),
        );
      } catch {
        try {
          const publicKeys = PublicKeys.fromURString(this.args.keys);
          xidDocument = XIDDocument.new(XIDInceptionKeyOptions.publicKeys(publicKeys));
        } catch {
          throw new Error("Invalid inception key format");
        }
      }
    }

    // Update key with nickname if provided
    if (this.args.nickname) {
      const keys = xidDocument.keys();
      if (keys.length > 0) {
        const key = keys[0];
        key.setNickname(this.args.nickname);
      }
    }

    return xidDocument.toEnvelope().urString();
  }
}

/**
 * Execute the new command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new NewCommand(args).exec();
}
