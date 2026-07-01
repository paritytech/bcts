/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Continuation - Encrypted State Continuations (ESC)
 *
 * Continuations embed encrypted state data directly into messages,
 * eliminating the need for local state storage and enhancing security
 * for devices with limited storage or requiring distributed state management.
 *
 * Ported from gstp-rust/src/continuation.rs.
 *
 * Wire shape — mirrors Rust:
 * ```
 * {
 *     <state envelope>
 * } [
 *     'id': ARID(...)
 *     'validUntil': Date(...)        ← CBOR tag 1, not ISO 8601 text
 * ]
 * ```
 *
 * The `state` envelope is **wrapped** before assertions are attached,
 * matching Rust `self.state.wrap().add_optional_assertion(...)`. The
 * earlier port attached the assertions directly to the un-wrapped state,
 * producing a different digest tree.
 */

import { ARID, type Encrypter, type PrivateKeys } from "@bcts/components";
import { Envelope, type EnvelopeEncodableValue } from "@bcts/envelope";
import { CborDate } from "@bcts/dcbor";
import type { Cbor } from "@bcts/dcbor";
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
   * Mirrors Rust `is_valid_date(now)`: at the exact `valid_until`
   * instant, the continuation is **expired** (returns `false`). The
   * earlier port used `<=` here, which differed from Rust by one
   * millisecond at the boundary.
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
    // Strict `<` mirrors Rust `valid_until > now`.
    return now.getTime() < this._validUntil.getTime();
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
   * Mirrors Rust `Continuation::to_envelope`:
   *
   * ```rust
   * self.state.wrap()
   *     .add_optional_assertion(ID, self.valid_id)
   *     .add_optional_assertion(VALID_UNTIL, self.valid_until)
   * ```
   *
   * The state is wrapped first; the optional assertions then live on
   * the wrap node. `valid_until` is encoded as a CBOR-tagged Date
   * (tag 1) — never as a plain ISO 8601 string.
   *
   * @param recipient - Optional recipient to encrypt the envelope to
   * @returns The continuation as an envelope
   */
  toEnvelope(recipient?: Encrypter): Envelope {
    let envelope = this._state.wrap();

    if (this._validId !== undefined) {
      envelope = envelope.addAssertion(ID, this._validId);
    }

    if (this._validUntil !== undefined) {
      // Pass a tagged-CBOR Date; mirrors Rust `Date → CBOR` (tag 1).
      envelope = envelope.addAssertion(VALID_UNTIL, CborDate.fromDatetime(this._validUntil));
    }

    if (recipient !== undefined) {
      envelope = envelope.encryptToRecipients([recipient]);
    }

    return envelope;
  }

  /**
   * Parses a continuation from an envelope.
   *
   * Mirrors Rust `Continuation::try_from_envelope`:
   *
   * ```rust
   * state: envelope.try_unwrap()?,                                     // unwrap
   * valid_id: envelope.extract_optional_object_for_predicate(ID)?,
   * valid_until: envelope.extract_optional_object_for_predicate(VALID_UNTIL)?,
   * ```
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
    type EnvelopeExt = Envelope & {
      decryptToRecipient(p: PrivateKeys): Envelope;
      tryUnwrap(): Envelope;
      objectForPredicate(p: unknown): Envelope;
      optionalObjectForPredicate(p: unknown): Envelope | undefined;
      asLeaf(): Cbor | undefined;
    };

    let envelope = encryptedEnvelope as EnvelopeExt;
    if (recipient !== undefined) {
      try {
        envelope = encryptedEnvelope.decryptToRecipient(recipient);
      } catch (e) {
        throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
      }
    }

    // Mirrors Rust `envelope.try_unwrap()?` — peel off the
    // `state.wrap()` introduced in `to_envelope`.
    let state: Envelope;
    try {
      state = envelope.tryUnwrap();
    } catch (e) {
      throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
    }

    let validId: ARID | undefined;
    const idObj = envelope.optionalObjectForPredicate(ID) as EnvelopeExt | undefined;
    if (idObj !== undefined) {
      const leafCbor = idObj.asLeaf();
      if (leafCbor !== undefined) {
        try {
          validId = ARID.fromTaggedCbor(leafCbor);
        } catch (e) {
          throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
        }
      }
    }

    let validUntil: Date | undefined;
    const validUntilObj = envelope.optionalObjectForPredicate(VALID_UNTIL) as
      | EnvelopeExt
      | undefined;
    if (validUntilObj !== undefined) {
      const leafCbor = validUntilObj.asLeaf();
      if (leafCbor !== undefined) {
        try {
          validUntil = CborDate.fromTaggedCbor(leafCbor).datetime();
        } catch (e) {
          throw GstpError.envelope(e instanceof Error ? e : new Error(String(e)));
        }
      }
    }

    const continuation = new Continuation(state, validId, validUntil);

    if (!continuation.isValidDate(now)) {
      throw GstpError.continuationExpired();
    }

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
    if (!this._state.digest().equals(other._state.digest())) {
      return false;
    }

    if (this._validId === undefined && other._validId === undefined) {
      // Both undefined, equal
    } else if (this._validId !== undefined && other._validId !== undefined) {
      if (!this._validId.equals(other._validId)) {
        return false;
      }
    } else {
      return false;
    }

    if (this._validUntil === undefined && other._validUntil === undefined) {
      // Both undefined, equal
    } else if (this._validUntil !== undefined && other._validUntil !== undefined) {
      if (this._validUntil.getTime() !== other._validUntil.getTime()) {
        return false;
      }
    } else {
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
