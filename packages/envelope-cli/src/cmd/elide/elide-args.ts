/**
 * Elide arguments module - 1:1 port of cmd/elide/elide_args.rs
 *
 * Common arguments and logic for elide commands.
 */

import { Envelope, type ObscureAction } from "@bcts/envelope";
import { SymmetricKey, type Digest } from "@bcts/components";
import { parseDigests } from "../../utils.js";

/**
 * The action to take on the elements.
 */
export enum Action {
  /** Elide the selected elements */
  Elide = "elide",
  /** Encrypt the selected elements using the given key */
  Encrypt = "encrypt",
  /** Compress the selected elements */
  Compress = "compress",
}

/**
 * Interface for elide arguments.
 */
export interface ElideArgsLike {
  /** The action to take */
  action: Action;
  /** The encryption key (ur:crypto-key) when action is encrypt */
  key?: string;
  /** The target set of digests */
  target: string;
}

/**
 * Get the target set of digests from the target string.
 */
export function getTargetSet(args: ElideArgsLike): Set<Digest> {
  return parseDigests(args.target);
}

/**
 * Get the ObscureAction from the args.
 */
export function getAction(args: ElideArgsLike): ObscureAction {
  switch (args.action) {
    case Action.Elide:
      return { type: "elide" };
    case Action.Encrypt: {
      if (!args.key) {
        throw new Error("No key provided");
      }
      const key = SymmetricKey.fromURString(args.key);
      return { type: "encrypt", key };
    }
    case Action.Compress:
      return { type: "compress" };
  }
}

/**
 * Run elide operation on an envelope.
 */
export function runElide(
  args: ElideArgsLike,
  envelope: Envelope,
  revealing: boolean
): Envelope {
  const target = getTargetSet(args);
  const action = getAction(args);
  return envelope.elideSetWithAction(target, revealing, action);
}

/**
 * Default elide arguments.
 */
export function defaultElideArgs(): Partial<ElideArgsLike> {
  return {
    action: Action.Elide,
  };
}
