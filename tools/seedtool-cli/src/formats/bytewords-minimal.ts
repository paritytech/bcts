/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Bytewords Minimal format
 * Ported from seedtool-cli-rust/src/formats/bytewords_minimal.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { encodeBytewords, decodeBytewords, BytewordsStyle } from "@bcts/uniform-resources";

/**
 * Bytewords Minimal format handler.
 * Round-trippable: bytewords → seed → bytewords.
 * Uses 2-letter abbreviations without separators.
 */
export class BytewordsMinimalFormat implements InputFormat, OutputFormat {
  name(): string {
    return "btwm";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const data = decodeBytewords(input, BytewordsStyle.Minimal);
    state.seed = Seed.new(data);
    return state;
  }

  processOutput(state: Cli): string {
    return encodeBytewords(state.expectSeed().data(), BytewordsStyle.Minimal);
  }
}
