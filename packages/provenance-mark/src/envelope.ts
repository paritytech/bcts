/**
 * Envelope support for Provenance Marks
 *
 * This module provides Gordian Envelope integration for ProvenanceMark and
 * ProvenanceMarkGenerator, enabling them to be used with the bc-envelope
 * ecosystem.
 *
 * Ported from provenance-mark-rust/src/mark.rs and generator.rs (envelope feature)
 */

import {
  Envelope,
  FormatContext,
  withFormatContextMut,
  registerTagsIn as envelopeRegisterTagsIn,
} from "@bcts/envelope";
import { type Cbor, type SummarizerResult } from "@bcts/dcbor";
import { PROVENANCE_MARK } from "@bcts/tags";
import { ProvenanceMark } from "./mark.js";
import { ProvenanceMarkGenerator } from "./generator.js";

// ============================================================================
// Tag Registration
// ============================================================================

/**
 * Registers provenance mark tags in the global format context.
 *
 * Matches Rust: register_tags()
 */
export function registerTags(): void {
  withFormatContextMut((context) => {
    registerTagsIn(context);
  });
}

/**
 * Registers provenance mark tags in a specific format context.
 *
 * Matches Rust: register_tags_in()
 *
 * @param context - The format context to register tags in
 */
export function registerTagsIn(context: FormatContext): void {
  envelopeRegisterTagsIn(context);

  context
    .tags()
    .setSummarizer(
      BigInt(PROVENANCE_MARK.value),
      (untaggedCbor: Cbor, _flat: boolean): SummarizerResult => {
        try {
          const mark = ProvenanceMark.fromUntaggedCbor(untaggedCbor);
          return { ok: true, value: mark.toString() };
        } catch {
          return { ok: false, error: { type: "Custom", message: "invalid provenance mark" } };
        }
      },
    );
}

// ============================================================================
// ProvenanceMark Envelope Support
// ============================================================================

/**
 * Convert a ProvenanceMark to an Envelope.
 *
 * Delegates to ProvenanceMark.intoEnvelope() — single source of truth.
 *
 * @param mark - The provenance mark to convert
 * @returns An envelope containing the mark
 */
export function provenanceMarkToEnvelope(mark: ProvenanceMark): Envelope {
  return mark.intoEnvelope();
}

/**
 * Extract a ProvenanceMark from an Envelope.
 *
 * Delegates to ProvenanceMark.fromEnvelope() — single source of truth.
 *
 * @param envelope - The envelope to extract from
 * @returns The extracted provenance mark
 * @throws ProvenanceMarkError if extraction fails
 */
export function provenanceMarkFromEnvelope(envelope: Envelope): ProvenanceMark {
  return ProvenanceMark.fromEnvelope(envelope);
}

// ============================================================================
// ProvenanceMarkGenerator Envelope Support
// ============================================================================

/**
 * Convert a ProvenanceMarkGenerator to an Envelope.
 *
 * Delegates to ProvenanceMarkGenerator.intoEnvelope() — single source of truth.
 *
 * @param generator - The generator to convert
 * @returns An envelope containing the generator
 */
export function provenanceMarkGeneratorToEnvelope(generator: ProvenanceMarkGenerator): Envelope {
  return generator.intoEnvelope();
}

/**
 * Extract a ProvenanceMarkGenerator from an Envelope.
 *
 * Delegates to ProvenanceMarkGenerator.fromEnvelope() — single source of truth.
 *
 * @param envelope - The envelope to extract from
 * @returns The extracted generator
 * @throws ProvenanceMarkError if extraction fails
 */
export function provenanceMarkGeneratorFromEnvelope(envelope: Envelope): ProvenanceMarkGenerator {
  return ProvenanceMarkGenerator.fromEnvelope(envelope);
}
