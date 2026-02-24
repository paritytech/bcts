/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * DKG Proposed Participant.
 *
 * Port of dkg/proposed_participant.rs from frost-hubert-rust.
 *
 * @module
 */

import { type ARID, type XID } from "@bcts/components";
import { type Cbor } from "@bcts/dcbor";
import { Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";

/**
 * A proposed participant in a DKG session.
 *
 * Port of `struct DkgProposedParticipant` from proposed_participant.rs lines 8-13.
 */
export class DkgProposedParticipant {
  private readonly _urString: string;
  private readonly _envelope: Envelope;
  private readonly _document: XIDDocument;
  private readonly _responseArid: ARID;

  private constructor(
    urString: string,
    envelope: Envelope,
    document: XIDDocument,
    responseArid: ARID,
  ) {
    this._urString = urString;
    this._envelope = envelope;
    this._document = document;
    this._responseArid = responseArid;
  }

  /**
   * Create a new DkgProposedParticipant from a UR string and response ARID.
   *
   * Port of `DkgProposedParticipant::new()` from proposed_participant.rs lines 22-26.
   */
  static create(urString: string, responseArid: ARID): DkgProposedParticipant {
    const [envelope, document] = parseXidEnvelope(urString);
    return new DkgProposedParticipant(urString, envelope, document, responseArid);
  }

  /**
   * Get the XID of this participant.
   *
   * Port of `DkgProposedParticipant::xid()` from proposed_participant.rs line 28.
   */
  xid(): XID {
    return this._document.xid();
  }

  /**
   * Get the XID document of this participant.
   *
   * Port of `DkgProposedParticipant::xid_document()` from proposed_participant.rs line 30.
   */
  xidDocument(): XIDDocument {
    return this._document;
  }

  /**
   * Get the UR string of the XID document.
   *
   * Port of `DkgProposedParticipant::xid_document_ur()` from proposed_participant.rs line 32.
   */
  xidDocumentUr(): string {
    return this._urString;
  }

  /**
   * Get the envelope containing the XID document.
   *
   * Port of `DkgProposedParticipant::xid_document_envelope()` from proposed_participant.rs line 34.
   */
  xidDocumentEnvelope(): Envelope {
    return this._envelope;
  }

  /**
   * Get the response ARID for this participant.
   *
   * Port of `DkgProposedParticipant::response_arid()` from proposed_participant.rs line 36.
   */
  responseArid(): ARID {
    return this._responseArid;
  }

  /**
   * Compare participants by XID for sorting.
   */
  compareTo(other: DkgProposedParticipant): number {
    const thisXid = this.xid().toString();
    const otherXid = other.xid().toString();
    return thisXid.localeCompare(otherXid);
  }
}

/**
 * Parse a XID envelope from a UR string.
 *
 * Port of `parse_xid_envelope()` from proposed_participant.rs lines 39-60.
 */
function parseXidEnvelope(input: string): [Envelope, XIDDocument] {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("XID document is required");
  }

  const ur = UR.fromURString(trimmed);
  const urType = ur.urTypeStr();
  if (urType !== "xid" && urType !== "envelope") {
    throw new Error(`Expected a ur:xid document, found ur:${urType}`);
  }

  const envelopeCbor = ur.cbor() as unknown as Cbor;
  // Try tagged CBOR first, then untagged
  let envelope: Envelope;
  try {
    envelope = Envelope.fromTaggedCbor(envelopeCbor);
  } catch {
    envelope = Envelope.fromUntaggedCbor(envelopeCbor);
  }

  const document = XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.Inception);

  return [envelope, document];
}
