/**
 * SealedRequest - Sealed request messages for GSTP
 *
 * A SealedRequest wraps a Request with sender information and state
 * continuations for secure, authenticated request messages.
 *
 * Ported from gstp-rust/src/sealed_request.rs
 */

import type { ARID, PrivateKeys, Signer } from "@bcts/components";
import {
  Envelope,
  Request,
  type Expression,
  type Function,
  type EnvelopeEncodableValue,
  type ParameterID,
} from "@bcts/envelope";
import { SENDER, SENDER_CONTINUATION, RECIPIENT_CONTINUATION } from "@bcts/known-values";
import { XIDDocument } from "@bcts/xid";
import { Continuation } from "./continuation";
import { GstpError } from "./error";

/**
 * Interface that defines the behavior of a sealed request.
 *
 * Extends RequestBehavior with additional methods for managing
 * sender information and state continuations.
 */
export interface SealedRequestBehavior {
  /**
   * Adds state to the request that the receiver must return in the response.
   */
  withState(state: EnvelopeEncodableValue): SealedRequest;

  /**
   * Adds optional state to the request.
   */
  withOptionalState(state: EnvelopeEncodableValue | undefined): SealedRequest;

  /**
   * Adds a continuation previously received from the recipient.
   */
  withPeerContinuation(peerContinuation: Envelope): SealedRequest;

  /**
   * Adds an optional continuation previously received from the recipient.
   */
  withOptionalPeerContinuation(peerContinuation: Envelope | undefined): SealedRequest;

  /**
   * Returns the underlying request.
   */
  request(): Request;

  /**
   * Returns the sender of the request.
   */
  sender(): XIDDocument;

  /**
   * Returns the state to be sent to the recipient.
   */
  state(): Envelope | undefined;

  /**
   * Returns the continuation received from the recipient.
   */
  peerContinuation(): Envelope | undefined;
}

/**
 * A sealed request that combines a Request with sender information and
 * state continuations for secure communication.
 *
 * @example
 * ```typescript
 * import { SealedRequest, ARID } from '@bcts/gstp';
 * import { XIDDocument } from '@bcts/xid';
 *
 * // Create sender XID document
 * const sender = XIDDocument.new();
 * const requestId = ARID.new();
 *
 * // Create a sealed request
 * const request = SealedRequest.new("getBalance", requestId, sender)
 *   .withParameter("account", "alice")
 *   .withState("session-state-data")
 *   .withNote("Balance check");
 *
 * // Convert to sealed envelope
 * const envelope = request.toEnvelope(
 *   new Date(Date.now() + 60000), // Valid for 60 seconds
 *   senderPrivateKey,
 *   recipientXIDDocument
 * );
 * ```
 */
export class SealedRequest implements SealedRequestBehavior {
  private _request: Request;
  private readonly _sender: XIDDocument;
  private _state: Envelope | undefined;
  private _peerContinuation: Envelope | undefined;

  private constructor(
    request: Request,
    sender: XIDDocument,
    state?: Envelope,
    peerContinuation?: Envelope,
  ) {
    this._request = request;
    this._sender = sender;
    this._state = state;
    this._peerContinuation = peerContinuation;
  }

  /**
   * Creates a new sealed request with the given function, ID, and sender.
   *
   * @param func - The function to call (string name or Function object)
   * @param id - The request ID
   * @param sender - The sender's XID document
   */
  static new(func: string | number | Function, id: ARID, sender: XIDDocument): SealedRequest {
    return new SealedRequest(Request.new(func, id), sender);
  }

  /**
   * Creates a new sealed request with an expression body.
   *
   * @param body - The expression body
   * @param id - The request ID
   * @param sender - The sender's XID document
   */
  static newWithBody(body: Expression, id: ARID, sender: XIDDocument): SealedRequest {
    return new SealedRequest(Request.newWithBody(body, id), sender);
  }

  // ============================================================================
  // ExpressionBehavior implementation
  // ============================================================================

  /**
   * Adds a parameter to the request.
   */
  withParameter(parameter: ParameterID, value: EnvelopeEncodableValue): SealedRequest {
    this._request = this._request.withParameter(parameter, value);
    return this;
  }

  /**
   * Adds an optional parameter to the request.
   */
  withOptionalParameter(
    parameter: ParameterID,
    value: EnvelopeEncodableValue | undefined,
  ): SealedRequest {
    if (value !== undefined) {
      this._request = this._request.withParameter(parameter, value);
    }
    return this;
  }

  /**
   * Returns the function of the request.
   */
  function(): Function {
    return this._request.function();
  }

  /**
   * Returns the expression envelope of the request.
   */
  expressionEnvelope(): Envelope {
    return this._request.expressionEnvelope();
  }

  /**
   * Returns the object for a parameter.
   */
  objectForParameter(param: ParameterID): Envelope | undefined {
    return this._request.body().getParameter(param);
  }

  /**
   * Returns all objects for a parameter.
   */
  objectsForParameter(param: ParameterID): Envelope[] {
    const obj = this._request.body().getParameter(param);
    return obj !== undefined ? [obj] : [];
  }

  /**
   * Extracts an object for a parameter as a specific type.
   */
  extractObjectForParameter<T>(param: ParameterID): T {
    const envelope = this.objectForParameter(param);
    if (envelope === undefined) {
      throw GstpError.envelope(new Error(`Parameter not found: ${param}`));
    }
    return envelope.extractSubject((cbor) => {
      // Extract primitive value from CBOR
      if (cbor.isInteger()) return cbor.toInteger() as T;
      if (cbor.isText()) return cbor.toText() as T;
      if (cbor.isBool()) return cbor.toBool() as T;
      if (cbor.isNumber()) return cbor.toNumber() as T;
      if (cbor.isByteString()) return cbor.toByteString() as T;
      return cbor as T;
    });
  }

  /**
   * Extracts an optional object for a parameter.
   */
  extractOptionalObjectForParameter<T>(param: ParameterID): T | undefined {
    const envelope = this.objectForParameter(param);
    if (envelope === undefined) {
      return undefined;
    }
    return envelope.extractSubject((cbor) => {
      // Extract primitive value from CBOR
      if (cbor.isInteger()) return cbor.toInteger() as T;
      if (cbor.isText()) return cbor.toText() as T;
      if (cbor.isBool()) return cbor.toBool() as T;
      if (cbor.isNumber()) return cbor.toNumber() as T;
      if (cbor.isByteString()) return cbor.toByteString() as T;
      return cbor as T;
    });
  }

  /**
   * Extracts all objects for a parameter as a specific type.
   */
  extractObjectsForParameter<T>(param: ParameterID): T[] {
    return this.objectsForParameter(param).map((env) => env.extractSubject((cbor) => cbor as T));
  }

  // ============================================================================
  // RequestBehavior implementation
  // ============================================================================

  /**
   * Adds a note to the request.
   */
  withNote(note: string): SealedRequest {
    this._request = this._request.withNote(note);
    return this;
  }

  /**
   * Adds a date to the request.
   */
  withDate(date: Date): SealedRequest {
    this._request = this._request.withDate(date);
    return this;
  }

  /**
   * Returns the body of the request.
   */
  body(): Expression {
    return this._request.body();
  }

  /**
   * Returns the ID of the request.
   */
  id(): ARID {
    return this._request.id();
  }

  /**
   * Returns the note of the request.
   */
  note(): string {
    return this._request.note();
  }

  /**
   * Returns the date of the request.
   */
  date(): Date | undefined {
    return this._request.date();
  }

  // ============================================================================
  // SealedRequestBehavior implementation
  // ============================================================================

  /**
   * Adds state to the request that the receiver must return in the response.
   */
  withState(state: EnvelopeEncodableValue): SealedRequest {
    this._state = Envelope.new(state);
    return this;
  }

  /**
   * Adds optional state to the request.
   */
  withOptionalState(state: EnvelopeEncodableValue | undefined): SealedRequest {
    this._state = state !== undefined ? Envelope.new(state) : undefined;
    return this;
  }

  /**
   * Adds a continuation previously received from the recipient.
   */
  withPeerContinuation(peerContinuation: Envelope): SealedRequest {
    this._peerContinuation = peerContinuation;
    return this;
  }

  /**
   * Adds an optional continuation previously received from the recipient.
   */
  withOptionalPeerContinuation(peerContinuation: Envelope | undefined): SealedRequest {
    this._peerContinuation = peerContinuation;
    return this;
  }

  /**
   * Returns the underlying request.
   */
  request(): Request {
    return this._request;
  }

  /**
   * Returns the sender of the request.
   */
  sender(): XIDDocument {
    return this._sender;
  }

  /**
   * Returns the state to be sent to the recipient.
   */
  state(): Envelope | undefined {
    return this._state;
  }

  /**
   * Returns the continuation received from the recipient.
   */
  peerContinuation(): Envelope | undefined {
    return this._peerContinuation;
  }

  // ============================================================================
  // Conversion methods
  // ============================================================================

  /**
   * Converts the sealed request to a Request.
   */
  toRequest(): Request {
    return this._request;
  }

  /**
   * Converts the sealed request to an Expression.
   */
  toExpression(): Expression {
    return this._request.body();
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
   * @returns The sealed request as an envelope
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
   * @returns The sealed request as an envelope
   */
  toEnvelopeForRecipients(
    validUntil?: Date,
    signer?: Signer,
    recipients?: XIDDocument[],
  ): Envelope {
    // Even if no state is provided, requests always include a continuation
    // that at least specifies the required valid response ID.
    const stateEnvelope = this._state ?? Envelope.new(null);
    const continuation = new Continuation(stateEnvelope, this.id(), validUntil);

    // Get sender's encryption key (from inception key)
    const senderInceptionKey = this._sender.inceptionKey();
    const senderEncryptionKey = senderInceptionKey?.publicKeys()?.encapsulationPublicKey();
    if (senderEncryptionKey === undefined) {
      throw GstpError.senderMissingEncryptionKey();
    }

    // Create sender continuation (encrypted to sender)
    const senderContinuation = continuation.toEnvelope(senderEncryptionKey);

    // Build the request envelope
    let result = this._request.toEnvelope();

    // Add sender assertion
    result = result.addAssertion(SENDER, this._sender.toEnvelope());

    // Add sender continuation
    result = result.addAssertion(SENDER_CONTINUATION, senderContinuation);

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
   * Parses a sealed request from an encrypted envelope.
   *
   * @param encryptedEnvelope - The encrypted envelope to parse
   * @param expectedId - Optional expected request ID for validation
   * @param now - Optional current time for continuation validation
   * @param recipient - The recipient's private keys for decryption
   * @returns The parsed sealed request
   */
  static tryFromEnvelope(
    encryptedEnvelope: Envelope,
    expectedId: ARID | undefined,
    now: Date | undefined,
    recipient: PrivateKeys,
  ): SealedRequest {
    // Decrypt the envelope
    let signedEnvelope: Envelope;
    try {
      signedEnvelope = encryptedEnvelope.decryptToRecipient(recipient);
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

    let requestEnvelope: Envelope;
    try {
      // verify() both verifies the signature AND unwraps the envelope
      requestEnvelope = signedEnvelope.verify(senderVerificationKey);
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    // Get peer continuation (sender_continuation from the request)
    const peerContinuation = requestEnvelope.optionalObjectForPredicate(SENDER_CONTINUATION);
    if (peerContinuation !== undefined) {
      // Verify peer continuation is encrypted
      if (!peerContinuation.subject().isEncrypted()) {
        throw GstpError.peerContinuationNotEncrypted();
      }
    } else {
      throw GstpError.missingPeerContinuation();
    }

    // Get and decrypt our continuation (recipient_continuation)
    const encryptedContinuation =
      requestEnvelope.optionalObjectForPredicate(RECIPIENT_CONTINUATION);
    let state: Envelope | undefined;
    if (encryptedContinuation !== undefined) {
      const continuation = Continuation.tryFromEnvelope(
        encryptedContinuation,
        expectedId,
        now,
        recipient,
      );
      state = continuation.state();
    }

    // Parse the request
    let request: Request;
    try {
      request = Request.fromEnvelope(requestEnvelope);
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    return new SealedRequest(request, sender, state, peerContinuation);
  }

  // ============================================================================
  // Display methods
  // ============================================================================

  /**
   * Returns a string representation of the sealed request.
   */
  toString(): string {
    const stateStr = this._state !== undefined ? this._state.formatFlat() : "None";
    const peerStr = this._peerContinuation !== undefined ? "Some" : "None";
    return `SealedRequest(${this._request.summary()}, state: ${stateStr}, peer_continuation: ${peerStr})`;
  }

  /**
   * Checks equality with another sealed request.
   */
  equals(other: SealedRequest): boolean {
    if (!this._request.equals(other._request)) {
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
