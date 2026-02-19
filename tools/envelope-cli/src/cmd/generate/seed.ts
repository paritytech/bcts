/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Generate seed command - 1:1 port of cmd/generate/seed.rs
 *
 * Generate a seed.
 */

import { Seed } from "@bcts/components";
import type { Exec } from "../../exec.js";

/**
 * Command arguments for the seed command.
 */
export interface CommandArgs {
  /** The number of bytes for the seed. Must be in the range 16..=256. */
  count?: number;
  /** Raw hex data for the seed. */
  hex?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    count: 16,
  };
}

/**
 * Seed command implementation.
 */
export class SeedCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    let seed: Seed;
    if (this.args.hex !== undefined) {
      const bytes = Buffer.from(this.args.hex, "hex");
      seed = Seed.from(new Uint8Array(bytes));
    } else {
      const count = this.args.count ?? 16;
      if (count < Seed.MIN_SEED_LENGTH) {
        throw new Error("Seed length must be at least 16 bytes");
      }
      if (count > 256) {
        throw new Error("Seed length must be at most 256 bytes");
      }
      seed = Seed.newWithLen(count);
    }
    return seed.urString();
  }
}

/**
 * Execute the seed command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SeedCommand(args).exec();
}
