/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Walk unelide command - 1:1 port of cmd/walk/unelide.rs
 *
 * Unelide nodes using provided envelopes.
 */

import { Envelope } from "@bcts/envelope";

/**
 * Command arguments for the unelide command.
 */
export interface CommandArgs {
  /** Envelopes to use for uneliding (UR envelopes) */
  envelopes: string[];
}

/**
 * Execute unelide with envelope.
 */
export function execWithEnvelope(args: CommandArgs, envelope: Envelope): string {
  const unelideEnvelopes = args.envelopes.map((urString) => Envelope.fromUrString(urString));
  const result = envelope.walkUnelide(unelideEnvelopes);
  return result.urString();
}
