/**
 * Attachment Extension for Gordian Envelope
 *
 * Provides functionality for attaching vendor-specific metadata to envelopes.
 * Attachments enable flexible, extensible data storage without modifying
 * the core data model, facilitating interoperability and future compatibility.
 *
 * Each attachment has:
 * - A payload (arbitrary data)
 * - A required vendor identifier (typically a reverse domain name)
 * - An optional conformsTo URI that indicates the format of the attachment
 *
 * See BCR-2023-006: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-006-envelope-attachment.md
 */

import { Envelope } from "../base/envelope";
import { type Digest } from "../base/digest";
import { EnvelopeError } from "../base/error";
import type { EnvelopeEncodableValue } from "../base/envelope-encodable";
import {
  ATTACHMENT as ATTACHMENT_KV,
  VENDOR as VENDOR_KV,
  CONFORMS_TO as CONFORMS_TO_KV,
} from "@bcts/known-values";

/**
 * Known value for the 'attachment' predicate.
 */
export const ATTACHMENT = ATTACHMENT_KV;

/**
 * Known value for the 'vendor' predicate.
 */
export const VENDOR = VENDOR_KV;

/**
 * Known value for the 'conformsTo' predicate.
 */
export const CONFORMS_TO = CONFORMS_TO_KV;

/**
 * A container for vendor-specific metadata attachments.
 *
 * Attachments provides a flexible mechanism for attaching arbitrary metadata
 * to envelopes without modifying their core structure.
 */
export class Attachments {
  private readonly _envelopes = new Map<string, Envelope>();

  /**
   * Creates a new empty attachments container.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  /**
   * Adds a new attachment with the specified payload and metadata.
   *
   * @param payload - The data to attach
   * @param vendor - A string identifying the entity that defined the attachment format
   * @param conformsTo - Optional URI identifying the structure the payload conforms to
   */
  add(payload: EnvelopeEncodableValue, vendor: string, conformsTo?: string): void {
    const attachment = Envelope.newAttachment(payload, vendor, conformsTo);
    this._envelopes.set(attachment.digest().hex(), attachment);
  }

  /**
   * Adds a pre-constructed attachment envelope directly.
   *
   * @param envelope - The attachment envelope to add
   */
  addEnvelope(envelope: Envelope): void {
    this._envelopes.set(envelope.digest().hex(), envelope);
  }

  /**
   * Retrieves an attachment by its digest.
   *
   * @param digest - The unique digest of the attachment to retrieve
   * @returns The envelope if found, or undefined
   */
  get(digest: Digest): Envelope | undefined {
    return this._envelopes.get(digest.hex());
  }

  /**
   * Removes an attachment by its digest.
   *
   * @param digest - The unique digest of the attachment to remove
   * @returns The removed envelope if found, or undefined
   */
  remove(digest: Digest): Envelope | undefined {
    const envelope = this._envelopes.get(digest.hex());
    this._envelopes.delete(digest.hex());
    return envelope;
  }

  /**
   * Removes all attachments from the container.
   */
  clear(): void {
    this._envelopes.clear();
  }

  /**
   * Returns whether the container has any attachments.
   */
  isEmpty(): boolean {
    return this._envelopes.size === 0;
  }

  /**
   * Returns the number of attachments in the container.
   */
  len(): number {
    return this._envelopes.size;
  }

  /**
   * Returns an iterator over all attachment envelopes.
   */
  iter(): IterableIterator<[string, Envelope]> {
    return this._envelopes.entries();
  }

  /**
   * Check equality with another Attachments container.
   */
  equals(other: Attachments): boolean {
    if (this._envelopes.size !== other._envelopes.size) return false;
    for (const [key] of this._envelopes) {
      if (!other._envelopes.has(key)) return false;
    }
    return true;
  }

  /**
   * Adds all attachments from this container to an envelope.
   *
   * @param envelope - The envelope to add attachments to
   * @returns A new envelope with all attachments added as assertions
   */
  addToEnvelope(envelope: Envelope): Envelope {
    let result = envelope;
    for (const attachment of this._envelopes.values()) {
      result = result.addAssertion(ATTACHMENT, attachment);
    }
    return result;
  }

  /**
   * Creates an Attachments container from an envelope's attachment assertions.
   *
   * @param envelope - The envelope to extract attachments from
   * @returns A new Attachments container with the envelope's attachments
   */
  static fromEnvelope(envelope: Envelope): Attachments {
    const attachments = new Attachments();
    const attachmentEnvelopes = envelope.attachments();

    for (const attachment of attachmentEnvelopes) {
      attachments._envelopes.set(attachment.digest().hex(), attachment);
    }

    return attachments;
  }
}

// Implementation

/**
 * Creates a new attachment envelope.
 */
Envelope.newAttachment = function (
  payload: EnvelopeEncodableValue,
  vendor: string,
  conformsTo?: string,
): Envelope {
  // Create the payload envelope wrapped with vendor assertion
  let attachmentObj = Envelope.new(payload).wrap().addAssertion(VENDOR, vendor);

  // Add optional conformsTo
  if (conformsTo !== undefined) {
    attachmentObj = attachmentObj.addAssertion(CONFORMS_TO, conformsTo);
  }

  // Create an assertion with 'attachment' as predicate and the wrapped payload as object
  // This returns an assertion envelope
  const attachmentPredicate = Envelope.new(ATTACHMENT);
  return attachmentPredicate.addAssertion(ATTACHMENT, attachmentObj).assertions()[0];
};

/**
 * Adds an attachment to an envelope.
 */
// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
  Envelope.prototype.addAttachment = function (
    this: Envelope,
    payload: EnvelopeEncodableValue,
    vendor: string,
    conformsTo?: string,
  ): Envelope {
    let attachmentObj = Envelope.new(payload).wrap().addAssertion(VENDOR, vendor);

    if (conformsTo !== undefined) {
      attachmentObj = attachmentObj.addAssertion(CONFORMS_TO, conformsTo);
    }

    return this.addAssertion(ATTACHMENT, attachmentObj);
  };

  /**
   * Returns the payload of an attachment envelope.
   */
  Envelope.prototype.attachmentPayload = function (this: Envelope): Envelope {
    const c = this.case();
    if (c.type !== "assertion") {
      throw EnvelopeError.general("Envelope is not an attachment assertion");
    }

    const obj = c.assertion.object();
    return obj.unwrap();
  };

  /**
   * Returns the vendor of an attachment envelope.
   */
  Envelope.prototype.attachmentVendor = function (this: Envelope): string {
    const c = this.case();
    if (c.type !== "assertion") {
      throw EnvelopeError.general("Envelope is not an attachment assertion");
    }

    const obj = c.assertion.object();
    const vendorEnv = obj.objectForPredicate(VENDOR);
    const vendor = vendorEnv.asText();

    if (vendor === undefined || vendor === "") {
      throw EnvelopeError.general("Attachment has no vendor");
    }

    return vendor;
  };

  /**
   * Returns the conformsTo of an attachment envelope.
   */
  Envelope.prototype.attachmentConformsTo = function (this: Envelope): string | undefined {
    const c = this.case();
    if (c.type !== "assertion") {
      throw EnvelopeError.general("Envelope is not an attachment assertion");
    }

    const obj = c.assertion.object();
    const conformsToEnv = obj.optionalObjectForPredicate(CONFORMS_TO);

    if (conformsToEnv === undefined) {
      return undefined;
    }

    return conformsToEnv.asText();
  };

  /**
   * Returns all attachment assertions.
   */
  Envelope.prototype.attachments = function (this: Envelope): Envelope[] {
    return this.assertionsWithPredicate(ATTACHMENT).map((a) => {
      const c = a.case();
      if (c.type === "assertion") {
        return c.assertion.object();
      }
      throw EnvelopeError.general("Invalid attachment assertion");
    });
  };

  /**
   * Returns attachments matching vendor and/or conformsTo.
   */
  Envelope.prototype.attachmentsWithVendorAndConformsTo = function (
    this: Envelope,
    vendor?: string,
    conformsTo?: string,
  ): Envelope[] {
    const allAttachments = this.attachments();

    return allAttachments.filter((attachment) => {
      try {
        // The attachment is already a wrapped envelope with vendor/conformsTo assertions
        // Check vendor if specified
        if (vendor !== undefined) {
          const vendorEnv = attachment.objectForPredicate(VENDOR);
          const attachmentVendor = vendorEnv.asText();
          if (attachmentVendor !== vendor) {
            return false;
          }
        }

        // Check conformsTo if specified
        if (conformsTo !== undefined) {
          const conformsToEnv = attachment.optionalObjectForPredicate(CONFORMS_TO);
          if (conformsToEnv === undefined) {
            return false;
          }
          const conformsToText = conformsToEnv.asText();
          if (conformsToText !== conformsTo) {
            return false;
          }
        }

        return true;
      } catch {
        return false;
      }
    });
  };

  /**
   * Validates that this envelope is a valid attachment.
   *
   * An attachment is valid if:
   * 1. The envelope is an assertion with 'attachment' as predicate
   * 2. The object contains a wrapped payload with vendor assertion
   * 3. Reconstructing the attachment yields an equivalent envelope
   *
   * @throws EnvelopeError if the envelope is not a valid attachment
   */
  Envelope.prototype.validateAttachment = function (this: Envelope): void {
    const c = this.case();
    if (c.type !== "assertion") {
      throw EnvelopeError.invalidAttachment("Envelope is not an assertion");
    }

    // Verify predicate is 'attachment' (using digest comparison for KnownValue predicates)
    const predicate = c.assertion.predicate();
    const expectedPredicate = Envelope.new(ATTACHMENT);
    if (!predicate.digest().equals(expectedPredicate.digest())) {
      throw EnvelopeError.invalidAttachment("Assertion predicate is not 'attachment'");
    }

    // Extract components
    const payload = this.attachmentPayload();
    const vendor = this.attachmentVendor();
    const conformsTo = this.attachmentConformsTo();

    // Reconstruct the attachment
    const reconstructed = Envelope.newAttachment(payload, vendor, conformsTo);

    // Check equivalence (same digest = semantically equivalent)
    if (!this.digest().equals(reconstructed.digest())) {
      throw EnvelopeError.invalidAttachment("Attachment structure is invalid");
    }
  };

  /**
   * Finds a single attachment matching the given vendor and conformsTo.
   *
   * Unlike `attachmentsWithVendorAndConformsTo` which returns an array,
   * this method requires exactly one attachment to match.
   *
   * @param vendor - Optional vendor identifier to match
   * @param conformsTo - Optional conformsTo URI to match
   * @returns The matching attachment envelope
   * @throws EnvelopeError if not exactly one attachment matches
   */
  Envelope.prototype.attachmentWithVendorAndConformsTo = function (
    this: Envelope,
    vendor?: string,
    conformsTo?: string,
  ): Envelope {
    const matches = this.attachmentsWithVendorAndConformsTo(vendor, conformsTo);

    if (matches.length === 0) {
      throw EnvelopeError.general("No matching attachment found");
    }
    if (matches.length > 1) {
      throw EnvelopeError.general(`Expected exactly one attachment, found ${matches.length}`);
    }

    return matches[0];
  };
}
