/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "./envelope";
import { Digest } from "./digest";

/// Functions for traversing and manipulating the envelope hierarchy.
///
/// This module provides functionality for traversing the hierarchical structure
/// of envelopes, allowing for operations such as inspection, transformation,
/// and extraction of specific elements. It implements a visitor pattern that
/// enables executing arbitrary code on each element of an envelope in a
/// structured way.
///
/// The traversal can be performed in two modes:
/// - Structure-based traversal: Visits every element in the envelope hierarchy
/// - Tree-based traversal: Skips node elements and focuses on the semantic
///   content

/// The type of incoming edge provided to the visitor.
///
/// This enum identifies how an envelope element is connected to its parent in
/// the hierarchy during traversal. It helps the visitor function understand the
/// semantic relationship between elements.
export enum EdgeType {
  /// No incoming edge (root)
  None = "none",
  /// Element is the subject of a node
  Subject = "subject",
  /// Element is an assertion on a node
  Assertion = "assertion",
  /// Element is the predicate of an assertion
  Predicate = "predicate",
  /// Element is the object of an assertion
  Object = "object",
  /// Element is the content wrapped by another envelope
  Content = "content",
}

/// Returns a short text label for the edge type, or undefined if no label is
/// needed.
///
/// This is primarily used for tree formatting to identify relationships
/// between elements.
///
/// @param edgeType - The edge type
/// @returns A short label or undefined
export function edgeLabel(edgeType: EdgeType): string | undefined {
  switch (edgeType) {
    case EdgeType.Subject:
      return "subj";
    case EdgeType.Content:
      return "cont";
    case EdgeType.Predicate:
      return "pred";
    case EdgeType.Object:
      return "obj";
    case EdgeType.None:
    case EdgeType.Assertion:
      return undefined;
    default:
      return undefined;
  }
}

/// A visitor function that is called for each element in the envelope.
///
/// The visitor function takes the following parameters:
/// - `envelope`: The current envelope element being visited
/// - `level`: The depth level in the hierarchy (0 for root)
/// - `incomingEdge`: The type of edge connecting this element to its parent
/// - `state`: Optional context passed down from the parent's visitor call
///
/// The visitor returns a tuple of:
/// - The state that will be passed to child elements
/// - A boolean indicating whether to stop traversal (true = stop)
///
/// This enables accumulating state or passing context during traversal.
export type Visitor<State> = (
  envelope: Envelope,
  level: number,
  incomingEdge: EdgeType,
  state: State,
) => [State, boolean];

/// Implementation of walk()
Envelope.prototype.walk = function <State>(
  this: Envelope,
  hideNodes: boolean,
  state: State,
  visit: Visitor<State>,
): void {
  if (hideNodes) {
    walkTree(this, 0, EdgeType.None, state, visit);
  } else {
    walkStructure(this, 0, EdgeType.None, state, visit);
  }
};

/// Recursive implementation of structure-based traversal.
///
/// This internal function performs the actual recursive traversal of the
/// envelope structure, visiting every element and maintaining the
/// correct level and edge relationships.
function walkStructure<State>(
  envelope: Envelope,
  level: number,
  incomingEdge: EdgeType,
  state: State,
  visit: Visitor<State>,
): void {
  // Visit this envelope
  const [newState, stop] = visit(envelope, level, incomingEdge, state);
  if (stop) {
    return;
  }

  const nextLevel = level + 1;
  const c = envelope.case();

  switch (c.type) {
    case "node":
      // Visit subject
      walkStructure(c.subject, nextLevel, EdgeType.Subject, newState, visit);
      // Visit all assertions
      for (const assertion of c.assertions) {
        walkStructure(assertion, nextLevel, EdgeType.Assertion, newState, visit);
      }
      break;

    case "wrapped":
      // Visit wrapped envelope
      walkStructure(c.envelope, nextLevel, EdgeType.Content, newState, visit);
      break;

    case "assertion":
      // Visit predicate and object
      walkStructure(c.assertion.predicate(), nextLevel, EdgeType.Predicate, newState, visit);
      walkStructure(c.assertion.object(), nextLevel, EdgeType.Object, newState, visit);
      break;

    case "leaf":
    case "elided":
    case "knownValue":
    case "encrypted":
    case "compressed":
      // Leaf nodes and other types have no children
      break;
  }
}

/// Recursive implementation of tree-based traversal.
///
/// This internal function performs the actual recursive traversal of the
/// envelope's semantic tree, skipping node containers and focusing on
/// the semantic content elements. It maintains the correct level and
/// edge relationships while skipping structural elements.
function walkTree<State>(
  envelope: Envelope,
  level: number,
  incomingEdge: EdgeType,
  state: State,
  visit: Visitor<State>,
): State {
  let currentState = state;
  let subjectLevel = level;

  // Skip visiting if this is a node
  if (!envelope.isNode()) {
    const [newState, stop] = visit(envelope, level, incomingEdge, currentState);
    if (stop) {
      return newState;
    }
    currentState = newState;
    subjectLevel = level + 1;
  }

  const c = envelope.case();

  switch (c.type) {
    case "node": {
      // Visit subject
      const assertionState = walkTree(
        c.subject,
        subjectLevel,
        EdgeType.Subject,
        currentState,
        visit,
      );
      // Visit all assertions
      const assertionLevel = subjectLevel + 1;
      for (const assertion of c.assertions) {
        walkTree(assertion, assertionLevel, EdgeType.Assertion, assertionState, visit);
      }
      break;
    }

    case "wrapped":
      // Visit wrapped envelope
      walkTree(c.envelope, subjectLevel, EdgeType.Content, currentState, visit);
      break;

    case "assertion":
      // Visit predicate and object
      walkTree(c.assertion.predicate(), subjectLevel, EdgeType.Predicate, currentState, visit);
      walkTree(c.assertion.object(), subjectLevel, EdgeType.Object, currentState, visit);
      break;

    case "leaf":
    case "elided":
    case "knownValue":
    case "encrypted":
    case "compressed":
      // Leaf nodes and other types have no children
      break;
  }

  return currentState;
}

// ============================================================================
// Digest collection methods
// ============================================================================

/// Implementation of digests()
///
/// Returns the set of digests in the envelope, down to the specified level.
///
/// Mirrors Rust `Envelope::digests` (`bc-envelope-rust/src/base/digest.rs:103-119`).
/// Rust uses `HashSet<Digest>` which dedupes by content; native JS `Set`
/// dedupes by reference, so we route inserts through a hex-keyed `Map`
/// before materialising the final `Set`. That keeps the public signature
/// (`Set<Digest>`) while guaranteeing each *value* appears at most once,
/// which is what every consumer of these methods actually wants.
Envelope.prototype.digests = function (this: Envelope, levelLimit: number): Set<Digest> {
  const dedup = new Map<string, Digest>();

  const insert = (d: Digest): void => {
    const key = d.hex();
    if (!dedup.has(key)) dedup.set(key, d);
  };

  const visitor = (
    envelope: Envelope,
    level: number,
    _incomingEdge: EdgeType,
    _state: undefined,
  ): [undefined, boolean] => {
    if (level < levelLimit) {
      insert(envelope.digest());
      insert(envelope.subject().digest());
    }
    return [undefined, false]; // Continue walking
  };

  this.walk(false, undefined, visitor);
  return new Set(dedup.values());
};

/// Implementation of deepDigests()
/// Returns all digests in the envelope at all levels.
Envelope.prototype.deepDigests = function (this: Envelope): Set<Digest> {
  return this.digests(Number.MAX_SAFE_INTEGER);
};

/// Implementation of shallowDigests()
/// Returns the digests in the envelope down to its second level.
Envelope.prototype.shallowDigests = function (this: Envelope): Set<Digest> {
  return this.digests(2);
};

/// Implementation of structuralDigest()
///
/// Mirrors Rust `Envelope::structural_digest`
/// (`bc-envelope-rust/src/base/digest.rs:241-261`). Walks every node in
/// structure mode, building an image:
///
/// - Each obscured case prepends a 1-byte discriminator: `0` for Encrypted,
///   `1` for Elided, `2` for Compressed (matching the Rust order).
/// - Every node — obscured or not — appends its 32-byte digest bytes.
///
/// The full image is then SHA-256-hashed via {@link Digest.fromImage}.
///
/// Unlike {@link Envelope.digest} (which captures *semantic* identity),
/// `structuralDigest` captures the envelope's structural form too, including
/// where elision / encryption / compression has been applied. Two
/// envelopes whose `digest()`s match are semantically equivalent; their
/// `structuralDigest()`s match only if the structures themselves are
/// identical.
Envelope.prototype.structuralDigest = function (this: Envelope): Digest {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  this.walk(false, undefined, (envelope, _level, _edge, _state) => {
    const c = envelope.case();
    // Discriminator byte for obscured cases — matches Rust line 247-251.
    if (c.type === "encrypted") {
      chunks.push(new Uint8Array([0]));
      totalLength += 1;
    } else if (c.type === "elided") {
      chunks.push(new Uint8Array([1]));
      totalLength += 1;
    } else if (c.type === "compressed") {
      chunks.push(new Uint8Array([2]));
      totalLength += 1;
    }
    const digestBytes = envelope.digest().data();
    chunks.push(digestBytes);
    totalLength += digestBytes.length;
    return [undefined, false];
  });

  const image = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    image.set(chunk, offset);
    offset += chunk.length;
  }
  return Digest.fromImage(image);
};

// ============================================================================
// Alias methods for Rust API compatibility
// ============================================================================

/// Implementation of object() - alias for tryObject()
Envelope.prototype.object = function (this: Envelope): Envelope {
  return this.tryObject();
};

/// Implementation of predicate() - alias for tryPredicate()
Envelope.prototype.predicate = function (this: Envelope): Envelope {
  return this.tryPredicate();
};

// ============================================================================
// CBOR helper methods
// ============================================================================

/// Implementation of toCbor() - alias for taggedCbor()
Envelope.prototype.toCbor = function (this: Envelope): unknown {
  return this.taggedCbor();
};

/// Implementation of expectLeaf() - returns the leaf CBOR value or throws
Envelope.prototype.expectLeaf = function (this: Envelope): unknown {
  return this.tryLeaf();
};

// `checkTypeValue` is now defined in `extension/types.ts`. The earlier
// stub in this file delegated to `checkType`, which is *not* equivalent —
// `checkType` accepts arbitrary `EnvelopeEncodable` values, while
// `checkTypeValue` is specifically the KnownValue-keyed counterpart. The
// real implementation lives alongside `hasTypeValue` in
// `extension/types.ts`.
