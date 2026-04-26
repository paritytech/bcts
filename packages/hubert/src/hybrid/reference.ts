/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Reference envelope utilities for hybrid storage.
 *
 * Port of `hybrid/reference.rs` from `hubert-rust`.
 *
 * @module
 */

import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { DEREFERENCE_VIA, ID, DEREFERENCE_VIA_RAW, ID_RAW } from "@bcts/known-values";

import {
  InvalidReferenceAridError,
  NoIdAssertionError,
  NotReferenceEnvelopeError,
} from "./error.js";

/**
 * Creates a reference envelope that points to content stored in IPFS.
 *
 * Reference envelopes are small envelopes stored in the DHT that contain
 * a pointer to the actual envelope stored in IPFS. This allows the hybrid
 * storage layer to transparently handle large envelopes that exceed the
 * DHT size limit.
 *
 * Port of `create_reference_envelope()` from
 * `hubert-rust/src/hybrid/reference.rs:31-39`.
 *
 * # Format
 *
 * ```text
 * '' [
 *     'dereferenceVia': "ipfs",
 *     'id': <ARID>,
 *     "size": <number>
 * ]
 * ```
 *
 * @param referenceArid - The ARID used to look up the actual envelope in IPFS
 * @param actualSize - Size of the actual envelope in bytes (for diagnostics)
 * @returns A reference envelope that can be stored in the DHT
 *
 * @category Hybrid
 */
export function createReferenceEnvelope(referenceArid: ARID, actualSize: number): Envelope {
  return Envelope.unit()
    .addAssertion(DEREFERENCE_VIA, "ipfs")
    .addAssertion(ID, referenceArid)
    .addAssertion("size", actualSize);
}

/**
 * Checks if an envelope is a reference envelope.
 *
 * A reference envelope contains `dereferenceVia: "ipfs"` and an `id`
 * assertion on a unit subject.
 *
 * Mirrors Rust `is_reference_envelope`
 * (`hubert-rust/src/hybrid/reference.rs:53-91`):
 *
 * - Subject must be the unit value (`isSubjectUnit()` — invoked).
 * - At least one `'dereferenceVia': "ipfs"` assertion (predicate is a
 *   `KnownValue` matching `DEREFERENCE_VIA_RAW`, object's leaf is the
 *   text `"ipfs"`).
 * - At least one `'id': …` assertion (predicate is a `KnownValue`
 *   matching `ID_RAW`).
 *
 * @param envelope - The envelope to check
 * @returns `true` if this is a reference envelope, `false` otherwise
 *
 * @category Hybrid
 */
export function isReferenceEnvelope(envelope: Envelope): boolean {
  if (!envelope.isSubjectUnit()) {
    return false;
  }

  const assertions = envelope.assertions();

  let hasDereferenceVia = false;
  for (const assertion of assertions) {
    const predicate = assertion.asPredicate?.();
    if (predicate === undefined) continue;
    const kv = predicate.asKnownValue();
    if (kv === undefined) continue;
    if (kv.valueBigInt() !== DEREFERENCE_VIA_RAW) continue;
    const object = assertion.asObject?.();
    if (object === undefined) continue;
    const text = object.asText();
    if (text === "ipfs") {
      hasDereferenceVia = true;
      break;
    }
  }

  if (!hasDereferenceVia) return false;

  for (const assertion of assertions) {
    const predicate = assertion.asPredicate?.();
    if (predicate === undefined) continue;
    const kv = predicate.asKnownValue();
    if (kv === undefined) continue;
    if (kv.valueBigInt() === ID_RAW) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts the reference ARID from a reference envelope.
 *
 * Mirrors Rust `extract_reference_arid`
 * (`hubert-rust/src/hybrid/reference.rs:104-129`).
 *
 * @param envelope - The reference envelope
 * @returns The reference ARID
 * @throws {NotReferenceEnvelopeError} If the envelope is not a reference envelope
 * @throws {InvalidReferenceAridError} If the ARID cannot be extracted
 * @throws {NoIdAssertionError} If no id assertion is found
 *
 * @category Hybrid
 */
export function extractReferenceArid(envelope: Envelope): ARID {
  if (!isReferenceEnvelope(envelope)) {
    throw new NotReferenceEnvelopeError();
  }

  for (const assertion of envelope.assertions()) {
    const predicate = assertion.asPredicate?.();
    if (predicate === undefined) continue;
    const kv = predicate.asKnownValue();
    if (kv === undefined) continue;
    if (kv.valueBigInt() !== ID_RAW) continue;

    const object = assertion.asObject?.();
    if (object === undefined) continue;
    const cbor = object.subject().asLeaf();
    if (cbor === undefined) continue;
    try {
      return ARID.fromTaggedCbor(cbor);
    } catch {
      throw new InvalidReferenceAridError();
    }
  }

  throw new NoIdAssertionError();
}
