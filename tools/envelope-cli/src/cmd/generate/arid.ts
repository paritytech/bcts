/**
 * Generate ARID command - 1:1 port of cmd/generate/arid.rs
 *
 * Generate an Apparently Random Identifier (ARID).
 */

import { ARID } from "@bcts/components";
import type { Exec } from "../../exec.js";

/**
 * Command arguments for the arid command.
 */
export interface CommandArgs {
  /** Output ARID in hexadecimal format */
  hex: boolean;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    hex: false,
  };
}

/**
 * ARID command implementation.
 */
export class AridCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const arid = ARID.new();
    if (this.args.hex) {
      return Buffer.from(arid.data()).toString("hex");
    }
    return arid.urString();
  }
}

/**
 * Execute the arid command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AridCommand(args).exec();
}
