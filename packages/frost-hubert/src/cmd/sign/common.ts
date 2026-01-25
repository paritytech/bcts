/**
 * Common utilities for sign commands.
 *
 * Port of cmd/sign/common.rs from frost-hubert-rust.
 *
 * @module
 */

import * as path from "node:path";

import { type Envelope } from "@bcts/envelope";

/**
 * Get the signing state directory for a given registry path, group ID, and session ID.
 *
 * Port of `signing_state_dir()` from cmd/sign/common.rs.
 */
export function signingStateDir(
  registryPath: string,
  groupIdHex: string,
  sessionIdHex: string,
): string {
  const base = path.dirname(registryPath);
  return path.join(base, "group-state", groupIdHex, "signing", sessionIdHex);
}

/**
 * Get the signing state directory for a group (without session).
 *
 * Port of `signing_state_dir_for_group()` from cmd/sign/common.rs.
 */
export function signingStateDirForGroup(registryPath: string, groupIdHex: string): string {
  const base = path.dirname(registryPath);
  return path.join(base, "group-state", groupIdHex, "signing");
}

/**
 * Content wrapper for sign finalize events.
 *
 * Port of `struct SignFinalizeContent` from cmd/sign/common.rs.
 */
export class SignFinalizeContent {
  private readonly _envelope: Envelope;

  constructor(envelope: Envelope) {
    this._envelope = envelope;
  }

  envelope(): Envelope {
    return this._envelope;
  }
}
