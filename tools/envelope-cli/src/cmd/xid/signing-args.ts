/**
 * Signing arguments - 1:1 port of cmd/xid/signing_args.rs
 */

import { PrivateKeys, SigningPrivateKey } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import type { XIDSigningOptions } from "@bcts/xid";
import type { ReadPasswordArgs } from "./password-args.js";
import { readPassword } from "../../utils.js";

/**
 * Signing option for XID operations.
 */
export enum SigningOption {
  /** Do not sign the envelope (default). */
  None = "none",
  /** Sign with the XID's inception key (must be available as a signing key). */
  Inception = "inception",
}

/**
 * Signing arguments interface.
 */
export interface SigningArgs {
  /** Signing option. */
  sign: SigningOption;
  /**
   * The signing key UR (ur:crypto-prvkeys or ur:signing-private-key).
   * Can be encrypted (ur:envelope). If encrypted, will use the same
   * password as the XID document.
   */
  signingKey?: string;
}

/**
 * Default signing args.
 */
export function defaultSigningArgs(): SigningArgs {
  return { sign: SigningOption.None };
}

/**
 * Get the XIDSigningOptions from signing args.
 *
 * Handles:
 * - PrivateKeys UR (ur:crypto-prvkeys)
 * - SigningPrivateKey UR (ur:signing-private-key)
 * - Encrypted ur:envelope (decrypt + extract)
 */
export async function signingOptions(
  args: SigningArgs,
  passwordArgs?: ReadPasswordArgs,
): Promise<XIDSigningOptions> {
  // If a signing key is provided, use it
  if (args.signingKey !== undefined) {
    const key = args.signingKey;

    // Try to parse as PrivateKeys first
    try {
      const privateKeys = PrivateKeys.fromURString(key);
      return { type: "privateKeys", privateKeys };
    } catch {
      // Not PrivateKeys
    }

    // Try to parse as SigningPrivateKey
    try {
      const signingPrivateKey = SigningPrivateKey.fromURString(key);
      return { type: "signingPrivateKey", signingPrivateKey };
    } catch {
      // Not SigningPrivateKey
    }

    // If the key string looks like it might be encrypted, try to
    // decrypt it using the same password as the XID document
    if (key.startsWith("ur:envelope")) {
      const envelope = Envelope.fromUrString(key);

      // Use the same password that unlocks the XID document
      let password: string;
      if (passwordArgs !== undefined) {
        password = await readPassword(
          "Password:",
          passwordArgs.password,
          passwordArgs.askpass,
        );
      } else {
        throw new Error("Encrypted signing key requires password (use --password)");
      }

      const decryptedEnvelope = envelope.unlockSubject(
        new TextEncoder().encode(password),
      );

      // Try to extract PrivateKeys from the decrypted subject
      try {
        const privateKeys = decryptedEnvelope.extractSubject(
          (cbor) => PrivateKeys.fromTaggedCbor(cbor),
        );
        return { type: "privateKeys", privateKeys };
      } catch {
        // Not PrivateKeys
      }

      // Try to extract SigningPrivateKey from the decrypted subject
      try {
        const signingPrivateKey = decryptedEnvelope.extractSubject(
          (cbor) => SigningPrivateKey.fromTaggedCbor(cbor),
        );
        return { type: "signingPrivateKey", signingPrivateKey };
      } catch {
        // Not SigningPrivateKey
      }

      throw new Error("Decrypted envelope does not contain valid signing keys");
    }

    throw new Error(
      "Invalid signing key. Expected ur:crypto-prvkeys, ur:signing-private-key, or ur:envelope (encrypted keys)",
    );
  }

  // Otherwise, use the sign option
  switch (args.sign) {
    case SigningOption.None:
      return { type: "none" };
    case SigningOption.Inception:
      return { type: "inception" };
  }
}
