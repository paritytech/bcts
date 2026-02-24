/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * SealedEvent - Sealed event messages for GSTP
 *
 * A SealedEvent wraps an Event with sender information and state
 * continuations for secure, authenticated event messages.
 *
 * Unlike SealedRequest/SealedResponse which form a pair, SealedEvent
 * is a standalone message for broadcasting information, logging,
 * or publishing notifications.
 *
 * Ported from gstp-rust/src/sealed_event.rs
 */

import type { ARID, PrivateKeys, Signer } from "@bcts/components";
import { Envelope, Event, type EnvelopeEncodableValue } from "@bcts/envelope";
import { SENDER, SENDER_CONTINUATION, RECIPIENT_CONTINUATION } from "@bcts/known-values";
import { XIDDocument } from "@bcts/xid";
import { Continuation } from "./continuation";
import { GstpError } from "./error";

/**
 * Interface that defines the behavior of a sealed event.
 *
 * Extends EventBehavior with additional methods for managing
 * sender information and state continuations.
 */
export interface SealedEventBehavior<T extends EnvelopeEncodableValue> {
  /**
   * Adds state to the event that the receiver must return in the response.
   */
  withState(state: EnvelopeEncodableValue): SealedEvent<T>;

  /**
   * Adds optional state to the event.
   */
  withOptionalState(state: EnvelopeEncodableValue | undefined): SealedEvent<T>;

  /**
   * Adds a continuation previously received from the recipient.
   */
  withPeerContinuation(peerContinuation: Envelope): SealedEvent<T>;

  /**
   * Adds an optional continuation previously received from the recipient.
   */
  withOptionalPeerContinuation(peerContinuation: Envelope | undefined): SealedEvent<T>;

  /**
   * Returns the underlying event.
   */
  event(): Event<T>;

  /**
   * Returns the sender of the event.
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
 * A sealed event that combines an Event with sender information and
 * state continuations for secure communication.
 *
 * @typeParam T - The type of content this event carries
 *
 * @example
 * ```typescript
 * import { SealedEvent, ARID } from '@bcts/gstp';
 * import { XIDDocument } from '@bcts/xid';
 *
 * // Create sender XID document
 * const sender = XIDDocument.new();
 * const eventId = ARID.new();
 *
 * // Create a sealed event
 * const event = SealedEvent.new("System notification", eventId, sender)
 *   .withNote("Status update")
 *   .withDate(new Date());
 *
 * // Convert to sealed envelope
 * const envelope = event.toEnvelope(
 *   new Date(Date.now() + 60000), // Valid for 60 seconds
 *   senderPrivateKey,
 *   recipientXIDDocument
 * );
 * ```
 */
export class SealedEvent<T extends EnvelopeEncodableValue> implements SealedEventBehavior<T> {
  private _event: Event<T>;
  private readonly _sender: XIDDocument;
  private _state: Envelope | undefined;
  private _peerContinuation: Envelope | undefined;

  private constructor(
    event: Event<T>,
    sender: XIDDocument,
    state?: Envelope,
    peerContinuation?: Envelope,
  ) {
    this._event = event;
    this._sender = sender;
    this._state = state;
    this._peerContinuation = peerContinuation;
  }

  /**
   * Creates a new sealed event with the given content, ID, and sender.
   *
   * @param content - The content of the event
   * @param id - The event ID
   * @param sender - The sender's XID document
   */
  static new<T extends EnvelopeEncodableValue>(
    content: T,
    id: ARID,
    sender: XIDDocument,
  ): SealedEvent<T> {
    return new SealedEvent(Event.new(content, id), sender);
  }

  // ============================================================================
  // EventBehavior implementation
  // ============================================================================

  /**
   * Adds a note to the event.
   */
  withNote(note: string): SealedEvent<T> {
    this._event = this._event.withNote(note);
    return this;
  }

  /**
   * Adds a date to the event.
   */
  withDate(date: Date): SealedEvent<T> {
    this._event = this._event.withDate(date);
    return this;
  }

  /**
   * Returns the content of the event.
   */
  content(): T {
    return this._event.content();
  }

  /**
   * Returns the ID of the event.
   */
  id(): ARID {
    return this._event.id();
  }

  /**
   * Returns the note of the event.
   */
  note(): string {
    return this._event.note();
  }

  /**
   * Returns the date of the event.
   */
  date(): Date | undefined {
    return this._event.date();
  }

  // ============================================================================
  // SealedEventBehavior implementation
  // ============================================================================

  /**
   * Adds state to the event that the receiver must return in the response.
   */
  withState(state: EnvelopeEncodableValue): SealedEvent<T> {
    this._state = Envelope.new(state);
    return this;
  }

  /**
   * Adds optional state to the event.
   */
  withOptionalState(state: EnvelopeEncodableValue | undefined): SealedEvent<T> {
    if (state !== undefined) {
      return this.withState(state);
    }
    this._state = undefined;
    return this;
  }

  /**
   * Adds a continuation previously received from the recipient.
   */
  withPeerContinuation(peerContinuation: Envelope): SealedEvent<T> {
    this._peerContinuation = peerContinuation;
    return this;
  }

  /**
   * Adds an optional continuation previously received from the recipient.
   */
  withOptionalPeerContinuation(peerContinuation: Envelope | undefined): SealedEvent<T> {
    this._peerContinuation = peerContinuation;
    return this;
  }

  /**
   * Returns the underlying event.
   */
  event(): Event<T> {
    return this._event;
  }

  /**
   * Returns the sender of the event.
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
   * Converts the sealed event to an Event.
   */
  toEvent(): Event<T> {
    return this._event;
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
   * @returns The sealed event as an envelope
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
   * @returns The sealed event as an envelope
   */
  toEnvelopeForRecipients(
    validUntil?: Date,
    signer?: Signer,
    recipients?: XIDDocument[],
  ): Envelope {
    // Get sender's encryption key (from inception key)
    const senderInceptionKey = this._sender.inceptionKey();
    const senderEncryptionKey = senderInceptionKey?.publicKeys()?.encapsulationPublicKey();
    if (senderEncryptionKey === undefined) {
      throw GstpError.senderMissingEncryptionKey();
    }

    // Build sender continuation
    let senderContinuation: Envelope | undefined;
    if (this._state !== undefined) {
      // If state is present, create continuation with state and optional valid_until
      const continuation = new Continuation(this._state, undefined, validUntil);
      senderContinuation = continuation.toEnvelope(senderEncryptionKey);
    } else if (validUntil !== undefined) {
      // If only valid_until is present (no state), create continuation with null state
      const continuation = new Continuation(Envelope.new(null), undefined, validUntil);
      senderContinuation = continuation.toEnvelope(senderEncryptionKey);
    }

    // Build the event envelope
    let result = this._event.toEnvelope();

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
   * Parses a sealed event from an encrypted envelope.
   *
   * @param encryptedEnvelope - The encrypted envelope to parse
   * @param expectedId - Optional expected event ID for validation
   * @param now - Optional current time for continuation validation
   * @param recipientPrivateKey - The recipient's private keys for decryption
   * @param contentExtractor - Function to extract content from envelope
   * @returns The parsed sealed event
   */
  static tryFromEnvelope<T extends EnvelopeEncodableValue>(
    encryptedEnvelope: Envelope,
    expectedId: ARID | undefined,
    now: Date | undefined,
    recipientPrivateKey: PrivateKeys,
    contentExtractor?: (env: Envelope) => T,
  ): SealedEvent<T> {
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

    let eventEnvelope: Envelope;
    try {
      // verify() both verifies the signature AND unwraps the envelope
      eventEnvelope = signedEnvelope.verify(senderVerificationKey);
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    // Get peer continuation (sender_continuation from the event)
    const peerContinuation = eventEnvelope.optionalObjectForPredicate(SENDER_CONTINUATION);
    if (peerContinuation !== undefined) {
      // Verify peer continuation is encrypted
      if (!peerContinuation.subject().isEncrypted()) {
        throw GstpError.peerContinuationNotEncrypted();
      }
    }

    // Get and decrypt our continuation (recipient_continuation)
    const encryptedContinuation = eventEnvelope.optionalObjectForPredicate(RECIPIENT_CONTINUATION);
    let state: Envelope | undefined;
    if (encryptedContinuation !== undefined) {
      const continuation = Continuation.tryFromEnvelope(
        encryptedContinuation,
        expectedId,
        now,
        recipientPrivateKey,
      );
      state = continuation.state();
    }

    // Parse the event
    let event: Event<T>;
    try {
      // Use the content extractor if provided, otherwise use default string extraction
      if (contentExtractor !== undefined) {
        event = Event.fromEnvelope(eventEnvelope, contentExtractor);
      } else {
        // Default to string extraction
        event = Event.stringFromEnvelope(eventEnvelope) as unknown as Event<T>;
      }
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    return new SealedEvent(event, sender, state, peerContinuation);
  }

  // ============================================================================
  // Display methods
  // ============================================================================

  /**
   * Returns a string representation of the sealed event.
   */
  toString(): string {
    const stateStr = this._state !== undefined ? this._state.formatFlat() : "None";
    const peerStr = this._peerContinuation !== undefined ? "Some" : "None";
    return `SealedEvent(${this._event.summary()}, state: ${stateStr}, peer_continuation: ${peerStr})`;
  }

  /**
   * Checks equality with another sealed event.
   */
  equals(other: SealedEvent<T>): boolean {
    if (!this._event.equals(other._event)) {
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
