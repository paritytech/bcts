/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * DKG Group Invite structures.
 *
 * Port of dkg/group_invite.rs from frost-hubert-rust.
 *
 * @module
 */

import { ARID } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { Envelope, Function as EnvelopeFunction } from "@bcts/envelope";
import { SealedRequest, SealedResponse } from "@bcts/gstp";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";

import { DkgProposedParticipant } from "./proposed-participant.js";

/**
 * Result of a DKG invitation.
 *
 * Port of `enum DkgInvitationResult` from group_invite.rs lines 170-173.
 */
export type DkgInvitationResult = { type: "accepted" } | { type: "declined"; reason: string };

/**
 * Helper to create an accepted result.
 */
export function accepted(): DkgInvitationResult {
  return { type: "accepted" };
}

/**
 * Helper to create a declined result.
 */
export function declined(reason: string): DkgInvitationResult {
  return { type: "declined", reason };
}

/**
 * DKG Invite - represents an invitation to participate in a DKG session.
 *
 * Port of `struct DkgInvite` from group_invite.rs lines 11-27.
 */
export class DkgInvite {
  private readonly _requestId: ARID;
  private readonly _sender: XIDDocument;
  private readonly _groupId: ARID;
  private readonly _date: Date;
  private readonly _validUntil: Date;
  private readonly _minSigners: number;
  private readonly _charter: string;
  private readonly _orderedParticipants: DkgProposedParticipant[];

  private constructor(
    requestId: ARID,
    sender: XIDDocument,
    groupId: ARID,
    date: Date,
    validUntil: Date,
    minSigners: number,
    charter: string,
    orderedParticipants: DkgProposedParticipant[],
  ) {
    this._requestId = requestId;
    this._sender = sender;
    this._groupId = groupId;
    this._date = date;
    this._validUntil = validUntil;
    this._minSigners = minSigners;
    this._charter = charter;
    this._orderedParticipants = orderedParticipants;
  }

  /**
   * Create a new DKG invite.
   *
   * Port of `DkgInvite::new()` from group_invite.rs lines 30-67.
   */
  static create(
    requestId: ARID,
    sender: XIDDocument,
    groupId: ARID,
    date: Date,
    validUntil: Date,
    minSigners: number,
    charter: string,
    participants: string[],
    responseArids: ARID[],
  ): DkgInvite {
    if (participants.length !== responseArids.length) {
      throw new Error(
        `Number of participants (${participants.length}) does not match number of response ARIDs (${responseArids.length})`,
      );
    }

    if (minSigners < 2) {
      throw new Error("min_signers must be at least 2");
    }

    const orderedParticipants = participants.map((urString, i) =>
      DkgProposedParticipant.create(urString, responseArids[i]),
    );

    if (minSigners > orderedParticipants.length) {
      throw new Error("min_signers cannot exceed number of participants");
    }

    // Sort by XID
    orderedParticipants.sort((a, b) => a.compareTo(b));

    return new DkgInvite(
      requestId,
      sender,
      groupId,
      date,
      validUntil,
      minSigners,
      charter,
      orderedParticipants,
    );
  }

  requestId(): ARID {
    return this._requestId;
  }

  sender(): XIDDocument {
    return this._sender;
  }

  groupId(): ARID {
    return this._groupId;
  }

  date(): Date {
    return this._date;
  }

  validUntil(): Date {
    return this._validUntil;
  }

  minSigners(): number {
    return this._minSigners;
  }

  charter(): string {
    return this._charter;
  }

  participants(): DkgProposedParticipant[] {
    return this._orderedParticipants;
  }

  /**
   * Create a GSTP sealed request from this invite.
   *
   * Port of `DkgInvite::to_request()` from group_invite.rs lines 87-121.
   */
  toRequest(): SealedRequest {
    let request = SealedRequest.new("dkgInvite", this.requestId(), this.sender())
      .withParameter("group", this.groupId())
      .withParameter("minSigners", BigInt(this.minSigners()))
      .withParameter("charter", this.charter())
      .withDate(this.date())
      .withParameter("validUntil", CborDate.fromDatetime(this.validUntil()));

    for (const participant of this.participants()) {
      const xidDocumentEnvelope = participant.xidDocumentEnvelope();
      const responseArid = participant.responseArid();
      const encryptionKey = participant.xidDocument().encryptionKey();

      if (encryptionKey === undefined) {
        throw new Error("Participant XID document has no encryption key");
      }

      const encryptedResponseArid = Envelope.new(responseArid).encryptToRecipients([encryptionKey]);

      const participantEnvelope = xidDocumentEnvelope
        .wrap()
        .addAssertion("response_arid", encryptedResponseArid);

      request = request.withParameter("participant", participantEnvelope);
    }

    return request;
  }

  /**
   * Creates a signed but unencrypted envelope for auditing/preview.
   *
   * Port of `DkgInvite::to_unsealed_envelope()` from group_invite.rs lines 124-139.
   */
  toUnsealedEnvelope(): Envelope {
    const request = this.toRequest();
    const sender = this.sender();
    const signerPrivateKeys = sender.inceptionPrivateKeys();

    if (signerPrivateKeys === undefined) {
      throw new Error("Sender XID document has no inception signing key");
    }

    return request.toEnvelope(
      this.validUntil(),
      signerPrivateKeys,
      undefined, // No recipient = signed but not encrypted
    );
  }

  /**
   * Creates a sealed envelope encrypted to all participants.
   *
   * Port of `DkgInvite::to_envelope()` from group_invite.rs lines 142-166.
   */
  toEnvelope(): Envelope {
    const request = this.toRequest();
    const sender = this.sender();
    const signerPrivateKeys = sender.inceptionPrivateKeys();

    if (signerPrivateKeys === undefined) {
      throw new Error("Sender XID document has no inception signing key");
    }

    const recipients = this.participants().map((p) => p.xidDocument());

    return request.toEnvelopeForRecipients(this.validUntil(), signerPrivateKeys, recipients);
  }
}

/**
 * DKG Invitation - represents a received invitation from a participant's perspective.
 *
 * Port of `struct DkgInvitation` from group_invite.rs lines 175-186.
 */
export class DkgInvitation {
  private readonly _responseArid: ARID;
  private readonly _validUntil: Date;
  private readonly _sender: XIDDocument;
  private readonly _requestId: ARID;
  private readonly _peerContinuation: Envelope | undefined;
  private readonly _minSigners: number;
  private readonly _charter: string;
  private readonly _groupId: ARID;

  private constructor(
    responseArid: ARID,
    validUntil: Date,
    sender: XIDDocument,
    requestId: ARID,
    peerContinuation: Envelope | undefined,
    minSigners: number,
    charter: string,
    groupId: ARID,
  ) {
    this._responseArid = responseArid;
    this._validUntil = validUntil;
    this._sender = sender;
    this._requestId = requestId;
    this._peerContinuation = peerContinuation;
    this._minSigners = minSigners;
    this._charter = charter;
    this._groupId = groupId;
  }

  responseArid(): ARID {
    return this._responseArid;
  }

  validUntil(): Date {
    return this._validUntil;
  }

  sender(): XIDDocument {
    return this._sender;
  }

  requestId(): ARID {
    return this._requestId;
  }

  peerContinuation(): Envelope | undefined {
    return this._peerContinuation;
  }

  minSigners(): number {
    return this._minSigners;
  }

  charter(): string {
    return this._charter;
  }

  groupId(): ARID {
    return this._groupId;
  }

  /**
   * Build a GSTP response for this invitation result.
   *
   * Port of `DkgInvitation::to_response()` from group_invite.rs lines 207-224.
   */
  toResponse(response: DkgInvitationResult, recipient: XIDDocument): SealedResponse {
    let base: SealedResponse;
    if (response.type === "accepted") {
      base = SealedResponse.newSuccess(this.requestId(), recipient);
    } else {
      base = SealedResponse.newFailure(this.requestId(), recipient).withError(response.reason);
    }

    return base.withPeerContinuation(this.peerContinuation());
  }

  /**
   * Create a signed/encrypted GSTP envelope containing the response for the coordinator.
   *
   * Port of `DkgInvitation::to_envelope()` from group_invite.rs lines 228-244.
   */
  toEnvelope(response: DkgInvitationResult, recipient: XIDDocument): Envelope {
    const responseObj = this.toResponse(response, recipient);
    const signerPrivateKeys = recipient.inceptionPrivateKeys();

    if (signerPrivateKeys === undefined) {
      throw new Error("Recipient XID document has no signing keys");
    }

    const recipients = [this.sender()];

    return responseObj.toEnvelopeForRecipients(this.validUntil(), signerPrivateKeys, recipients);
  }

  /**
   * Parse a DKG invitation from an invite envelope.
   *
   * Port of `DkgInvitation::from_invite()` from group_invite.rs lines 255-344.
   */
  static fromInvite(
    invite: Envelope,
    now: Date,
    expectedSender: XIDDocument | undefined,
    recipient: XIDDocument,
  ): DkgInvitation {
    const recipientPrivateKeys = recipient.inceptionPrivateKeys();

    if (recipientPrivateKeys === undefined) {
      throw new Error("Recipient XID document has no inception private keys");
    }

    const sealedRequest = SealedRequest.tryFromEnvelope(
      invite,
      undefined,
      now,
      recipientPrivateKeys,
    );

    if (expectedSender !== undefined && sealedRequest.sender().xid() !== expectedSender.xid()) {
      throw new Error("Invite sender does not match expected sender");
    }

    if (!sealedRequest.request().function().equals(EnvelopeFunction.fromString("dkgInvite"))) {
      throw new Error("Unexpected invite function");
    }

    const validUntil = sealedRequest.extractObjectForParameter<Date>("validUntil");

    if (validUntil <= now) {
      throw new Error("Invitation expired");
    }

    const recipientXid = recipient.xid();
    const minSigners = sealedRequest.extractObjectForParameter<number>("minSigners");
    const charter = sealedRequest.extractObjectForParameter<string>("charter");
    const groupId = sealedRequest.extractObjectForParameter<ARID>("group");
    const participantObjects = sealedRequest.objectsForParameter("participant");

    if (minSigners < 2) {
      throw new Error("min_signers must be at least 2");
    }

    if (minSigners > participantObjects.length) {
      throw new Error("min_signers exceeds participant count");
    }

    for (const participant of participantObjects) {
      const xidDocumentEnvelope = participant.tryUnwrap();
      const xidDocument = XIDDocument.fromEnvelope(
        xidDocumentEnvelope,
        undefined,
        XIDVerifySignature.Inception,
      );

      if (xidDocument.xid() !== recipientXid) {
        continue;
      }

      const encryptedResponseArid = participant.objectForPredicate("response_arid");
      const responseAridEnvelope = encryptedResponseArid.decryptToRecipient(recipientPrivateKeys);
      const responseArid: ARID = responseAridEnvelope.extractSubject((cbor) =>
        ARID.fromTaggedCbor(cbor),
      );

      return new DkgInvitation(
        responseArid,
        validUntil,
        sealedRequest.sender(),
        sealedRequest.request().id(),
        sealedRequest.peerContinuation(),
        minSigners,
        charter,
        groupId,
      );
    }

    throw new Error("Recipient not found in invite");
  }
}
