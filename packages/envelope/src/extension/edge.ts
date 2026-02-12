/**
 * Edge Extension for Gordian Envelope (BCR-2026-003)
 *
 * Provides functionality for creating and managing edge envelopes that
 * represent verifiable relationships between entities. An edge envelope
 * contains three required assertions:
 * - `'isA'`: The type of relationship
 * - `'source'`: The source entity
 * - `'target'`: The target entity
 *
 * Edges may optionally be wrapped and signed. When accessing edge properties,
 * the implementation handles both wrapped (signed) and unwrapped edges
 * transparently.
 *
 * Equivalent to Rust's `src/extension/edge/` module.
 *
 * @module edge
 */

import { Envelope } from "../base/envelope";
import { type Digest } from "../base/digest";
import { EnvelopeError } from "../base/error";
import { EDGE, IS_A, IS_A_RAW, SOURCE, SOURCE_RAW, TARGET, TARGET_RAW } from "@bcts/known-values";

// -------------------------------------------------------------------
// Edges Container
// -------------------------------------------------------------------

/**
 * A container for edge envelopes on a document.
 *
 * `Edges` stores pre-constructed edge envelopes keyed by their digest,
 * mirroring the `Attachments` container but for edges as defined in
 * BCR-2026-003.
 *
 * Equivalent to Rust's `Edges` struct in `src/extension/edge/edges.rs`.
 */
export class Edges {
  private readonly _envelopes: Map<string, Envelope>;

  /**
   * Creates a new empty edges container.
   */
  constructor() {
    this._envelopes = new Map();
  }

  /**
   * Adds a pre-constructed edge envelope.
   *
   * @param edgeEnvelope - The edge envelope to add
   */
  add(edgeEnvelope: Envelope): void {
    const digest = edgeEnvelope.digest();
    this._envelopes.set(digest.hex(), edgeEnvelope);
  }

  /**
   * Retrieves an edge by its digest.
   *
   * @param digest - The digest of the edge to retrieve
   * @returns The edge envelope if found, or undefined
   */
  get(digest: Digest): Envelope | undefined {
    return this._envelopes.get(digest.hex());
  }

  /**
   * Removes an edge by its digest.
   *
   * @param digest - The digest of the edge to remove
   * @returns The removed edge envelope if found, or undefined
   */
  remove(digest: Digest): Envelope | undefined {
    const key = digest.hex();
    const envelope = this._envelopes.get(key);
    this._envelopes.delete(key);
    return envelope;
  }

  /**
   * Removes all edges from the container.
   */
  clear(): void {
    this._envelopes.clear();
  }

  /**
   * Returns whether the container has no edges.
   */
  isEmpty(): boolean {
    return this._envelopes.size === 0;
  }

  /**
   * Returns the number of edges in the container.
   */
  len(): number {
    return this._envelopes.size;
  }

  /**
   * Returns an iterator over all edge envelopes.
   */
  iter(): IterableIterator<[string, Envelope]> {
    return this._envelopes.entries();
  }

  /**
   * Check equality with another Edges container.
   */
  equals(other: Edges): boolean {
    if (this._envelopes.size !== other._envelopes.size) return false;
    for (const [key] of this._envelopes) {
      if (!other._envelopes.has(key)) return false;
    }
    return true;
  }

  /**
   * Adds all edges as `'edge'` assertion envelopes to the given envelope.
   *
   * @param envelope - The envelope to add edges to
   * @returns A new envelope with all edges added as assertions
   */
  addToEnvelope(envelope: Envelope): Envelope {
    let result = envelope;
    for (const edgeEnvelope of this._envelopes.values()) {
      result = result.addAssertion(EDGE, edgeEnvelope);
    }
    return result;
  }

  /**
   * Extracts edges from an envelope's `'edge'` assertions.
   *
   * Equivalent to Rust's `Edges::try_from_envelope()`.
   *
   * @param envelope - The envelope to extract edges from
   * @returns A new Edges container with the envelope's edges
   */
  static fromEnvelope(envelope: Envelope): Edges {
    const edgeEnvelopes = envelope.edges();
    const edges = new Edges();
    for (const edge of edgeEnvelopes) {
      edges._envelopes.set(edge.digest().hex(), edge);
    }
    return edges;
  }
}

// -------------------------------------------------------------------
// Edgeable Interface
// -------------------------------------------------------------------

/**
 * A trait for types that can have edges.
 *
 * `Edgeable` provides a consistent interface for working with edges.
 * Types implementing this interface can store and retrieve edge envelopes
 * representing verifiable claims as defined in BCR-2026-003.
 *
 * Equivalent to Rust's `Edgeable` trait in `src/extension/edge/edges.rs`.
 */
export interface Edgeable {
  /** Returns a reference to the edges container. */
  edges(): Edges;
  /** Returns a mutable reference to the edges container. */
  edgesMut(): Edges;
  /** Adds a pre-constructed edge envelope. */
  addEdge(edgeEnvelope: Envelope): void;
  /** Retrieves an edge by its digest. */
  getEdge(digest: Digest): Envelope | undefined;
  /** Removes an edge by its digest. */
  removeEdge(digest: Digest): Envelope | undefined;
  /** Removes all edges. */
  clearEdges(): void;
  /** Returns whether the object has any edges. */
  hasEdges(): boolean;
}

// -------------------------------------------------------------------
// Envelope Prototype Methods
// -------------------------------------------------------------------

/**
 * Returns a new envelope with an added `'edge': <edge>` assertion.
 *
 * Equivalent to Rust's `Envelope::add_edge_envelope()`.
 */
Envelope.prototype.addEdgeEnvelope = function (this: Envelope, edge: Envelope): Envelope {
  return this.addAssertion(EDGE, edge);
};

/**
 * Returns all edge object envelopes (assertions with predicate `'edge'`).
 *
 * Equivalent to Rust's `Envelope::edges()`.
 */
Envelope.prototype.edges = function (this: Envelope): Envelope[] {
  return this.objectsForPredicate(EDGE);
};

/**
 * Validates an edge envelope's structure per BCR-2026-003.
 *
 * An edge may be wrapped (signed) or unwrapped. The inner envelope
 * must have exactly three assertion predicates: `'isA'`, `'source'`,
 * and `'target'`. No other assertions are permitted on the edge subject.
 *
 * Equivalent to Rust's `Envelope::validate_edge()`.
 *
 * @throws {EnvelopeError} If the edge structure is invalid
 */
Envelope.prototype.validateEdge = function (this: Envelope): void {
  const inner = this.subject().isWrapped() ? this.subject().tryUnwrap() : this;

  let seenIsA = false;
  let seenSource = false;
  let seenTarget = false;

  for (const assertion of inner.assertions()) {
    const predicateEnv = assertion.tryPredicate();
    const kv = predicateEnv.asKnownValue();
    if (kv === undefined) {
      throw EnvelopeError.edgeUnexpectedAssertion();
    }
    const raw = kv.valueBigInt();
    switch (raw) {
      case IS_A_RAW:
        if (seenIsA) {
          throw EnvelopeError.edgeDuplicateIsA();
        }
        seenIsA = true;
        break;
      case SOURCE_RAW:
        if (seenSource) {
          throw EnvelopeError.edgeDuplicateSource();
        }
        seenSource = true;
        break;
      case TARGET_RAW:
        if (seenTarget) {
          throw EnvelopeError.edgeDuplicateTarget();
        }
        seenTarget = true;
        break;
      default:
        throw EnvelopeError.edgeUnexpectedAssertion();
    }
  }

  if (!seenIsA) {
    throw EnvelopeError.edgeMissingIsA();
  }
  if (!seenSource) {
    throw EnvelopeError.edgeMissingSource();
  }
  if (!seenTarget) {
    throw EnvelopeError.edgeMissingTarget();
  }
};

/**
 * Extracts the `'isA'` assertion object from an edge envelope.
 *
 * Equivalent to Rust's `Envelope::edge_is_a()`.
 */
Envelope.prototype.edgeIsA = function (this: Envelope): Envelope {
  const inner = this.subject().isWrapped() ? this.subject().tryUnwrap() : this;
  return inner.objectForPredicate(IS_A);
};

/**
 * Extracts the `'source'` assertion object from an edge envelope.
 *
 * Equivalent to Rust's `Envelope::edge_source()`.
 */
Envelope.prototype.edgeSource = function (this: Envelope): Envelope {
  const inner = this.subject().isWrapped() ? this.subject().tryUnwrap() : this;
  return inner.objectForPredicate(SOURCE);
};

/**
 * Extracts the `'target'` assertion object from an edge envelope.
 *
 * Equivalent to Rust's `Envelope::edge_target()`.
 */
Envelope.prototype.edgeTarget = function (this: Envelope): Envelope {
  const inner = this.subject().isWrapped() ? this.subject().tryUnwrap() : this;
  return inner.objectForPredicate(TARGET);
};

/**
 * Extracts the edge's subject identifier (the inner envelope's subject).
 *
 * Equivalent to Rust's `Envelope::edge_subject()`.
 */
Envelope.prototype.edgeSubject = function (this: Envelope): Envelope {
  const inner = this.subject().isWrapped() ? this.subject().tryUnwrap() : this;
  return inner.subject();
};

/**
 * Filters edges by optional criteria.
 *
 * Each parameter is optional. When provided, only edges matching
 * all specified criteria are returned.
 *
 * Equivalent to Rust's `Envelope::edges_matching()`.
 *
 * @param isA - Optional `'isA'` envelope to match
 * @param source - Optional `'source'` envelope to match
 * @param target - Optional `'target'` envelope to match
 * @param subject - Optional subject envelope to match
 * @returns Array of matching edge envelopes
 */
Envelope.prototype.edgesMatching = function (
  this: Envelope,
  isA?: Envelope,
  source?: Envelope,
  target?: Envelope,
  subject?: Envelope,
): Envelope[] {
  const allEdges = this.edges();
  const matching: Envelope[] = [];

  for (const edge of allEdges) {
    if (isA !== undefined) {
      try {
        const edgeIsA = edge.edgeIsA();
        if (!edgeIsA.isEquivalentTo(isA)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    if (source !== undefined) {
      try {
        const edgeSource = edge.edgeSource();
        if (!edgeSource.isEquivalentTo(source)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    if (target !== undefined) {
      try {
        const edgeTarget = edge.edgeTarget();
        if (!edgeTarget.isEquivalentTo(target)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    if (subject !== undefined) {
      try {
        const edgeSubject = edge.edgeSubject();
        if (!edgeSubject.isEquivalentTo(subject)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    matching.push(edge);
  }

  return matching;
};
