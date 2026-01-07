/**
 * Event type for notifications and messages.
 *
 * Ported from bc-envelope-rust/src/extension/expressions/event.rs
 *
 * An Event represents a notification or message that doesn't expect a
 * response.
 *
 * Unlike Request and Response which form a pair, an Event is a
 * standalone message that can be used for broadcasting information, logging,
 * or publishing notifications. Events are used when the sender does not expect
 * or require a response from the recipients.
 *
 * Each event contains:
 * - Content of a generic type that holds the event payload
 * - A unique identifier (ARID) for tracking and correlation
 * - Optional metadata like a note and timestamp
 *
 * When serialized to an envelope, events are tagged with EVENT tag.
 */

import { ARID } from "@bcts/components";
import { EVENT as TAG_EVENT } from "@bcts/tags";
import { toTaggedValue } from "@bcts/dcbor";
import {
  CONTENT,
  NOTE,
  DATE,
} from "@bcts/known-values";
import { Envelope } from "../base/envelope";
import { type EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";

/**
 * Interface that defines the behavior of an event.
 */
export interface EventBehavior<T extends EnvelopeEncodableValue> {
  /**
   * Adds a note to the event.
   */
  withNote(note: string): Event<T>;

  /**
   * Adds a date to the event.
   */
  withDate(date: Date): Event<T>;

  /**
   * Returns the content of the event.
   */
  content(): T;

  /**
   * Returns the unique identifier (ARID) of the event.
   */
  id(): ARID;

  /**
   * Returns the note attached to the event, or an empty string if none exists.
   */
  note(): string;

  /**
   * Returns the date attached to the event, if any.
   */
  date(): Date | undefined;

  /**
   * Converts the event to an envelope.
   */
  toEnvelope(): Envelope;
}

/**
 * An Event represents a notification or message that doesn't expect a response.
 *
 * @example
 * ```typescript
 * import { Event, ARID } from '@bcts/envelope';
 *
 * // Create a status update event
 * const eventId = ARID.new();
 * const timestamp = new Date("2024-08-15T13:45:30Z");
 *
 * const statusEvent = Event.new("System online", eventId)
 *   .withNote("Regular status update")
 *   .withDate(timestamp);
 *
 * // Convert to an envelope for transmission
 * const envelope = statusEvent.toEnvelope();
 * ```
 *
 * @typeParam T - The type of content this event carries
 */
export class Event<T extends EnvelopeEncodableValue> implements EventBehavior<T> {
  readonly #content: T;
  readonly #id: ARID;
  #note: string;
  #date: Date | undefined;

  private constructor(content: T, id: ARID, note = "", date?: Date) {
    this.#content = content;
    this.#id = id;
    this.#note = note;
    this.#date = date;
  }

  /**
   * Creates a new event with the specified content and ID.
   */
  static new<T extends EnvelopeEncodableValue>(content: T, id: ARID): Event<T> {
    return new Event(content, id);
  }

  /**
   * Returns a human-readable summary of the event.
   */
  summary(): string {
    const contentEnvelope = Envelope.new(this.#content);
    return `id: ${this.#id.shortDescription()}, content: ${contentEnvelope.formatFlat()}`;
  }

  // EventBehavior implementation

  withNote(note: string): Event<T> {
    this.#note = note;
    return this;
  }

  withDate(date: Date): Event<T> {
    this.#date = date;
    return this;
  }

  content(): T {
    return this.#content;
  }

  id(): ARID {
    return this.#id;
  }

  note(): string {
    return this.#note;
  }

  date(): Date | undefined {
    return this.#date;
  }

  /**
   * Converts the event to an envelope.
   *
   * The envelope's subject is the event's ID tagged with TAG_EVENT,
   * and assertions include the event's content, note (if not empty), and date
   * (if present).
   */
  toEnvelope(): Envelope {
    const taggedArid = toTaggedValue(TAG_EVENT.value, this.#id.untaggedCbor());
    const contentEnvelope = Envelope.new(this.#content);

    let envelope = Envelope.newLeaf(taggedArid).addAssertion(CONTENT, contentEnvelope);

    if (this.#note !== "") {
      envelope = envelope.addAssertion(NOTE, this.#note);
    }

    if (this.#date !== undefined) {
      envelope = envelope.addAssertion(DATE, this.#date.toISOString());
    }

    return envelope;
  }

  /**
   * Creates an event from an envelope.
   *
   * @typeParam T - The type to extract the content as
   */
  static fromEnvelope<T extends EnvelopeEncodableValue>(
    envelope: Envelope,
    contentExtractor: (env: Envelope) => T
  ): Event<T> {
    // Extract content
    const contentEnvelope = envelope.objectForPredicate(CONTENT);
    if (contentEnvelope === undefined) {
      throw EnvelopeError.general("Event envelope missing content");
    }
    const content = contentExtractor(contentEnvelope);

    // TODO: Extract ARID from tagged subject properly
    const id = ARID.new(); // Placeholder

    // Extract optional note
    let note = "";
    try {
      const noteObj = envelope.objectForPredicate(NOTE);
      if (noteObj !== undefined) {
        note = noteObj.asText() ?? "";
      }
    } catch {
      // Note is optional
    }

    // Extract optional date
    let date: Date | undefined;
    try {
      const dateObj = envelope.objectForPredicate(DATE);
      if (dateObj !== undefined) {
        const dateStr = dateObj.asText();
        if (dateStr !== undefined) {
          date = new Date(dateStr);
        }
      }
    } catch {
      // Date is optional
    }

    return new Event(content, id, note, date);
  }

  /**
   * Creates a string event from an envelope.
   */
  static stringFromEnvelope(envelope: Envelope): Event<string> {
    return Event.fromEnvelope<string>(envelope, (env) => env.asText() ?? "");
  }

  /**
   * Returns a string representation of the event.
   */
  toString(): string {
    return `Event(${this.summary()})`;
  }

  /**
   * Checks equality with another event.
   */
  equals(other: Event<T>): boolean {
    return (
      this.#id.equals(other.#id) &&
      this.#note === other.#note &&
      this.#date?.getTime() === other.#date?.getTime()
    );
  }
}
