/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Dice format
 * Ported from seedtool-cli-rust/src/formats/dice.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { sha256DeterministicRandomString } from "../random.js";
import { dataToInts, digitsToData } from "../util.js";

/**
 * Dice roll format handler.
 * NOT round-trippable: input is entropy source.
 * Digits 1-6 (compatible with https://iancoleman.io/bip39/).
 */
export class DiceFormat implements InputFormat, OutputFormat {
  name(): string {
    return "dice";
  }

  roundTrippable(): boolean {
    return false;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    // Syntax check only - validates that all characters are 1-6
    digitsToData(input, 1, 6);
    // Use SHA256 deterministic random to generate seed from input
    const data = sha256DeterministicRandomString(input, state.count);
    state.seed = Seed.new(data);
    return state;
  }

  processOutput(state: Cli): string {
    return dataToInts(state.expectSeed().data(), 1, 6, "");
  }
}
