/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * SealedResponse - Sealed response messages for GSTP
 *
 * A SealedResponse wraps a Response with sender information and state
 * continuations for secure, authenticated response messages.
 *
 * Ported from gstp-rust/src/sealed_response.rs
 */

import type { ARID, PrivateKeys, Signer } from "@bcts/components";
import { Envelope, Response, type EnvelopeEncodableValue } from "@bcts/envelope";
import { SENDER, SENDER_CONTINUATION, RECIPIENT_CONTINUATION } from "@bcts/known-values";
import { XIDDocument } from "@bcts/xid";
import { Continuation } from "./continuation";
import { GstpError } from "./error";

/**
 * Interface that defines the behavior of a sealed response.
 *
 * Extends ResponseBehavior with additional methods for managing
 * sender information and state continuations.
 */
export interface SealedResponseBehavior {
  /**
   * Adds state to the response that the peer may return at some future time.
   */
  withState(state: EnvelopeEncodableValue): SealedResponse;

  /**
   * Adds optional state to the response.
   */
  withOptionalState(state: EnvelopeEncodableValue | undefined): SealedResponse;

  /**
   * Adds a continuation previously received from the recipient.
   */
  withPeerContinuation(peerContinuation: Envelope | undefined): SealedResponse;

  /**
   * Returns the sender of the response.
   */
  sender(): XIDDocument;

  /**
   * Returns the state to be sent to the peer.
   */
  state(): Envelope | undefined;

  /**
   * Returns the continuation received from the peer.
   */
  peerContinuation(): Envelope | undefined;
}

/**
 * A sealed response that combines a Response with sender information and
 * state continuations for secure communication.
 *
 * @example
 * ```typescript
 * import { SealedResponse, ARID } from '@bcts/gstp';
 * import { XIDDocument } from '@bcts/xid';
 *
 * // Create sender XID document
 * const sender = XIDDocument.new();
 * const requestId = ARID.new();
 *
 * // Create a successful sealed response
 * const response = SealedResponse.newSuccess(requestId, sender)
 *   .withResult("Operation completed")
 *   .withState("next-page-state");
 *
 * // Convert to sealed envelope
 * const envelope = response.toEnvelope(
 *   new Date(Date.now() + 60000), // Valid for 60 seconds
 *   senderPrivateKey,
 *   recipientXIDDocument
 * );
 * ```
 */
export class SealedResponse implements SealedResponseBehavior {
  private _response: Response;
  private readonly _sender: XIDDocument;
  private _state: Envelope | undefined;
  private _peerContinuation: Envelope | undefined;

  private constructor(
    response: Response,
    sender: XIDDocument,
    state?: Envelope,
    peerContinuation?: Envelope,
  ) {
    this._response = response;
    this._sender = sender;
    this._state = state;
    this._peerContinuation = peerContinuation;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new successful sealed response.
   *
   * @param id - The request ID this response is for
   * @param sender - The sender's XID document
   */
  static newSuccess(id: ARID, sender: XIDDocument): SealedResponse {
    return new SealedResponse(Response.newSuccess(id), sender);
  }

  /**
   * Creates a new failure sealed response.
   *
   * @param id - The request ID this response is for
   * @param sender - The sender's XID document
   */
  static newFailure(id: ARID, sender: XIDDocument): SealedResponse {
    return new SealedResponse(Response.newFailure(id), sender);
  }

  /**
   * Creates a new early failure sealed response.
   *
   * An early failure takes place before the message has been decrypted,
   * and therefore the ID and sender public key are not known.
   *
   * @param sender - The sender's XID document
   */
  static newEarlyFailure(sender: XIDDocument): SealedResponse {
    return new SealedResponse(Response.newEarlyFailure(), sender);
  }

  // ============================================================================
  // SealedResponseBehavior implementation
  // ============================================================================

  /**
   * Adds state to the response that the peer may return at some future time.
   *
   * @throws Error if called on a failed response
   */
  withState(state: EnvelopeEncodableValue): SealedResponse {
    if (!this._response.isOk()) {
      throw new Error("Cannot set state on a failed response");
    }
    this._state = Envelope.new(state);
    return this;
  }

  /**
   * Adds optional state to the response.
   */
  withOptionalState(state: EnvelopeEncodableValue | undefined): SealedResponse {
    if (state !== undefined) {
      return this.withState(state);
    }
    this._state = undefined;
    return this;
  }

  /**
   * Adds a continuation previously received from the recipient.
   */
  withPeerContinuation(peerContinuation: Envelope | undefined): SealedResponse {
    this._peerContinuation = peerContinuation;
    return this;
  }

  /**
   * Returns the sender of the response.
   */
  sender(): XIDDocument {
    return this._sender;
  }

  /**
   * Returns the state to be sent to the peer.
   */
  state(): Envelope | undefined {
    return this._state;
  }

  /**
   * Returns the continuation received from the peer.
   */
  peerContinuation(): Envelope | undefined {
    return this._peerContinuation;
  }

  // ============================================================================
  // ResponseBehavior implementation
  // ============================================================================

  /**
   * Sets the result value for a successful response.
   */
  withResult(result: EnvelopeEncodableValue): SealedResponse {
    this._response = this._response.withResult(result);
    return this;
  }

  /**
   * Sets an optional result value for a successful response.
   * If the result is undefined, the value of the response will be the null envelope.
   */
  withOptionalResult(result: EnvelopeEncodableValue | undefined): SealedResponse {
    this._response = this._response.withOptionalResult(result);
    return this;
  }

  /**
   * Sets the error value for a failure response.
   */
  withError(error: EnvelopeEncodableValue): SealedResponse {
    this._response = this._response.withError(error);
    return this;
  }

  /**
   * Sets an optional error value for a failure response.
   * If the error is undefined, the value of the response will be the unknown value.
   */
  withOptionalError(error: EnvelopeEncodableValue | undefined): SealedResponse {
    this._response = this._response.withOptionalError(error);
    return this;
  }

  /**
   * Returns true if this is a successful response.
   */
  isOk(): boolean {
    return this._response.isOk();
  }

  /**
   * Returns true if this is a failure response.
   */
  isErr(): boolean {
    return this._response.isErr();
  }

  /**
   * Returns the ID of the request this response is for, if known.
   */
  id(): ARID | undefined {
    return this._response.id();
  }

  /**
   * Returns the ID of the request this response is for.
   * @throws Error if the ID is not known
   */
  expectId(): ARID {
    return this._response.expectId();
  }

  /**
   * Returns the result envelope if this is a successful response.
   * @throws Error if this is a failure response
   */
  result(): Envelope {
    return this._response.result();
  }

  /**
   * Extracts the result as a specific type.
   */
  extractResult<T>(decoder: (cbor: unknown) => T): T {
    return this._response.extractResult(decoder);
  }

  /**
   * Returns the error envelope if this is a failure response.
   * @throws Error if this is a successful response
   */
  error(): Envelope {
    return this._response.error();
  }

  /**
   * Extracts the error as a specific type.
   */
  extractError<T>(decoder: (cbor: unknown) => T): T {
    return this._response.extractError(decoder);
  }

  // ============================================================================
  // Envelope methods
  // ============================================================================

  /**
   * Creates an envelope that can be decrypted by zero or one recipient.
   *
   * @param validUntil - Optional expiration date for the continuation
   * @param signer - Optional signer for the envelope
   * @param recipient - Optional recipient XID document for encryption
   * @returns The sealed response as an envelope
   */
  toEnvelope(validUntil?: Date, signer?: Signer, recipient?: XIDDocument): Envelope {
    const recipients: XIDDocument[] = recipient !== undefined ? [recipient] : [];
    return this.toEnvelopeForRecipients(validUntil, signer, recipients);
  }

  /**
   * Creates an envelope that can be decrypted by zero or more recipients.
   *
   * @param validUntil - Optional expiration date for the continuation
   * @param signer - Optional signer for the envelope
   * @param recipients - Array of recipient XID documents for encryption
   * @returns The sealed response as an envelope
   */
  toEnvelopeForRecipients(
    validUntil?: Date,
    signer?: Signer,
    recipients?: XIDDocument[],
  ): Envelope {
    // Build sender continuation only if state is present
    let senderContinuation: Envelope | undefined;
    if (this._state !== undefined) {
      const continuation = new Continuation(this._state, undefined, validUntil);

      // Get sender's encryption key (from inception key)
      const senderInceptionKey = this._sender.inceptionKey();
      const senderEncryptionKey = senderInceptionKey?.publicKeys()?.encapsulationPublicKey();
      if (senderEncryptionKey === undefined) {
        throw GstpError.senderMissingEncryptionKey();
      }

      senderContinuation = continuation.toEnvelope(senderEncryptionKey);
    }

    // Build the response envelope
    let result = this._response.toEnvelope();

    // Add sender assertion
    result = result.addAssertion(SENDER, this._sender.toEnvelope());

    // Add sender continuation if present
    if (senderContinuation !== undefined) {
      result = result.addAssertion(SENDER_CONTINUATION, senderContinuation);
    }

    // Add peer continuation if present
    if (this._peerContinuation !== undefined) {
      result = result.addAssertion(RECIPIENT_CONTINUATION, this._peerContinuation);
    }

    // Sign if signer provided (sign() wraps first, then adds signature)
    if (signer !== undefined) {
      result = result.sign(signer);
    }

    // Encrypt to recipients if provided
    if (recipients !== undefined && recipients.length > 0) {
      const recipientKeys = recipients.map((recipient) => {
        const key = recipient.encryptionKey();
        if (key === undefined) {
          throw GstpError.recipientMissingEncryptionKey();
        }
        return key;
      });

      result = result.wrap().encryptSubjectToRecipients(recipientKeys);
    }

    return result;
  }

  /**
   * Parses a sealed response from an encrypted envelope.
   *
   * @param encryptedEnvelope - The encrypted envelope to parse
   * @param expectedId - Optional expected request ID for validation
   * @param now - Optional current time for continuation validation
   * @param recipientPrivateKey - The recipient's private keys for decryption
   * @returns The parsed sealed response
   */
  static tryFromEncryptedEnvelope(
    encryptedEnvelope: Envelope,
    expectedId: ARID | undefined,
    now: Date | undefined,
    recipientPrivateKey: PrivateKeys,
  ): SealedResponse {
    // Decrypt the envelope
    let signedEnvelope: Envelope;
    try {
      signedEnvelope = encryptedEnvelope.decryptToRecipient(recipientPrivateKey);
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    // Extract sender from the unwrapped envelope
    let sender: XIDDocument;
    try {
      const unwrapped = signedEnvelope.tryUnwrap();
      const senderEnvelope = unwrapped.objectForPredicate(SENDER);
      if (senderEnvelope === undefined) {
        throw new Error("Missing sender");
      }
      sender = XIDDocument.fromEnvelope(senderEnvelope);
    } catch (e) {
      throw GstpError.xid(e instanceof Error ? e : new Error(String(e)));
    }

    // Get sender's verification key and verify signature (from inception key)
    const senderInceptionKey = sender.inceptionKey();
    const senderVerificationKey = senderInceptionKey?.publicKeys()?.signingPublicKey();
    if (senderVerificationKey === undefined) {
      throw GstpError.senderMissingVerificationKey();
    }

    let responseEnvelope: Envelope;
    try {
      // verify() both verifies the signature AND unwraps the envelope
      responseEnvelope = signedEnvelope.verify(senderVerificationKey);
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    // Get peer continuation (sender_continuation from the response)
    const peerContinuation = responseEnvelope.optionalObjectForPredicate(SENDER_CONTINUATION);
    if (peerContinuation !== undefined) {
      // Verify peer continuation is encrypted
      if (!peerContinuation.subject().isEncrypted()) {
        throw GstpError.peerContinuationNotEncrypted();
      }
    }

    // Get and decrypt our continuation (recipient_continuation)
    const encryptedContinuation =
      responseEnvelope.optionalObjectForPredicate(RECIPIENT_CONTINUATION);
    let state: Envelope | undefined;
    if (encryptedContinuation !== undefined) {
      const continuation = Continuation.tryFromEnvelope(
        encryptedContinuation,
        expectedId,
        now,
        recipientPrivateKey,
      );
      // Check if state is null
      const stateEnv = continuation.state();
      if (stateEnv.isNull()) {
        state = undefined;
      } else {
        state = stateEnv;
      }
    }

    // Parse the response
    let response: Response;
    try {
      response = Response.fromEnvelope(responseEnvelope);
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    return new SealedResponse(response, sender, state, peerContinuation);
  }

  // ============================================================================
  // Display methods
  // ============================================================================

  /**
   * Returns a string representation of the sealed response.
   */
  toString(): string {
    const stateStr = this._state !== undefined ? this._state.formatFlat() : "None";
    const peerStr = this._peerContinuation !== undefined ? "Some" : "None";
    return `SealedResponse(${this._response.summary()}, state: ${stateStr}, peer_continuation: ${peerStr})`;
  }

  /**
   * Checks equality with another sealed response.
   */
  equals(other: SealedResponse): boolean {
    if (!this._response.equals(other._response)) {
      return false;
    }
    if (!this._sender.xid().equals(other._sender.xid())) {
      return false;
    }
    // Compare state
    if (this._state === undefined && other._state === undefined) {
      // Both undefined, equal
    } else if (this._state !== undefined && other._state !== undefined) {
      if (!this._state.digest().equals(other._state.digest())) {
        return false;
      }
    } else {
      return false;
    }
    // Compare peer continuation
    if (this._peerContinuation === undefined && other._peerContinuation === undefined) {
      // Both undefined, equal
    } else if (this._peerContinuation !== undefined && other._peerContinuation !== undefined) {
      if (!this._peerContinuation.digest().equals(other._peerContinuation.digest())) {
        return false;
      }
    } else {
      return false;
    }
    return true;
  }
}
