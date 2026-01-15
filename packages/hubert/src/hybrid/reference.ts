/**
 * Reference envelope utilities for hybrid storage.
 *
 * Port of hybrid/reference.rs from hubert-rust.
 *
 * @module
 */

import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { KnownValue } from "@bcts/known-values";

import {
  InvalidReferenceAridError,
  NoIdAssertionError,
  NotReferenceEnvelopeError,
} from "./error.js";

/**
 * Known value for dereferenceVia predicate.
 * @internal
 */
const DEREFERENCE_VIA = KnownValue.fromValue(8);

/**
 * Known value for id predicate.
 * @internal
 */
const ID = KnownValue.fromValue(2);

/**
 * Creates a reference envelope that points to content stored in IPFS.
 *
 * Reference envelopes are small envelopes stored in the DHT that contain
 * a pointer to the actual envelope stored in IPFS. This allows the hybrid
 * storage layer to transparently handle large envelopes that exceed the
 * DHT size limit.
 *
 * Port of `create_reference_envelope()` from hybrid/reference.rs lines 31-39.
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
 * A reference envelope contains `dereferenceVia: "ipfs"` and an `id` assertion.
 *
 * Port of `is_reference_envelope()` from hybrid/reference.rs lines 53-91.
 *
 * @param envelope - The envelope to check
 * @returns `true` if this is a reference envelope, `false` otherwise
 *
 * @category Hybrid
 */
export function isReferenceEnvelope(envelope: Envelope): boolean {
  // Check if subject is the unit value
  if (!envelope.isSubjectUnit) {
    return false;
  }

  const assertions = envelope.assertions;

  // Check for dereferenceVia: "ipfs" assertion
  let hasDereferenceVia = false;
  let hasId = false;

  for (const assertion of assertions) {
    try {
      const predicate = assertion.predicate;

      // Check if predicate is a known value
      const predicateSubject = predicate.subject;
      if (predicateSubject instanceof KnownValue) {
        const kv = predicateSubject;

        // Check for dereferenceVia
        if (kv.value === DEREFERENCE_VIA.value) {
          const object = assertion.object;
          const objectSubject = object?.subject;
          if (typeof objectSubject === "string" && objectSubject === "ipfs") {
            hasDereferenceVia = true;
          }
        }

        // Check for id
        if (kv.value === ID.value) {
          hasId = true;
        }
      }
    } catch {
      // Skip assertions that can't be parsed
      continue;
    }
  }

  return hasDereferenceVia && hasId;
}

/**
 * Extracts the reference ARID from a reference envelope.
 *
 * Port of `extract_reference_arid()` from hybrid/reference.rs lines 104-129.
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

  const assertions = envelope.assertions;

  // Find the id assertion and extract the ARID
  for (const assertion of assertions) {
    try {
      const predicate = assertion.predicate;
      const predicateSubject = predicate.subject;

      if (predicateSubject instanceof KnownValue) {
        const kv = predicateSubject;

        // Check for id
        if (kv.value === ID.value) {
          const object = assertion.object;
          const objectSubject = object?.subject;

          if (objectSubject instanceof ARID) {
            return objectSubject;
          }

          // Try to extract ARID from CBOR
          throw new InvalidReferenceAridError();
        }
      }
    } catch (error) {
      if (
        error instanceof NotReferenceEnvelopeError ||
        error instanceof InvalidReferenceAridError ||
        error instanceof NoIdAssertionError
      ) {
        throw error;
      }
      // Continue searching
      continue;
    }
  }

  throw new NoIdAssertionError();
}
