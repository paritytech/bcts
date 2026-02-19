/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Seed UR format
 * Ported from seedtool-cli-rust/src/formats/seed.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { Seed as ComponentsSeed } from "@bcts/components";

/**
 * Seed UR format handler.
 * Round-trippable: seed UR → seed → seed UR.
 * Uses the ur:seed format from bc-components.
 */
export class SeedFormat implements InputFormat, OutputFormat {
  name(): string {
    return "seed";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const componentsSeed = ComponentsSeed.fromURString(input);
    state.seed = Seed.fromComponentsSeed(componentsSeed);
    return state;
  }

  processOutput(state: Cli): string {
    const seed = state.seedWithOverrides();
    const componentsSeed = seed.toComponentsSeed();
    return componentsSeed.urString();
  }
}
