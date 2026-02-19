/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Bytewords URI format
 * Ported from seedtool-cli-rust/src/formats/bytewords_uri.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { encodeBytewords, decodeBytewords, BytewordsStyle } from "@bcts/uniform-resources";

/**
 * Bytewords URI format handler.
 * Round-trippable: bytewords → seed → bytewords.
 * Uses full words separated by hyphens (URI-safe).
 */
export class BytewordsUriFormat implements InputFormat, OutputFormat {
  name(): string {
    return "btwu";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const data = decodeBytewords(input, BytewordsStyle.Uri);
    state.seed = Seed.new(data);
    return state;
  }

  processOutput(state: Cli): string {
    return encodeBytewords(state.expectSeed().data(), BytewordsStyle.Uri);
  }
}
