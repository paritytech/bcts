/**
 * Private key output options - 1:1 port of cmd/xid/private_options.rs
 */

import { XIDPrivateKeyOptions, type XIDPrivateKeyOptionsValue } from "@bcts/xid";

/**
 * Options for how private keys are output in XID documents.
 */
export enum PrivateOptions {
  /** Include the private key in plaintext */
  Include = "include",
  /** Omit the private key */
  Omit = "omit",
  /** Elide the private key (maintains digest tree) */
  Elide = "elide",
  /** Encrypt the private key with a password */
  Encrypt = "encrypt",
}

/**
 * Check if this option requires encryption.
 */
export function isEncrypt(opts: PrivateOptions): boolean {
  return opts === PrivateOptions.Encrypt;
}

/**
 * Convert PrivateOptions to XIDPrivateKeyOptions.
 *
 * Note: The Encrypt variant needs additional parameters, so this returns
 * Omit as a placeholder. Callers should use the password_args module to
 * construct the full Encrypt variant.
 */
export function toXIDPrivateKeyOptions(opts: PrivateOptions): XIDPrivateKeyOptionsValue {
  switch (opts) {
    case PrivateOptions.Include:
      return XIDPrivateKeyOptions.Include;
    case PrivateOptions.Omit:
      return XIDPrivateKeyOptions.Omit;
    case PrivateOptions.Elide:
      return XIDPrivateKeyOptions.Elide;
    case PrivateOptions.Encrypt:
      // Placeholder — callers must construct the full Encrypt variant
      return XIDPrivateKeyOptions.Omit;
  }
}
