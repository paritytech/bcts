/**
 * Generate key command - 1:1 port of cmd/generate/key.rs
 *
 * Generate a symmetric encryption key.
 */

import { SymmetricKey } from "@bcts/components";
import type { Exec } from "../../exec.js";

/**
 * Command arguments for the key command.
 */
export type CommandArgs = Record<string, never>;

/**
 * Key command implementation.
 */
export class KeyCommand implements Exec {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor(_args: CommandArgs) {}

  exec(): string {
    const key = SymmetricKey.new();
    return key.urString();
  }
}

/**
 * Execute the key command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new KeyCommand(args).exec();
}
