/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Ints format
 * Ported from seedtool-cli-rust/src/formats/ints.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { deterministicRandom } from "../random.js";
import { dataToInts, parseInts } from "../util.js";

/**
 * Integer list format handler.
 * NOT round-trippable: input is entropy source.
 * Configurable range via --low and --high CLI options.
 */
export class IntsFormat implements InputFormat, OutputFormat {
  name(): string {
    return "ints";
  }

  roundTrippable(): boolean {
    return false;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const entropy = parseInts(input);
    const data = deterministicRandom(entropy, state.count);
    state.seed = Seed.new(data);
    return state;
  }

  processOutput(state: Cli): string {
    return dataToInts(state.expectSeed().data(), state.low, state.high, " ");
  }
}
