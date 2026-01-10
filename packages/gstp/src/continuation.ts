/**
 * Continuation - Encrypted State Continuations (ESC)
 *
 * Continuations embed encrypted state data directly into messages,
 * eliminating the need for local state storage and enhancing security
 * for devices with limited storage or requiring distributed state management.
 *
 * Ported from gstp-rust/src/continuation.rs
 */

import { ARID, type Encrypter, type PrivateKeys } from "@bcts/components";
import { Envelope, type EnvelopeEncodableValue } from "@bcts/envelope";
import { ID, VALID_UNTIL } from "@bcts/known-values";
import { GstpError } from "./error";

/**
 * Represents an encrypted state continuation.
 *
 * Continuations provide a way to maintain state across message exchanges
 * without requiring local storage. The state is encrypted and embedded
 * directly in the message envelope.
 *
 * @example
 * ```typescript
 * import { Continuation } from '@bcts/gstp';
 *
 * // Create a continuation with state
 * const continuation = new Continuation("session state data")
 *   .withValidId(requestId)
 *   .withValidUntil(new Date(Date.now() + 60000)); // Valid for 60 seconds
 *
 * // Convert to envelope (optionally encrypted)
 * const envelope = continuation.toEnvelope(recipientPublicKey);
 * ```
 */
export class Continuation {
  private readonly _state: Envelope;
  private readonly _validId: ARID | undefined;
  private readonly _validUntil: Date | undefined;

  /**
   * Creates a new Continuation with the given state.
   *
   * The state can be any value that implements EnvelopeEncodable.
   *
   * @param state - The state to embed in the continuation
   * @param validId - Optional ID for validation
   * @param validUntil - Optional expiration date
   */
  constructor(state: EnvelopeEncodableValue, validId?: ARID, validUntil?: Date) {
    this._state = Envelope.new(state);
    this._validId = validId;
    this._validUntil = validUntil;
  }

  /**
   * Creates a new continuation with a specific valid ID.
   *
   * @param validId - The ID to use for validation
   * @returns A new Continuation instance with the valid ID set
   */
  withValidId(validId: ARID): Continuation {
    return new Continuation(this._state, validId, this._validUntil);
  }

  /**
   * Creates a new continuation with an optional valid ID.
   *
   * @param validId - The ID to use for validation, or undefined
   * @returns A new Continuation instance with the valid ID set
   */
  withOptionalValidId(validId: ARID | undefined): Continuation {
    return new Continuation(this._state, validId, this._validUntil);
  }

  /**
   * Creates a new continuation with a specific valid until date.
   *
   * @param validUntil - The date until which the continuation is valid
   * @returns A new Continuation instance with the valid until date set
   */
  withValidUntil(validUntil: Date): Continuation {
    return new Continuation(this._state, this._validId, validUntil);
  }

  /**
   * Creates a new continuation with an optional valid until date.
   *
   * @param validUntil - The date until which the continuation is valid, or undefined
   * @returns A new Continuation instance with the valid until date set
   */
  withOptionalValidUntil(validUntil: Date | undefined): Continuation {
    return new Continuation(this._state, this._validId, validUntil);
  }

  /**
   * Creates a new continuation with a validity duration from now.
   *
   * @param durationMs - The duration in milliseconds for which the continuation is valid
   * @returns A new Continuation instance with the valid until date set
   */
  withValidDuration(durationMs: number): Continuation {
    const validUntil = new Date(Date.now() + durationMs);
    return new Continuation(this._state, this._validId, validUntil);
  }

  /**
   * Returns the state envelope of the continuation.
   */
  state(): Envelope {
    return this._state;
  }

  /**
   * Returns the valid ID of the continuation, if set.
   */
  id(): ARID | undefined {
    return this._validId;
  }

  /**
   * Returns the valid until date of the continuation, if set.
   */
  validUntil(): Date | undefined {
    return this._validUntil;
  }

  /**
   * Checks if the continuation is valid at the given time.
   *
   * If no valid_until is set, always returns true.
   * If no time is provided, always returns true.
   *
   * @param now - The time to check against, or undefined to skip time validation
   * @returns true if the continuation is valid at the given time
   */
  isValidDate(now?: Date): boolean {
    if (this._validUntil === undefined) {
      return true;
    }
    if (now === undefined) {
      return true;
    }
    return now.getTime() <= this._validUntil.getTime();
  }

  /**
   * Checks if the continuation has the expected ID.
   *
   * If no valid_id is set, always returns true.
   * If no ID is provided for checking, always returns true.
   *
   * @param id - The ID to check against, or undefined to skip ID validation
   * @returns true if the continuation has the expected ID
   */
  isValidId(id?: ARID): boolean {
    if (this._validId === undefined) {
      return true;
    }
    if (id === undefined) {
      return true;
    }
    return this._validId.equals(id);
  }

  /**
   * Checks if the continuation is valid (both date and ID).
   *
   * @param now - The time to check against, or undefined to skip time validation
   * @param id - The ID to check against, or undefined to skip ID validation
   * @returns true if the continuation is valid
   */
  isValid(now?: Date, id?: ARID): boolean {
    return this.isValidDate(now) && this.isValidId(id);
  }

  /**
   * Converts the continuation to an envelope.
   *
   * If a recipient is provided, the envelope is encrypted to that recipient.
   *
   * @param recipient - Optional recipient to encrypt the envelope to
   * @returns The continuation as an envelope
   */
  toEnvelope(recipient?: Encrypter): Envelope {
    let envelope = this._state;

    // Add ID assertion if set
    if (this._validId !== undefined) {
      envelope = envelope.addAssertion(ID, this._validId);
    }

    // Add valid_until assertion if set
    if (this._validUntil !== undefined) {
      envelope = envelope.addAssertion(VALID_UNTIL, this._validUntil.toISOString());
    }

    // Encrypt to recipient if provided
    if (recipient !== undefined) {
      envelope = envelope.encryptToRecipients([recipient]);
    }

    return envelope;
  }

  /**
   * Parses a continuation from an envelope.
   *
   * @param encryptedEnvelope - The envelope to parse
   * @param expectedId - Optional ID to validate against
   * @param now - Optional time to validate against
   * @param recipient - Optional private keys to decrypt with
   * @returns The parsed continuation
   * @throws GstpError if validation fails or parsing fails
   */
  static tryFromEnvelope(
    encryptedEnvelope: Envelope,
    expectedId?: ARID,
    now?: Date,
    recipient?: PrivateKeys,
  ): Continuation {
    // Decrypt if recipient is provided
    let envelope = encryptedEnvelope;
    if (recipient !== undefined) {
      try {
        envelope = encryptedEnvelope.decryptToRecipient(recipient);
      } catch (e) {
        throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
      }
    }

    // Extract the state (the subject of the envelope)
    const state = envelope.subject();

    // Extract optional ID
    let validId: ARID | undefined;
    try {
      const idObj = envelope.objectForPredicate(ID);
      if (idObj !== undefined) {
        // The ID is stored as a leaf envelope containing the ARID's tagged CBOR
        const leafCbor = idObj.asLeaf();
        if (leafCbor !== undefined) {
          validId = ARID.fromTaggedCborData(leafCbor.toData());
        }
      }
    } catch {
      // ID is optional
    }

    // Extract optional valid_until
    let validUntil: Date | undefined;
    try {
      const validUntilObj = envelope.objectForPredicate(VALID_UNTIL);
      if (validUntilObj !== undefined) {
        const dateStr = validUntilObj.asText();
        if (dateStr !== undefined) {
          validUntil = new Date(dateStr);
        }
      }
    } catch {
      // valid_until is optional
    }

    // Create the continuation
    const continuation = new Continuation(state, validId, validUntil);

    // Validate date
    if (!continuation.isValidDate(now)) {
      throw GstpError.continuationExpired();
    }

    // Validate ID
    if (!continuation.isValidId(expectedId)) {
      throw GstpError.continuationIdInvalid();
    }

    return continuation;
  }

  /**
   * Checks equality with another continuation.
   *
   * Two continuations are equal if they have the same state, ID, and valid_until.
   *
   * @param other - The continuation to compare with
   * @returns true if the continuations are equal
   */
  equals(other: Continuation): boolean {
    // Compare state envelopes by their digests
    if (!this._state.digest().equals(other._state.digest())) {
      return false;
    }

    // Compare IDs
    if (this._validId === undefined && other._validId === undefined) {
      // Both undefined, equal
    } else if (this._validId !== undefined && other._validId !== undefined) {
      if (!this._validId.equals(other._validId)) {
        return false;
      }
    } else {
      // One is undefined, one is not
      return false;
    }

    // Compare valid_until
    if (this._validUntil === undefined && other._validUntil === undefined) {
      // Both undefined, equal
    } else if (this._validUntil !== undefined && other._validUntil !== undefined) {
      if (this._validUntil.getTime() !== other._validUntil.getTime()) {
        return false;
      }
    } else {
      // One is undefined, one is not
      return false;
    }

    return true;
  }

  /**
   * Returns a string representation of the continuation.
   */
  toString(): string {
    const parts = [`Continuation(state: ${this._state.formatFlat()}`];
    if (this._validId !== undefined) {
      parts.push(`id: ${this._validId.shortDescription()}`);
    }
    if (this._validUntil !== undefined) {
      parts.push(`validUntil: ${this._validUntil.toISOString()}`);
    }
    return `${parts.join(", ")})`;
  }
}
