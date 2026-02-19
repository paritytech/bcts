/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Password arguments - 1:1 port of cmd/xid/password_args.rs
 */

import { KeyDerivationMethod } from "@bcts/components";
import { readPassword } from "../../utils.js";

/**
 * Password derivation method for encrypting/decrypting XID private keys.
 */
export enum PasswordMethod {
  /** Argon2id key derivation (recommended, default) */
  Argon2id = "argon2id",
  /** PBKDF2 key derivation */
  PBKDF2 = "pbkdf2",
  /** Scrypt key derivation */
  Scrypt = "scrypt",
}

/**
 * Convert PasswordMethod to KeyDerivationMethod.
 */
export function toKeyDerivationMethod(method: PasswordMethod): KeyDerivationMethod {
  switch (method) {
    case PasswordMethod.Argon2id:
      return KeyDerivationMethod.Argon2id;
    case PasswordMethod.PBKDF2:
      return KeyDerivationMethod.PBKDF2;
    case PasswordMethod.Scrypt:
      return KeyDerivationMethod.Scrypt;
  }
}

/**
 * Arguments for reading an encrypted XID document.
 *
 * Use this when a command needs to load an XID document that may have
 * encrypted private keys.
 */
export interface ReadPasswordArgs {
  /** The password to decrypt private keys (undefined = no password, empty string = prompt) */
  password?: string;
  /** Use SSH_ASKPASS environment variable to read the password */
  askpass: boolean;
}

/**
 * Default read password args.
 */
export function defaultReadPasswordArgs(): ReadPasswordArgs {
  return { askpass: false };
}

/**
 * Read the password from the arguments or prompt the user.
 *
 * Returns undefined if no password was specified (allowing the document
 * to be loaded without decrypting private keys).
 */
export async function readDecryptPassword(
  args: ReadPasswordArgs,
  prompt = "Decryption password:",
): Promise<string | undefined> {
  if (args.password !== undefined) {
    return readPassword(prompt, args.password || undefined, args.askpass);
  }
  return undefined;
}

/**
 * Check if password arguments were provided.
 */
export function hasReadPassword(args: ReadPasswordArgs): boolean {
  return args.password !== undefined;
}

/**
 * Arguments for writing an encrypted XID document.
 *
 * Use this when a command needs to save an XID document with encrypted
 * private keys.
 */
export interface WritePasswordArgs {
  /** The password to encrypt private keys */
  encryptPassword?: string;
  /** Use SSH_ASKPASS environment variable to read the encryption password */
  encryptAskpass: boolean;
  /** The key derivation method to use when encrypting private keys */
  encryptMethod: PasswordMethod;
}

/**
 * Default write password args.
 */
export function defaultWritePasswordArgs(): WritePasswordArgs {
  return {
    encryptAskpass: false,
    encryptMethod: PasswordMethod.Argon2id,
  };
}

/**
 * Read the encryption password from the arguments or prompt the user.
 */
export async function readEncryptPassword(
  args: WritePasswordArgs,
  prompt = "Encryption password:",
): Promise<string> {
  return readPassword(prompt, args.encryptPassword, args.encryptAskpass);
}

/**
 * Check if encryption password arguments were provided.
 */
export function hasWritePassword(args: WritePasswordArgs): boolean {
  return args.encryptPassword !== undefined;
}

/**
 * Get the key derivation method.
 */
export function writeMethod(args: WritePasswordArgs): KeyDerivationMethod {
  return toKeyDerivationMethod(args.encryptMethod);
}

/**
 * Combined arguments for reading and writing encrypted XID documents.
 *
 * Use this when a command needs to both load an encrypted document and save
 * it (potentially with different encryption).
 */
export interface ReadWritePasswordArgs {
  read: ReadPasswordArgs;
  write: WritePasswordArgs;
}

/**
 * Default read-write password args.
 */
export function defaultReadWritePasswordArgs(): ReadWritePasswordArgs {
  return {
    read: defaultReadPasswordArgs(),
    write: defaultWritePasswordArgs(),
  };
}
