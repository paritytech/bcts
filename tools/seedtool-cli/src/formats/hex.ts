/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Hex format
 * Ported from seedtool-cli-rust/src/formats/hex.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { hexToData, dataToHex } from "../util.js";

/**
 * Hexadecimal format handler.
 * Round-trippable: hex → seed → hex.
 */
export class HexFormat implements InputFormat, OutputFormat {
  name(): string {
    return "hex";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const seed = Seed.new(hexToData(input));
    state.seed = seed;
    return state;
  }

  processOutput(state: Cli): string {
    return dataToHex(state.expectSeed().data());
  }
}
