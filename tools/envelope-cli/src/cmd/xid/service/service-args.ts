/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Service arguments - 1:1 port of cmd/xid/service/service_args.rs
 *
 * Arguments for service operations.
 */

import type { XIDPrivilege } from "../xid-privilege.js";

/**
 * Service arguments interface.
 */
export interface ServiceArgsLike {
  /** Service name */
  name?: string;
  /** Capability identifier */
  capability?: string;
  /** Key references (public keys URs) */
  keys: string[];
  /** Delegate references (XID document URs) */
  delegates: string[];
  /** Permissions to grant */
  permissions: XIDPrivilege[];
  /** Service URI */
  uri?: string;
}

/**
 * Default service args.
 */
export function defaultServiceArgs(): ServiceArgsLike {
  return {
    keys: [],
    delegates: [],
    permissions: [],
  };
}
