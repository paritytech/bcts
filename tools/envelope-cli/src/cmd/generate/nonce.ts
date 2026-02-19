/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Generate nonce command - 1:1 port of cmd/generate/nonce.rs
 *
 * Generate a Number Used Once (Nonce).
 */

import { Nonce } from "@bcts/components";
import type { Exec } from "../../exec.js";

/**
 * Command arguments for the nonce command.
 */
export type CommandArgs = Record<string, never>;

/**
 * Nonce command implementation.
 */
export class NonceCommand implements Exec {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor(_args: CommandArgs) {}

  exec(): string {
    const nonce = Nonce.new();
    return nonce.urString();
  }
}

/**
 * Execute the nonce command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new NonceCommand(args).exec();
}
