/**
 * Envelope support for Provenance Marks
 *
 * This module provides Gordian Envelope integration for ProvenanceMark and
 * ProvenanceMarkGenerator, enabling them to be used with the bc-envelope
 * ecosystem.
 *
 * Ported from provenance-mark-rust/src/mark.rs and generator.rs (envelope feature)
 */

import { Envelope } from "@bcts/envelope";
import { type Cbor } from "@bcts/dcbor";
import { PROVENANCE_MARK } from "@bcts/tags";
import { ProvenanceMark } from "./mark.js";
import { ProvenanceMarkGenerator } from "./generator.js";
import { resolutionFromCbor, resolutionToNumber } from "./resolution.js";
import { ProvenanceSeed } from "./seed.js";
import { RngState } from "./rng-state.js";
import { ProvenanceMarkError, ProvenanceMarkErrorType } from "./error.js";

// ============================================================================
// Tag Registration
// ============================================================================

/**
 * Registers provenance mark tags in the global format context.
 *
 * This function sets up a summarizer for the PROVENANCE_MARK tag that displays
 * provenance marks in a human-readable format.
 */
export function registerTags(): void {
  // In TypeScript, we don't have a global format context like Rust.
  // Tag summarizers are typically handled at the envelope level.
  // This function is provided for API parity.
  registerTagsIn(globalTagsContext);
}

/**
 * Registers provenance mark tags in a specific format context.
 *
 * @param context - The format context to register tags in
 */
export function registerTagsIn(context: TagsContext): void {
  context.setSummarizer(Number(PROVENANCE_MARK.value), (cborValue: Cbor) => {
    const mark = ProvenanceMark.fromUntaggedCbor(cborValue);
    return mark.toString();
  });
}

// Simple tags context interface for registration
interface TagsContext {
  setSummarizer(tag: number, summarizer: (cbor: Cbor) => string): void;
}

// Global tags context (minimal implementation)
const globalTagsContext: TagsContext = {
  setSummarizer(_tag: number, _summarizer: (cbor: Cbor) => string): void {
    // Tag summarizers are handled by the envelope package's format context
  },
};

// ============================================================================
// ProvenanceMark Envelope Support
// ============================================================================

/**
 * Convert a ProvenanceMark to an Envelope.
 *
 * The envelope contains the tagged CBOR representation of the mark.
 *
 * @param mark - The provenance mark to convert
 * @returns An envelope containing the mark
 */
export function provenanceMarkToEnvelope(mark: ProvenanceMark): Envelope {
  return Envelope.new(mark.toCborData());
}

/**
 * Extract a ProvenanceMark from an Envelope.
 *
 * @param envelope - The envelope to extract from
 * @returns The extracted provenance mark
 * @throws ProvenanceMarkError if extraction fails
 */
export function provenanceMarkFromEnvelope(envelope: Envelope): ProvenanceMark {
  // The envelope contains the CBOR-encoded bytes of the mark
  // Use asByteString to extract the raw bytes, then decode
  const bytes = envelope.asByteString();
  if (bytes !== undefined) {
    return ProvenanceMark.fromCborData(bytes);
  }

  // Try extracting from subject if it's a node
  const envCase = envelope.case();
  if (envCase.type === "node") {
    const subject = envCase.subject;
    const subjectBytes = subject.asByteString();
    if (subjectBytes !== undefined) {
      return ProvenanceMark.fromCborData(subjectBytes);
    }
  }

  throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
    message: "Could not extract ProvenanceMark from envelope",
  });
}

// ============================================================================
// ProvenanceMarkGenerator Envelope Support
// ============================================================================

/**
 * Convert a ProvenanceMarkGenerator to an Envelope.
 *
 * The envelope contains structured assertions for all generator fields:
 * - type: "provenance-generator"
 * - res: The resolution
 * - seed: The seed
 * - next-seq: The next sequence number
 * - rng-state: The RNG state
 *
 * @param generator - The generator to convert
 * @returns An envelope containing the generator
 */
export function provenanceMarkGeneratorToEnvelope(generator: ProvenanceMarkGenerator): Envelope {
  // Create envelope with chain ID as subject
  let envelope = Envelope.new(generator.chainId());

  // Add type assertion
  envelope = envelope.addAssertion("isA", "provenance-generator");

  // Add resolution
  envelope = envelope.addAssertion("res", resolutionToNumber(generator.res()));

  // Add seed
  envelope = envelope.addAssertion("seed", generator.seed().toBytes());

  // Add next sequence number
  envelope = envelope.addAssertion("next-seq", generator.nextSeq());

  // Add RNG state
  envelope = envelope.addAssertion("rng-state", generator.rngState().toBytes());

  return envelope;
}

// Type extension for envelope with extra methods
type EnvelopeExt = Envelope & {
  asByteString(): Uint8Array | undefined;
  hasType(t: string): boolean;
  assertionsWithPredicate(p: string): Envelope[];
  subject(): Envelope;
};

/**
 * Extract a ProvenanceMarkGenerator from an Envelope.
 *
 * @param envelope - The envelope to extract from
 * @returns The extracted generator
 * @throws ProvenanceMarkError if extraction fails
 */
export function provenanceMarkGeneratorFromEnvelope(
  envelope: Envelope,
): ProvenanceMarkGenerator {
  const env = envelope as EnvelopeExt;

  // Check type
  if (!env.hasType("provenance-generator")) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
      message: "Envelope is not a provenance-generator",
    });
  }

  // Extract chain ID from subject
  const subject = env.subject() as EnvelopeExt;
  const chainId = subject.asByteString();
  if (chainId === undefined) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
      message: "Could not extract chain ID",
    });
  }

  // Helper to extract assertion object value
  const extractAssertion = (predicate: string): { cbor: Cbor; bytes: Uint8Array | undefined } => {
    const assertions = env.assertionsWithPredicate(predicate);
    if (assertions.length === 0) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
        message: `Missing ${predicate} assertion`,
      });
    }
    const assertionCase = assertions[0].case();
    if (assertionCase.type !== "assertion") {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
        message: `Invalid ${predicate} assertion`,
      });
    }
    const obj = assertionCase.assertion.object() as EnvelopeExt;
    const objCase = obj.case();
    if (objCase.type === "leaf") {
      return { cbor: objCase.cbor, bytes: obj.asByteString() };
    }
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
      message: `Invalid ${predicate} value`,
    });
  };

  // Extract resolution
  const resValue = extractAssertion("res");
  const res = resolutionFromCbor(resValue.cbor);

  // Extract seed
  const seedValue = extractAssertion("seed");
  if (seedValue.bytes === undefined) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
      message: "Invalid seed data",
    });
  }
  const seed = ProvenanceSeed.fromBytes(seedValue.bytes);

  // Extract next-seq
  const seqValue = extractAssertion("next-seq");
  const nextSeq = Number(seqValue.cbor);

  // Extract rng-state
  const rngValue = extractAssertion("rng-state");
  if (rngValue.bytes === undefined) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.CborError, undefined, {
      message: "Invalid rng-state data",
    });
  }
  const rngState = RngState.fromBytes(rngValue.bytes);

  return ProvenanceMarkGenerator.new(res, seed, chainId, nextSeq, rngState);
}
