/**
 * Request type for distributed function calls.
 *
 * Ported from bc-envelope-rust/src/extension/expressions/request.rs
 *
 * A Request represents a message requesting execution of a function with
 * parameters. Requests are part of the expression system that enables
 * distributed function calls and communication between systems.
 *
 * Each request:
 * - Contains a body (an Expression) that represents the function to be executed
 * - Has a unique identifier (ARID) for tracking and correlation
 * - May include optional metadata like a note and timestamp
 *
 * Requests are designed to be paired with Response objects that contain the
 * results of executing the requested function.
 *
 * When serialized to an envelope, requests are tagged with REQUEST tag.
 */

import { ARID } from "@bcts/components";
import { REQUEST as TAG_REQUEST } from "@bcts/tags";
import { toTaggedValue } from "@bcts/dcbor";
import { BODY, NOTE, DATE } from "@bcts/known-values";
import { Envelope } from "../base/envelope";
import { type EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { Expression, Function, type ParameterID } from "./expression";

/**
 * Interface that defines the behavior of a request.
 *
 * This interface extends expression behavior to add methods specific to requests,
 * including metadata management and access to request properties.
 */
export interface RequestBehavior {
  /**
   * Adds a parameter to the request.
   */
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Request;

  /**
   * Adds a note to the request.
   */
  withNote(note: string): Request;

  /**
   * Adds a date to the request.
   */
  withDate(date: Date): Request;

  /**
   * Returns the body of the request (the expression to be evaluated).
   */
  body(): Expression;

  /**
   * Returns the unique identifier (ARID) of the request.
   */
  id(): ARID;

  /**
   * Returns the note attached to the request, or an empty string if none exists.
   */
  note(): string;

  /**
   * Returns the date attached to the request, if any.
   */
  date(): Date | undefined;

  /**
   * Returns the function of the request.
   */
  function(): Function;

  /**
   * Returns the expression envelope of the request.
   */
  expressionEnvelope(): Envelope;

  /**
   * Converts the request to an envelope.
   */
  toEnvelope(): Envelope;
}

/**
 * A Request represents a message requesting execution of a function with parameters.
 *
 * @example
 * ```typescript
 * import { Request, ARID } from '@bcts/envelope';
 *
 * // Create a random request ID
 * const requestId = ARID.new();
 *
 * // Create a request to execute a function with parameters
 * const request = Request.new("getBalance", requestId)
 *   .withParameter("account", "alice")
 *   .withParameter("currency", "USD")
 *   .withNote("Monthly balance check");
 *
 * // Convert to an envelope
 * const envelope = request.toEnvelope();
 * ```
 */
export class Request implements RequestBehavior {
  readonly #body: Expression;
  readonly #id: ARID;
  #note: string;
  #date: Date | undefined;

  private constructor(body: Expression, id: ARID, note = "", date?: Date) {
    this.#body = body;
    this.#id = id;
    this.#note = note;
    this.#date = date;
  }

  /**
   * Creates a new request with the specified expression body and ID.
   */
  static newWithBody(body: Expression, id: ARID): Request {
    return new Request(body, id);
  }

  /**
   * Creates a new request with a function and ID.
   *
   * This is a convenience method that creates an expression from the
   * function and then creates a request with that expression.
   */
  static new(func: Function | string | number, id: ARID): Request {
    const f =
      typeof func === "string"
        ? Function.newNamed(func)
        : typeof func === "number"
          ? Function.newKnown(func)
          : func;
    return Request.newWithBody(new Expression(f), id);
  }

  /**
   * Returns a human-readable summary of the request.
   */
  summary(): string {
    return `id: ${this.#id.shortDescription()}, body: ${this.#body.envelope().formatFlat()}`;
  }

  // RequestBehavior implementation

  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Request {
    this.#body.withParameter(param, value);
    return this;
  }

  withNote(note: string): Request {
    this.#note = note;
    return this;
  }

  withDate(date: Date): Request {
    this.#date = date;
    return this;
  }

  body(): Expression {
    return this.#body;
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

  function(): Function {
    return this.#body.function();
  }

  expressionEnvelope(): Envelope {
    return this.#body.envelope();
  }

  /**
   * Converts the request to an envelope.
   *
   * The envelope's subject is the request's ID tagged with TAG_REQUEST,
   * and assertions include the request's body, note (if not empty), and date (if present).
   */
  toEnvelope(): Envelope {
    // Create the tagged ARID as the subject
    const taggedArid = toTaggedValue(TAG_REQUEST, this.#id.untaggedCbor());

    let envelope = Envelope.newLeaf(taggedArid).addAssertion(BODY, this.#body.envelope());

    if (this.#note !== "") {
      envelope = envelope.addAssertion(NOTE, this.#note);
    }

    if (this.#date !== undefined) {
      envelope = envelope.addAssertion(DATE, this.#date.toISOString());
    }

    return envelope;
  }

  /**
   * Creates a request from an envelope.
   */
  static fromEnvelope(envelope: Envelope, expectedFunction?: Function): Request {
    // Extract the body
    const bodyEnvelope = envelope.objectForPredicate(BODY);
    if (bodyEnvelope === undefined) {
      throw EnvelopeError.general("Request envelope missing body");
    }

    // Parse the expression from the body
    const body = Expression.fromEnvelope(bodyEnvelope);

    // Validate function if expected
    if (expectedFunction !== undefined && !body.function().equals(expectedFunction)) {
      throw EnvelopeError.general("Request function mismatch");
    }

    // Extract the ARID from the subject
    const subject = envelope.subject();
    const leaf = subject.asLeaf();
    if (leaf === undefined) {
      throw EnvelopeError.general("Request envelope has invalid subject");
    }

    // The subject is TAG_REQUEST(ARID_bytes)
    // First expect the REQUEST tag, then extract the ARID from the content
    const aridCbor = leaf.expectTag(TAG_REQUEST);
    const aridBytes = aridCbor.toByteString();
    const id = ARID.fromData(aridBytes);

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

    return new Request(body, id, note, date);
  }

  /**
   * Returns a string representation of the request.
   */
  toString(): string {
    return `Request(${this.summary()})`;
  }

  /**
   * Checks equality with another request.
   */
  equals(other: Request): boolean {
    return (
      this.#id.equals(other.#id) &&
      this.#note === other.#note &&
      this.#date?.getTime() === other.#date?.getTime()
    );
  }
}
