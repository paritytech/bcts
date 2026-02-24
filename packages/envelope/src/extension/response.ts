/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Response type for distributed function calls.
 *
 * Ported from bc-envelope-rust/src/extension/expressions/response.rs
 *
 * A Response represents a reply to a Request containing either a
 * successful result or an error.
 *
 * Responses are part of the expression system that enables distributed
 * function calls. Each response contains:
 * - A reference to the original request's ID (ARID) for correlation
 * - Either a successful result or an error message
 *
 * When serialized to an envelope, responses are tagged with RESPONSE tag.
 */

import { ARID } from "@bcts/components";
import { RESPONSE as TAG_RESPONSE } from "@bcts/tags";
import { toTaggedValue } from "@bcts/dcbor";
import { RESULT, ERROR, OK_VALUE, UNKNOWN_VALUE } from "@bcts/known-values";
import { Envelope } from "../base/envelope";
import { type EnvelopeEncodable, type EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";

/**
 * Type representing a successful response: (ARID, result envelope)
 */
interface SuccessResult {
  ok: true;
  id: ARID;
  result: Envelope;
}

/**
 * Type representing a failed response: (optional ARID, error envelope)
 */
interface FailureResult {
  ok: false;
  id: ARID | undefined;
  error: Envelope;
}

/**
 * Internal result type for Response
 */
type ResponseResult = SuccessResult | FailureResult;

/**
 * Interface that defines the behavior of a response.
 */
export interface ResponseBehavior {
  /**
   * Sets the result value for a successful response.
   * @throws Error if called on a failure response.
   */
  withResult(result: EnvelopeEncodableValue): Response;

  /**
   * Sets the error value for a failure response.
   * @throws Error if called on a successful response.
   */
  withError(error: EnvelopeEncodableValue): Response;

  /**
   * Returns true if this is a successful response.
   */
  isOk(): boolean;

  /**
   * Returns true if this is a failure response.
   */
  isErr(): boolean;

  /**
   * Returns the ID of the request this response corresponds to, if known.
   */
  id(): ARID | undefined;

  /**
   * Returns the result envelope if this is a successful response.
   * @throws Error if this is a failure response.
   */
  result(): Envelope;

  /**
   * Returns the error envelope if this is a failure response.
   * @throws Error if this is a successful response.
   */
  error(): Envelope;

  /**
   * Converts the response to an envelope.
   */
  toEnvelope(): Envelope;
}

/**
 * A Response represents a reply to a Request containing either a
 * successful result or an error.
 *
 * @example
 * ```typescript
 * import { Response, ARID } from '@bcts/envelope';
 *
 * // Create a request ID (normally this would come from the original request)
 * const requestId = ARID.new();
 *
 * // Create a successful response
 * const successResponse = Response.newSuccess(requestId)
 *   .withResult("Transaction completed");
 *
 * // Create an error response
 * const errorResponse = Response.newFailure(requestId)
 *   .withError("Insufficient funds");
 *
 * // Convert to envelopes
 * const successEnvelope = successResponse.toEnvelope();
 * const errorEnvelope = errorResponse.toEnvelope();
 * ```
 */
export class Response implements ResponseBehavior, EnvelopeEncodable {
  private _result: ResponseResult;

  private constructor(result: ResponseResult) {
    this._result = result;
  }

  /**
   * Creates a new successful response with the specified request ID.
   *
   * By default, the result will be the 'OK' known value. Use `withResult`
   * to set a specific result value.
   */
  static newSuccess(id: ARID): Response {
    return new Response({
      ok: true,
      id,
      result: Response.ok(),
    });
  }

  /**
   * Creates a new failure response with the specified request ID.
   *
   * By default, the error will be the 'Unknown' known value. Use
   * `withError` to set a specific error message.
   */
  static newFailure(id: ARID): Response {
    return new Response({
      ok: false,
      id,
      error: Response.unknown(),
    });
  }

  /**
   * Creates a new early failure response without a request ID.
   *
   * An early failure occurs when the error happens before the request
   * has been fully processed, so the request ID is not known.
   */
  static newEarlyFailure(): Response {
    return new Response({
      ok: false,
      id: undefined,
      error: Response.unknown(),
    });
  }

  /**
   * Creates an envelope containing the 'Unknown' known value.
   */
  static unknown(): Envelope {
    return Envelope.new(UNKNOWN_VALUE);
  }

  /**
   * Creates an envelope containing the 'OK' known value.
   */
  static ok(): Envelope {
    return Envelope.new(OK_VALUE);
  }

  /**
   * Returns a human-readable summary of the response.
   */
  summary(): string {
    if (this._result.ok) {
      return `id: ${this._result.id.shortDescription()}, result: ${this._result.result.formatFlat()}`;
    } else {
      const idStr =
        this._result.id !== undefined ? this._result.id.shortDescription() : "'Unknown'";
      return `id: ${idStr}, error: ${this._result.error.formatFlat()}`;
    }
  }

  // ResponseBehavior implementation

  withResult(result: EnvelopeEncodableValue): Response {
    if (!this._result.ok) {
      throw new Error("Cannot set result on a failed response");
    }
    this._result = {
      ok: true,
      id: this._result.id,
      result: Envelope.new(result),
    };
    return this;
  }

  withOptionalResult(result: EnvelopeEncodableValue | undefined): Response {
    if (result !== undefined) {
      return this.withResult(result);
    }
    return this.withResult(null);
  }

  withError(error: EnvelopeEncodableValue): Response {
    if (this._result.ok) {
      throw new Error("Cannot set error on a successful response");
    }
    this._result = {
      ok: false,
      id: this._result.id,
      error: Envelope.new(error),
    };
    return this;
  }

  withOptionalError(error: EnvelopeEncodableValue | undefined): Response {
    if (error !== undefined) {
      return this.withError(error);
    }
    return this;
  }

  isOk(): boolean {
    return this._result.ok;
  }

  isErr(): boolean {
    return !this._result.ok;
  }

  id(): ARID | undefined {
    return this._result.id;
  }

  expectId(): ARID {
    const id = this.id();
    if (id === undefined) {
      throw new Error("Expected an ID");
    }
    return id;
  }

  result(): Envelope {
    if (!this._result.ok) {
      throw EnvelopeError.general("Cannot get result from failed response");
    }
    return this._result.result;
  }

  error(): Envelope {
    if (this._result.ok) {
      throw EnvelopeError.general("Cannot get error from successful response");
    }
    return this._result.error;
  }

  /**
   * Extracts a typed result value from a successful response.
   */
  extractResult<T>(decoder: (cbor: unknown) => T): T {
    return this.result().extractSubject(decoder);
  }

  /**
   * Extracts a typed error value from a failure response.
   */
  extractError<T>(decoder: (cbor: unknown) => T): T {
    return this.error().extractSubject(decoder);
  }

  /**
   * Converts the response to an envelope.
   *
   * Successful responses have the request ID as the subject and a 'result'
   * assertion. Failure responses have the request ID (or 'Unknown' if not known)
   * as the subject and an 'error' assertion.
   */
  toEnvelope(): Envelope {
    if (this._result.ok) {
      const taggedArid = toTaggedValue(TAG_RESPONSE, this._result.id.untaggedCbor());
      return Envelope.newLeaf(taggedArid).addAssertion(RESULT, this._result.result);
    } else {
      let subject: Envelope;
      if (this._result.id !== undefined) {
        const taggedArid = toTaggedValue(TAG_RESPONSE, this._result.id.untaggedCbor());
        subject = Envelope.newLeaf(taggedArid);
      } else {
        const taggedUnknown = toTaggedValue(TAG_RESPONSE, UNKNOWN_VALUE.untaggedCbor());
        subject = Envelope.newLeaf(taggedUnknown);
      }
      return subject.addAssertion(ERROR, this._result.error);
    }
  }

  /**
   * Converts this response into an envelope (EnvelopeEncodable implementation).
   */
  intoEnvelope(): Envelope {
    return this.toEnvelope();
  }

  /**
   * Creates a response from an envelope.
   */
  static fromEnvelope(envelope: Envelope): Response {
    // Check for result or error assertion
    let hasResult = false;
    let hasError = false;

    try {
      const resultObj = envelope.objectForPredicate(RESULT);
      hasResult = resultObj !== undefined;
    } catch {
      // No result
    }

    try {
      const errorObj = envelope.objectForPredicate(ERROR);
      hasError = errorObj !== undefined;
    } catch {
      // No error
    }

    // Must have exactly one of result or error
    if (hasResult === hasError) {
      throw EnvelopeError.invalidResponse();
    }

    // Extract ARID from tagged subject
    // Subject is TAG_RESPONSE(ARID_bytes) or TAG_RESPONSE(UNKNOWN_VALUE)
    const subject = envelope.subject();
    const leaf = subject.asLeaf();
    if (leaf === undefined) {
      throw EnvelopeError.general("Response envelope has invalid subject");
    }

    // Expect the RESPONSE tag
    const content = leaf.expectTag(TAG_RESPONSE);

    // Try to extract ARID from byte string; if it's a KnownValue, ID is undefined
    let id: ARID | undefined;
    const bytes = content.asByteString();
    if (bytes !== undefined) {
      id = ARID.fromData(bytes);
    }
    // If bytes is undefined, the content is UNKNOWN_VALUE, so id remains undefined

    if (hasResult) {
      const resultEnvelope = envelope.objectForPredicate(RESULT);
      if (id === undefined) {
        throw EnvelopeError.general("Successful response must have an ID");
      }
      return new Response({
        ok: true,
        id,
        result: resultEnvelope ?? Response.ok(),
      });
    } else {
      const errorEnvelope = envelope.objectForPredicate(ERROR);
      return new Response({
        ok: false,
        id,
        error: errorEnvelope ?? Response.unknown(),
      });
    }
  }

  /**
   * Returns a string representation of the response.
   */
  toString(): string {
    return `Response(${this.summary()})`;
  }

  /**
   * Checks equality with another response.
   */
  equals(other: Response): boolean {
    if (this._result.ok !== other._result.ok) return false;

    if (this._result.ok && other._result.ok) {
      return this._result.id.equals(other._result.id);
    }

    if (!this._result.ok && !other._result.ok) {
      if (this._result.id === undefined && other._result.id === undefined) {
        return true;
      }
      if (this._result.id !== undefined && other._result.id !== undefined) {
        return this._result.id.equals(other._result.id);
      }
      return false;
    }

    return false;
  }
}
