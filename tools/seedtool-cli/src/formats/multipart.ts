/**
 * Multipart UR format
 * Ported from seedtool-cli-rust/src/formats/multipart.rs
 */

import type { Cli } from "../cli.js";
import type { InputFormat, OutputFormat } from "./format.js";
import { Seed } from "../seed.js";
import { Envelope } from "@bcts/envelope";
import { MultipartEncoder, MultipartDecoder } from "@bcts/uniform-resources";

/**
 * Multipart UR format handler.
 * Round-trippable: multipart URs → seed → multipart URs.
 * Uses fountain encoding for reliable transmission.
 */
export class MultipartFormat implements InputFormat, OutputFormat {
  name(): string {
    return "multipart";
  }

  roundTrippable(): boolean {
    return true;
  }

  processInput(state: Cli): Cli {
    const input = state.expectInput();
    const shares = input.split(/\s+/).filter((s) => s.length > 0);

    const decoder = new MultipartDecoder();
    for (const share of shares) {
      decoder.receive(share);
      if (decoder.isComplete()) {
        break;
      }
    }

    if (!decoder.isComplete()) {
      throw new Error("Insufficient multipart shares");
    }

    const ur = decoder.message();
    if (ur === undefined) {
      throw new Error("Failed to decode multipart message");
    }

    const envelope = Envelope.fromUR(ur);
    state.seed = Seed.fromEnvelope(envelope);
    return state;
  }

  processOutput(state: Cli): string {
    const ur = state.toEnvelope().ur();
    const encoder = new MultipartEncoder(ur, state.maxFragmentLen);
    const partsCount = encoder.partsCount() + state.additionalParts;

    const parts: string[] = [];
    for (let i = 0; i < partsCount; i++) {
      parts.push(encoder.nextPart());
    }

    return parts.join("\n");
  }
}
