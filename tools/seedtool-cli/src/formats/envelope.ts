/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Envelope format
 * Ported from seedtool-cli-rust/src/formats/envelope.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { Envelope } from "@bcts/envelope";

/**
 * Gordian Envelope format handler.
 * Round-trippable: envelope UR → seed → envelope UR.
 */
export class EnvelopeFormat implements InputFormat, OutputFormat {
  name(): string {
    return "envelope";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const envelope = Envelope.fromURString(input);
    state.seed = Seed.fromEnvelope(envelope);
    return state;
  }

  processOutput(state: Cli): string {
    return state.toEnvelope().urString();
  }
}
