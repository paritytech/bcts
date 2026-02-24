/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Bytewords Standard format
 * Ported from seedtool-cli-rust/src/formats/bytewords_standard.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { encodeBytewords, decodeBytewords, BytewordsStyle } from "@bcts/uniform-resources";

/**
 * Bytewords Standard format handler.
 * Round-trippable: bytewords → seed → bytewords.
 * Uses full words separated by spaces.
 */
export class BytewordsStandardFormat implements InputFormat, OutputFormat {
  name(): string {
    return "btw";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const data = decodeBytewords(input, BytewordsStyle.Standard);
    state.seed = Seed.new(data);
    return state;
  }

  processOutput(state: Cli): string {
    return encodeBytewords(state.expectSeed().data(), BytewordsStyle.Standard);
  }
}
