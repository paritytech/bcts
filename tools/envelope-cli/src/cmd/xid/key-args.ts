/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Key arguments - 1:1 port of cmd/xid/key_args.rs
 */

import type { PublicKeys, URI } from "@bcts/components";
import { PrivateOptions } from "./private-options.js";
import { type XIDPrivilege } from "./xid-privilege.js";
import { readKey, readPublicKey, type InputKey } from "./xid-utils.js";

/**
 * Trait for commands that accept key arguments.
 */
export interface KeyArgsLike {
  /** A user-assigned name for the key */
  nickname: string;
  /** Whether to include, omit, or elide private keys */
  privateOpts: PrivateOptions;
  /** Endpoint URIs for the key */
  endpoints: URI[];
  /** Permissions (privileges) to grant to the key */
  permissions: XIDPrivilege[];
  /** The key to process. If omitted, the key will be read from stdin. */
  keys?: string;
}

/**
 * Default key args.
 */
export function defaultKeyArgs(): KeyArgsLike {
  return {
    nickname: "",
    privateOpts: PrivateOptions.Include,
    endpoints: [],
    permissions: [],
  };
}

/**
 * Read the key from args or stdin.
 */
export function readKeyFromArgs(args: KeyArgsLike): InputKey {
  return readKey(args.keys);
}

/**
 * Read and validate as public key only.
 */
export function readPublicKeyFromArgs(args: KeyArgsLike): PublicKeys {
  return readPublicKey(args.keys);
}
