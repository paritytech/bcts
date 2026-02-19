/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Base10 format
 * Ported from seedtool-cli-rust/src/formats/base10.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { sha256DeterministicRandomString } from "../random.js";
import { dataToInts, digitsToData } from "../util.js";

/**
 * Base-10 format handler.
 * NOT round-trippable: input is entropy source.
 * Digits 0-9 (compatible with https://iancoleman.io/bip39/).
 */
export class Base10Format implements InputFormat, OutputFormat {
  name(): string {
    return "base10";
  }

  roundTrippable(): boolean {
    return false;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    // Syntax check only - validates that all characters are 0-9
    digitsToData(input, 0, 9);
    // Use SHA256 deterministic random to generate seed from input
    const data = sha256DeterministicRandomString(input, state.count);
    state.seed = Seed.new(data);
    return state;
  }

  processOutput(state: Cli): string {
    return dataToInts(state.expectSeed().data(), 0, 9, "");
  }
}
