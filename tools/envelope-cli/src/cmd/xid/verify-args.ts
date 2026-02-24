/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Verify arguments - 1:1 port of cmd/xid/verify_args.rs
 */

import { XIDVerifySignature } from "@bcts/xid";

/**
 * Signature verification option for XID operations.
 */
export enum VerifyOption {
  /** Do not verify the signature (default). */
  None = "none",
  /** Verify that the envelope is signed with the inception key. */
  Inception = "inception",
}

/**
 * Convert VerifyOption to XIDVerifySignature.
 */
export function toXIDVerifySignature(opt: VerifyOption): XIDVerifySignature {
  switch (opt) {
    case VerifyOption.None:
      return XIDVerifySignature.None;
    case VerifyOption.Inception:
      return XIDVerifySignature.Inception;
  }
}

/**
 * Verify arguments interface.
 */
export interface VerifyArgs {
  /** Signature verification option. */
  verify: VerifyOption;
}

/**
 * Default verify args.
 */
export function defaultVerifyArgs(): VerifyArgs {
  return { verify: VerifyOption.None };
}

/**
 * Get the XIDVerifySignature from verify args.
 */
export function verifySignature(args: VerifyArgs): XIDVerifySignature {
  return toXIDVerifySignature(args.verify);
}
