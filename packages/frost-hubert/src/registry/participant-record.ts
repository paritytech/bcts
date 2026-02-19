/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Participant record for the registry.
 *
 * Port of registry/participant_record.rs from frost-hubert-rust.
 *
 * @module
 */

import { type PublicKeys, type XID } from "@bcts/components";
import { type Cbor } from "@bcts/dcbor";
import { Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";

/**
 * Record of a participant in the registry.
 *
 * Port of `struct ParticipantRecord` from participant_record.rs lines 12-17.
 */
export class ParticipantRecord {
  private readonly _xidDocumentUr: string;
  private readonly _xidDocument: XIDDocument;
  private readonly _publicKeys: PublicKeys;
  private readonly _petName: string | undefined;

  private constructor(
    xidDocumentUr: string,
    xidDocument: XIDDocument,
    publicKeys: PublicKeys,
    petName: string | undefined,
  ) {
    this._xidDocumentUr = xidDocumentUr;
    this._xidDocument = xidDocument;
    this._publicKeys = publicKeys;
    this._petName = petName;
  }

  /**
   * Create a participant record from a signed XID UR string.
   *
   * Port of `ParticipantRecord::from_signed_xid_ur()` from participant_record.rs lines 20-26.
   */
  static fromSignedXidUr(xidDocumentUr: string, petName?: string): ParticipantRecord {
    const [raw, document] = parseSignedXidDocument(xidDocumentUr);
    return ParticipantRecord.buildFromParts(document, raw, petName);
  }

  /**
   * Get the pet name of the participant.
   *
   * Port of `ParticipantRecord::pet_name()` from participant_record.rs line 28.
   */
  petName(): string | undefined {
    return this._petName;
  }

  /**
   * Get the public keys of the participant.
   *
   * Port of `ParticipantRecord::public_keys()` from participant_record.rs line 29.
   */
  publicKeys(): PublicKeys {
    return this._publicKeys;
  }

  /**
   * Get the XID of the participant.
   *
   * Port of `ParticipantRecord::xid()` from participant_record.rs line 30.
   */
  xid(): XID {
    return this._xidDocument.xid();
  }

  /**
   * Get the XID document of the participant.
   *
   * Port of `ParticipantRecord::xid_document()` from participant_record.rs line 31.
   */
  xidDocument(): XIDDocument {
    return this._xidDocument;
  }

  /**
   * Get the UR string of the XID document.
   *
   * Port of `ParticipantRecord::xid_document_ur()` from participant_record.rs line 32.
   */
  xidDocumentUr(): string {
    return this._xidDocumentUr;
  }

  /**
   * Build from constituent parts.
   *
   * Port of `ParticipantRecord::build_from_parts()` from participant_record.rs lines 34-49.
   */
  private static buildFromParts(
    document: XIDDocument,
    xidDocumentUr: string,
    petName: string | undefined,
  ): ParticipantRecord {
    const inceptionKey = document.inceptionKey();
    if (inceptionKey === undefined) {
      throw new Error("XID document missing inception key");
    }

    const publicKeys = inceptionKey.publicKeys();

    return new ParticipantRecord(xidDocumentUr, document, publicKeys, petName);
  }

  /**
   * Recreate from serialized data.
   *
   * Port of `ParticipantRecord::recreate_from_serialized()` from participant_record.rs lines 51-57.
   */
  private static recreateFromSerialized(
    xidDocumentUr: string,
    petName: string | undefined,
  ): ParticipantRecord {
    const [raw, document] = parseSignedXidDocument(xidDocumentUr);
    return ParticipantRecord.buildFromParts(document, raw, petName);
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
  static fromJSON(json: Record<string, unknown>): ParticipantRecord {
    const xidDocumentUr = json["xid_document"] as string;
    const petName = json["pet_name"] as string | undefined;
    return ParticipantRecord.recreateFromSerialized(xidDocumentUr, petName);
  }
}

/**
 * Parse a signed XID document from a UR string.
 *
 * Port of `parse_signed_xid_document()` from participant_record.rs lines 170-194.
 */
function parseSignedXidDocument(xidDocumentUr: string): [string, XIDDocument] {
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

  const document = XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.Inception);

  return [sanitized, document];
}

/**
 * Sanitize XID UR input.
 *
 * Port of `sanitize_xid_ur()` from participant_record.rs lines 196-203.
 */
function sanitizeXidUr(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("XID document is required");
  }
  return trimmed;
}
