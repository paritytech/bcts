/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Owner record for the registry.
 *
 * Port of registry/owner_record.rs from frost-hubert-rust.
 *
 * @module
 */

import { type XID } from "@bcts/components";
import { type Cbor } from "@bcts/dcbor";
import { Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";

/**
 * Record of the registry owner (coordinator).
 *
 * Port of `struct OwnerRecord` from owner_record.rs lines 13-17.
 */
export class OwnerRecord {
  private readonly _xidDocumentUr: string;
  private readonly _xidDocument: XIDDocument;
  private readonly _petName: string | undefined;

  private constructor(
    xidDocumentUr: string,
    xidDocument: XIDDocument,
    petName: string | undefined,
  ) {
    this._xidDocumentUr = xidDocumentUr;
    this._xidDocument = xidDocument;
    this._petName = petName;
  }

  /**
   * Create an owner record from a signed XID UR string.
   *
   * Port of `OwnerRecord::from_signed_xid_ur()` from owner_record.rs lines 20-32.
   */
  static fromSignedXidUr(xidDocumentUr: string, petName?: string): OwnerRecord {
    const [raw, document] = parseRelaxedXidDocument(xidDocumentUr);

    if (document.inceptionPrivateKeys() === undefined) {
      throw new Error("Owner XID document must include private keys");
    }

    return new OwnerRecord(raw, document, petName);
  }

  /**
   * Get the XID of the owner.
   *
   * Port of `OwnerRecord::xid()` from owner_record.rs line 34.
   */
  xid(): XID {
    return this._xidDocument.xid();
  }

  /**
   * Get the XID document of the owner.
   *
   * Port of `OwnerRecord::xid_document()` from owner_record.rs line 36.
   */
  xidDocument(): XIDDocument {
    return this._xidDocument;
  }

  /**
   * Get the UR string of the XID document.
   *
   * Port of `OwnerRecord::xid_document_ur()` from owner_record.rs line 38.
   */
  xidDocumentUr(): string {
    return this._xidDocumentUr;
  }

  /**
   * Get the pet name of the owner.
   *
   * Port of `OwnerRecord::pet_name()` from owner_record.rs line 40.
   */
  petName(): string | undefined {
    return this._petName;
  }

  /**
   * Serialize to JSON object.
   */
  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {
      xid_document: this._xidDocumentUr,
    };
    if (this._petName !== undefined) {
      obj["pet_name"] = this._petName;
    }
    return obj;
  }

  /**
   * Deserialize from JSON object.
   */
  static fromJSON(json: Record<string, unknown>): OwnerRecord {
    const xidDocumentUr = json["xid_document"] as string;
    const petName = json["pet_name"] as string | undefined;
    return OwnerRecord.fromSignedXidUr(xidDocumentUr, petName);
  }
}

/**
 * Parse a XID document with relaxed validation (no signature verification).
 *
 * Port of `parse_relaxed_xid_document()` from owner_record.rs lines 144-165.
 */
function parseRelaxedXidDocument(xidDocumentUr: string): [string, XIDDocument] {
  const sanitized = sanitizeXidUr(xidDocumentUr);
  const ur = UR.fromURString(sanitized);

  if (ur.urTypeStr() !== "xid" && ur.urTypeStr() !== "envelope") {
    throw new Error(`Expected a ur:xid document, found ur:${ur.urTypeStr()}`);
  }

  const envelopeCbor = ur.cbor() as unknown as Cbor;
  let envelope: Envelope;
  try {
    envelope = Envelope.fromTaggedCbor(envelopeCbor);
  } catch {
    envelope = Envelope.fromUntaggedCbor(envelopeCbor);
  }

  const document = XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.None);

  return [sanitized, document];
}

/**
 * Sanitize XID UR input.
 *
 * Port of `sanitize_xid_ur()` from owner_record.rs lines 167-174.
 */
function sanitizeXidUr(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("XID document is required");
  }
  return trimmed;
}
