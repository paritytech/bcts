/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Random format
 * Ported from seedtool-cli-rust/src/formats/random.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat } from "./format.js";
import { Seed } from "../seed.js";

/**
 * Random seed generation format.
 * Input-only: generates a new random seed.
 */
export class RandomFormat implements InputFormat {
  name(): string {
    return "random";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const data = state.randomData(state.count);
    state.seed = Seed.new(data);
    return state;
  }
}
