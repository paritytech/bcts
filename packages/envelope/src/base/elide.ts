/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { type Digest, type DigestProvider } from "./digest";
import { Envelope } from "./envelope";
import { Assertion } from "./assertion";
import { EnvelopeError } from "./error";
import type { SymmetricKey } from "@bcts/components";

/// Types of obscuration that can be applied to envelope elements.
///
/// This enum identifies the different ways an envelope element can be obscured.
export enum ObscureType {
  /// The element has been elided, showing only its digest.
  Elided = "elided",

  /// The element has been encrypted using symmetric encryption.
  /// TODO: Implement when encrypt feature is added
  Encrypted = "encrypted",

  /// The element has been compressed to reduce its size.
  /// TODO: Implement when compress feature is added
  Compressed = "compressed",
}

/// Actions that can be performed on parts of an envelope to obscure them.
///
/// Gordian Envelope supports several ways to obscure parts of an envelope while
/// maintaining its semantic integrity and digest tree.
export type ObscureAction =
  | { type: "elide" }
  | { type: "encrypt"; key: unknown }
  | { type: "compress" };

/// Helper to create elide action
export function elideAction(): ObscureAction {
  return { type: "elide" };
}

/// Late-binding handler for the encrypt obscure action.
/// Registered by extension/encrypt.ts to avoid circular dependencies.
let _obscureEncryptHandler: ((envelope: Envelope, key: unknown) => Envelope) | undefined;

/// Registers the handler for the encrypt obscure action.
/// Called by registerEncryptExtension() during module initialization.
export function registerObscureEncryptHandler(
  handler: (envelope: Envelope, key: unknown) => Envelope,
): void {
  _obscureEncryptHandler = handler;
}

/// Implementation of elide()
Envelope.prototype.elide = function (this: Envelope): Envelope {
  const c = this.case();
  if (c.type === "elided") {
    return this;
  }
  return Envelope.newElided(this.digest());
};

/// Core elision logic
function elideSetWithAction(
  envelope: Envelope,
  target: Set<Digest>,
  isRevealing: boolean,
  action: ObscureAction,
): Envelope {
  const selfDigest = envelope.digest();
  const targetContainsSelf = Array.from(target).some((d) => d.equals(selfDigest));

  // Target Matches  isRevealing  elide
  // false          false         false
  // false          true          true
  // true           false         true
  // true           true          false

  if (targetContainsSelf !== isRevealing) {
    // Should obscure this envelope
    if (action.type === "elide") {
      return envelope.elide();
    } else if (action.type === "encrypt") {
      if (_obscureEncryptHandler === undefined) {
        throw new Error("Encrypt action handler not registered");
      }
      return _obscureEncryptHandler(envelope, action.key);
    } else if (action.type === "compress") {
      return envelope.compress();
    }
  }

  const c = envelope.case();

  // Recursively process structure
  if (c.type === "assertion") {
    const predicate = elideSetWithAction(c.assertion.predicate(), target, isRevealing, action);
    const object = elideSetWithAction(c.assertion.object(), target, isRevealing, action);
    const elidedAssertion = new Assertion(predicate, object);
    return Envelope.newWithAssertion(elidedAssertion);
  } else if (c.type === "node") {
    const elidedSubject = elideSetWithAction(c.subject, target, isRevealing, action);
    const elidedAssertions = c.assertions.map((a) =>
      elideSetWithAction(a, target, isRevealing, action),
    );
    return Envelope.newWithUncheckedAssertions(elidedSubject, elidedAssertions);
  } else if (c.type === "wrapped") {
    const elidedEnvelope = elideSetWithAction(c.envelope, target, isRevealing, action);
    return Envelope.newWrapped(elidedEnvelope);
  }

  return envelope;
}

/// Implementation of elideRemovingSetWithAction
Envelope.prototype.elideRemovingSetWithAction = function (
  this: Envelope,
  target: Set<Digest>,
  action: ObscureAction,
): Envelope {
  return elideSetWithAction(this, target, false, action);
};

/// Implementation of elideSetWithAction (for revealing mode)
Envelope.prototype.elideSetWithAction = function (
  this: Envelope,
  target: Set<Digest>,
  action: ObscureAction,
): Envelope {
  return elideSetWithAction(this, target, true, action);
};

/// Implementation of elideRemovingSet
Envelope.prototype.elideRemovingSet = function (this: Envelope, target: Set<Digest>): Envelope {
  return elideSetWithAction(this, target, false, elideAction());
};

/// Implementation of elideRemovingArrayWithAction
Envelope.prototype.elideRemovingArrayWithAction = function (
  this: Envelope,
  target: DigestProvider[],
  action: ObscureAction,
): Envelope {
  const targetSet = new Set(target.map((p) => p.digest()));
  return elideSetWithAction(this, targetSet, false, action);
};

/// Implementation of elideRemovingArray
Envelope.prototype.elideRemovingArray = function (
  this: Envelope,
  target: DigestProvider[],
): Envelope {
  const targetSet = new Set(target.map((p) => p.digest()));
  return elideSetWithAction(this, targetSet, false, elideAction());
};

/// Implementation of elideRemovingTargetWithAction
Envelope.prototype.elideRemovingTargetWithAction = function (
  this: Envelope,
  target: DigestProvider,
  action: ObscureAction,
): Envelope {
  return this.elideRemovingArrayWithAction([target], action);
};

/// Implementation of elideRemovingTarget
Envelope.prototype.elideRemovingTarget = function (
  this: Envelope,
  target: DigestProvider,
): Envelope {
  return this.elideRemovingArray([target]);
};

/// Implementation of elideRevealingSetWithAction
Envelope.prototype.elideRevealingSetWithAction = function (
  this: Envelope,
  target: Set<Digest>,
  action: ObscureAction,
): Envelope {
  return elideSetWithAction(this, target, true, action);
};

/// Implementation of elideRevealingSet
Envelope.prototype.elideRevealingSet = function (this: Envelope, target: Set<Digest>): Envelope {
  return elideSetWithAction(this, target, true, elideAction());
};

/// Implementation of elideRevealingArrayWithAction
Envelope.prototype.elideRevealingArrayWithAction = function (
  this: Envelope,
  target: DigestProvider[],
  action: ObscureAction,
): Envelope {
  const targetSet = new Set(target.map((p) => p.digest()));
  return elideSetWithAction(this, targetSet, true, action);
};

/// Implementation of elideRevealingArray
Envelope.prototype.elideRevealingArray = function (
  this: Envelope,
  target: DigestProvider[],
): Envelope {
  const targetSet = new Set(target.map((p) => p.digest()));
  return elideSetWithAction(this, targetSet, true, elideAction());
};

/// Implementation of elideRevealingTargetWithAction
Envelope.prototype.elideRevealingTargetWithAction = function (
  this: Envelope,
  target: DigestProvider,
  action: ObscureAction,
): Envelope {
  return this.elideRevealingArrayWithAction([target], action);
};

/// Implementation of elideRevealingTarget
Envelope.prototype.elideRevealingTarget = function (
  this: Envelope,
  target: DigestProvider,
): Envelope {
  return this.elideRevealingArray([target]);
};

/// Implementation of unelide
Envelope.prototype.unelide = function (this: Envelope, envelope: Envelope): Envelope {
  if (this.digest().equals(envelope.digest())) {
    return envelope;
  }
  throw EnvelopeError.invalidDigest();
};

/// Implementation of nodesMatching
///
/// Mirrors Rust `Envelope::nodes_matching`. The TS public signature is
/// `Set<Digest>` for backward compatibility with callers, but the
/// underlying dedup is by **hex content** (via a hex-keyed Map) so two
/// `Digest` instances that represent the same hash bytes count once,
/// matching Rust's `HashSet<Digest>` semantics.
Envelope.prototype.nodesMatching = function (
  this: Envelope,
  targetDigests: Set<Digest> | undefined,
  obscureTypes: ObscureType[],
): Set<Digest> {
  const dedup = new Map<string, Digest>();
  const insert = (d: Digest): void => {
    const key = d.hex();
    if (!dedup.has(key)) dedup.set(key, d);
  };

  // Pre-compute the target digest set as a hex lookup for O(1) membership
  // checks (replacing the old O(n) `Array.from(...).some(...)` scan).
  let targetHexes: Set<string> | undefined;
  if (targetDigests !== undefined) {
    targetHexes = new Set<string>();
    for (const d of targetDigests) {
      targetHexes.add(d.hex());
    }
  }

  const visitor = (envelope: Envelope): void => {
    // Check if this node matches the target digests
    const ownDigest = envelope.digest();
    const digestMatches = targetHexes === undefined || targetHexes.has(ownDigest.hex());

    if (!digestMatches) {
      return;
    }

    // If no obscure types specified, include all nodes
    if (obscureTypes.length === 0) {
      insert(ownDigest);
      return;
    }

    // Check if this node matches any of the specified obscure types
    const c = envelope.case();
    const typeMatches = obscureTypes.some((obscureType) => {
      if (obscureType === ObscureType.Elided && c.type === "elided") {
        return true;
      }
      if (obscureType === ObscureType.Encrypted && c.type === "encrypted") {
        return true;
      }
      if (obscureType === ObscureType.Compressed && c.type === "compressed") {
        return true;
      }
      return false;
    });

    if (typeMatches) {
      insert(ownDigest);
    }
  };

  // Walk the envelope tree
  walkEnvelope(this, visitor);

  return new Set(dedup.values());
};

/// Helper to walk envelope tree
function walkEnvelope(envelope: Envelope, visitor: (e: Envelope) => void): void {
  visitor(envelope);

  const c = envelope.case();
  if (c.type === "node") {
    walkEnvelope(c.subject, visitor);
    for (const assertion of c.assertions) {
      walkEnvelope(assertion, visitor);
    }
  } else if (c.type === "assertion") {
    walkEnvelope(c.assertion.predicate(), visitor);
    walkEnvelope(c.assertion.object(), visitor);
  } else if (c.type === "wrapped") {
    walkEnvelope(c.envelope, visitor);
  }
}

/// Implementation of walkUnelide
Envelope.prototype.walkUnelide = function (this: Envelope, envelopes: Envelope[]): Envelope {
  // Build a lookup map of digest -> envelope
  const envelopeMap = new Map<string, Envelope>();
  for (const env of envelopes) {
    envelopeMap.set(env.digest().hex(), env);
  }

  return walkUnelideWithMap(this, envelopeMap);
};

/// Helper for walkUnelide with map
function walkUnelideWithMap(envelope: Envelope, envelopeMap: Map<string, Envelope>): Envelope {
  const c = envelope.case();

  if (c.type === "elided") {
    // Try to find a matching envelope to restore
    const replacement = envelopeMap.get(envelope.digest().hex());
    return replacement ?? envelope;
  }

  if (c.type === "node") {
    const newSubject = walkUnelideWithMap(c.subject, envelopeMap);
    const newAssertions = c.assertions.map((a) => walkUnelideWithMap(a, envelopeMap));

    if (
      newSubject.isIdenticalTo(c.subject) &&
      newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
    ) {
      return envelope;
    }

    return Envelope.newWithUncheckedAssertions(newSubject, newAssertions);
  }

  if (c.type === "wrapped") {
    const newEnvelope = walkUnelideWithMap(c.envelope, envelopeMap);
    if (newEnvelope.isIdenticalTo(c.envelope)) {
      return envelope;
    }
    return Envelope.newWrapped(newEnvelope);
  }

  if (c.type === "assertion") {
    const newPredicate = walkUnelideWithMap(c.assertion.predicate(), envelopeMap);
    const newObject = walkUnelideWithMap(c.assertion.object(), envelopeMap);

    if (
      newPredicate.isIdenticalTo(c.assertion.predicate()) &&
      newObject.isIdenticalTo(c.assertion.object())
    ) {
      return envelope;
    }

    return Envelope.newAssertion(newPredicate, newObject);
  }

  return envelope;
}

/// Implementation of walkReplace
Envelope.prototype.walkReplace = function (
  this: Envelope,
  target: Set<Digest>,
  replacement: Envelope,
): Envelope {
  // Check if this node matches the target
  if (Array.from(target).some((d) => d.equals(this.digest()))) {
    return replacement;
  }

  const c = this.case();

  if (c.type === "node") {
    const newSubject = c.subject.walkReplace(target, replacement);
    const newAssertions = c.assertions.map((a) => a.walkReplace(target, replacement));

    if (
      newSubject.isIdenticalTo(c.subject) &&
      newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
    ) {
      return this;
    }

    // Validate that all assertions are either assertions or obscured
    return Envelope.newWithAssertions(newSubject, newAssertions);
  }

  if (c.type === "wrapped") {
    const newEnvelope = c.envelope.walkReplace(target, replacement);
    if (newEnvelope.isIdenticalTo(c.envelope)) {
      return this;
    }
    return Envelope.newWrapped(newEnvelope);
  }

  if (c.type === "assertion") {
    const newPredicate = c.assertion.predicate().walkReplace(target, replacement);
    const newObject = c.assertion.object().walkReplace(target, replacement);

    if (
      newPredicate.isIdenticalTo(c.assertion.predicate()) &&
      newObject.isIdenticalTo(c.assertion.object())
    ) {
      return this;
    }

    return Envelope.newAssertion(newPredicate, newObject);
  }

  return this;
};

/// Implementation of isEquivalentTo
///
/// Two envelopes are equivalent if they have the same digest (semantic equivalence).
/// This is a weaker comparison than `isIdenticalTo` which also checks the case type.
///
/// Equivalent to Rust's `is_equivalent_to()` in `src/base/digest.rs`.
Envelope.prototype.isEquivalentTo = function (this: Envelope, other: Envelope): boolean {
  return this.digest().equals(other.digest());
};

/// Implementation of isIdenticalTo
///
/// Mirrors Rust `Envelope::is_identical_to`
/// (`bc-envelope-rust/src/base/digest.rs:344-349`):
/// short-circuit on a *semantic* mismatch (different `digest()`), then fall
/// through to a {@link Envelope.structuralDigest} comparison. Two envelopes
/// whose digests match but whose structures differ — e.g. an envelope and a
/// version of it with one assertion elided — are **not** identical.
Envelope.prototype.isIdenticalTo = function (this: Envelope, other: Envelope): boolean {
  if (!this.isEquivalentTo(other)) {
    return false;
  }
  return this.structuralDigest().equals(other.structuralDigest());
};

// ============================================================================
// Walk-style decrypt / decompress
// ============================================================================

/// Implementation of walkDecrypt
///
/// Mirrors Rust `Envelope::walk_decrypt`
/// (`bc-envelope-rust/src/base/elide.rs:963-1019`).
///
/// Recursively walks the envelope and decrypts every encrypted node it
/// can. For an Encrypted node, each provided key is tried in order; the
/// first one that successfully decrypts wins, and the recursion continues
/// into the result so chains of nested encryption peel off one layer per
/// matching key. Nodes whose decryption fails for every key are returned
/// unchanged — matching Rust's `if let Ok(decrypted) = ...` pattern.
///
/// Structural sharing: if a recursion produces an envelope that is
/// {@link Envelope.isIdenticalTo} the original, the original instance is
/// reused instead of allocating a new node.
Envelope.prototype.walkDecrypt = function (
  this: Envelope,
  keys: SymmetricKey[],
): Envelope {
  const c = this.case();

  switch (c.type) {
    case "encrypted": {
      // Try each key until one works.
      for (const key of keys) {
        try {
          // `decryptSubject` works on encrypted envelopes too — when the
          // subject *is* the encrypted node, it produces the decrypted
          // envelope.
          const decrypted = this.decryptSubject(key);
          return decrypted.walkDecrypt(keys);
        } catch {
          // This key didn't work; try the next one.
        }
      }
      // No key worked — leave this node alone.
      return this;
    }
    case "node": {
      const newSubject = c.subject.walkDecrypt(keys);
      const newAssertions = c.assertions.map((a) => a.walkDecrypt(keys));
      if (
        newSubject.isIdenticalTo(c.subject) &&
        newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
      ) {
        return this;
      }
      return Envelope.newWithUncheckedAssertions(newSubject, newAssertions);
    }
    case "wrapped": {
      const newEnvelope = c.envelope.walkDecrypt(keys);
      if (newEnvelope.isIdenticalTo(c.envelope)) {
        return this;
      }
      return newEnvelope.wrap();
    }
    case "assertion": {
      const newPredicate = c.assertion.predicate().walkDecrypt(keys);
      const newObject = c.assertion.object().walkDecrypt(keys);
      if (
        newPredicate.isIdenticalTo(c.assertion.predicate()) &&
        newObject.isIdenticalTo(c.assertion.object())
      ) {
        return this;
      }
      return Envelope.newAssertion(newPredicate, newObject);
    }
    case "leaf":
    case "knownValue":
    case "elided":
    case "compressed":
      // No-op: these cases have no children to walk and no decrypt
      // operation applies (Rust's match arm `_ => self.clone()`).
      return this;
  }
};

/// Implementation of walkDecompress
///
/// Mirrors Rust `Envelope::walk_decompress`
/// (`bc-envelope-rust/src/base/elide.rs:1067-1135`).
///
/// Recursively walks the envelope and decompresses any compressed node
/// whose digest is in `targetDigests` (or every compressed node if
/// `targetDigests` is undefined). Decompression failures are tolerated —
/// the original node is returned in that case, mirroring Rust's
/// `if let Ok(decompressed) = ...` pattern.
Envelope.prototype.walkDecompress = function (
  this: Envelope,
  targetDigests?: Set<Digest>,
): Envelope {
  const matchesTarget = (envelope: Envelope): boolean => {
    if (targetDigests === undefined) return true;
    const ownDigest = envelope.digest();
    for (const d of targetDigests) {
      if (d.equals(ownDigest)) return true;
    }
    return false;
  };

  const c = this.case();

  switch (c.type) {
    case "compressed": {
      if (matchesTarget(this)) {
        try {
          const decompressed = this.decompress();
          return decompressed.walkDecompress(targetDigests);
        } catch {
          // Decompression failed — leave this node alone.
        }
      }
      return this;
    }
    case "node": {
      const newSubject = c.subject.walkDecompress(targetDigests);
      const newAssertions = c.assertions.map((a) => a.walkDecompress(targetDigests));
      if (
        newSubject.isIdenticalTo(c.subject) &&
        newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
      ) {
        return this;
      }
      return Envelope.newWithUncheckedAssertions(newSubject, newAssertions);
    }
    case "wrapped": {
      const newEnvelope = c.envelope.walkDecompress(targetDigests);
      if (newEnvelope.isIdenticalTo(c.envelope)) {
        return this;
      }
      return newEnvelope.wrap();
    }
    case "assertion": {
      const newPredicate = c.assertion.predicate().walkDecompress(targetDigests);
      const newObject = c.assertion.object().walkDecompress(targetDigests);
      if (
        newPredicate.isIdenticalTo(c.assertion.predicate()) &&
        newObject.isIdenticalTo(c.assertion.object())
      ) {
        return this;
      }
      return Envelope.newAssertion(newPredicate, newObject);
    }
    case "leaf":
    case "knownValue":
    case "elided":
    case "encrypted":
      // No-op: these cases have no children to walk and no decompress
      // operation applies (Rust's match arm `_ => self.clone()`).
      return this;
  }
};
