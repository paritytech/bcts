import { type Digest, type DigestProvider } from "./digest";
import { Envelope } from "./envelope";
import { Assertion } from "./assertion";
import { EnvelopeError } from "./error";

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
  | { type: "encrypt"; key: unknown } // TODO: SymmetricKey type
  | { type: "compress" };

/// Helper to create elide action
export function elideAction(): ObscureAction {
  return { type: "elide" };
}

/// Support for eliding elements from envelopes.
declare module "./envelope" {
  interface Envelope {
    /// Returns the elided variant of this envelope.
    ///
    /// Elision replaces an envelope with just its digest, hiding its content
    /// while maintaining the integrity of the envelope's digest tree.
    ///
    /// @returns The elided envelope
    elide(): Envelope;

    /// Returns a version of this envelope with elements in the target set
    /// obscured using the specified action.
    ///
    /// @param target - The set of digests that identify elements to be obscured
    /// @param action - The action to perform on the targeted elements
    /// @returns The modified envelope
    elideRemovingSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope;

    /// Returns a version of this envelope with elements in the target set
    /// elided.
    ///
    /// @param target - The set of digests that identify elements to be elided
    /// @returns The modified envelope
    elideRemovingSet(target: Set<Digest>): Envelope;

    /// Returns a version of this envelope with elements in the target array
    /// obscured using the specified action.
    ///
    /// @param target - An array of DigestProviders
    /// @param action - The action to perform
    /// @returns The modified envelope
    elideRemovingArrayWithAction(target: DigestProvider[], action: ObscureAction): Envelope;

    /// Returns a version of this envelope with elements in the target array
    /// elided.
    ///
    /// @param target - An array of DigestProviders
    /// @returns The modified envelope
    elideRemovingArray(target: DigestProvider[]): Envelope;

    /// Returns a version of this envelope with the target element obscured.
    ///
    /// @param target - A DigestProvider
    /// @param action - The action to perform
    /// @returns The modified envelope
    elideRemovingTargetWithAction(target: DigestProvider, action: ObscureAction): Envelope;

    /// Returns a version of this envelope with the target element elided.
    ///
    /// @param target - A DigestProvider
    /// @returns The modified envelope
    elideRemovingTarget(target: DigestProvider): Envelope;

    /// Returns a version of this envelope with only elements in the target set
    /// revealed, and all other elements obscured.
    ///
    /// @param target - The set of digests that identify elements to be revealed
    /// @param action - The action to perform on other elements
    /// @returns The modified envelope
    elideRevealingSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope;

    /// Returns a version of this envelope with only elements in the target set
    /// revealed.
    ///
    /// @param target - The set of digests that identify elements to be revealed
    /// @returns The modified envelope
    elideRevealingSet(target: Set<Digest>): Envelope;

    /// Returns a version of this envelope with elements not in the target array
    /// obscured.
    ///
    /// @param target - An array of DigestProviders
    /// @param action - The action to perform
    /// @returns The modified envelope
    elideRevealingArrayWithAction(target: DigestProvider[], action: ObscureAction): Envelope;

    /// Returns a version of this envelope with elements not in the target array
    /// elided.
    ///
    /// @param target - An array of DigestProviders
    /// @returns The modified envelope
    elideRevealingArray(target: DigestProvider[]): Envelope;

    /// Returns a version of this envelope with all elements except the target
    /// element obscured.
    ///
    /// @param target - A DigestProvider
    /// @param action - The action to perform
    /// @returns The modified envelope
    elideRevealingTargetWithAction(target: DigestProvider, action: ObscureAction): Envelope;

    /// Returns a version of this envelope with all elements except the target
    /// element elided.
    ///
    /// @param target - A DigestProvider
    /// @returns The modified envelope
    elideRevealingTarget(target: DigestProvider): Envelope;

    /// Returns the unelided variant of this envelope by revealing the original
    /// content.
    ///
    /// @param envelope - The original unelided envelope
    /// @returns The revealed envelope
    /// @throws {EnvelopeError} If digests don't match
    unelide(envelope: Envelope): Envelope;

    /// Returns the set of digests of nodes matching the specified criteria.
    ///
    /// @param targetDigests - Optional set of digests to filter by
    /// @param obscureTypes - Array of ObscureType values to match against
    /// @returns A Set of matching digests
    nodesMatching(targetDigests: Set<Digest> | undefined, obscureTypes: ObscureType[]): Set<Digest>;

    /// Returns a new envelope with elided nodes restored from the provided set.
    ///
    /// @param envelopes - An array of envelopes that may match elided nodes
    /// @returns The envelope with restored nodes
    walkUnelide(envelopes: Envelope[]): Envelope;

    /// Returns a new envelope with nodes matching target digests replaced.
    ///
    /// @param target - Set of digests identifying nodes to replace
    /// @param replacement - The envelope to use for replacement
    /// @returns The modified envelope
    /// @throws {EnvelopeError} If replacement is invalid
    walkReplace(target: Set<Digest>, replacement: Envelope): Envelope;

    /// Checks if two envelopes are identical (same structure and content).
    ///
    /// @param other - The other envelope to compare with
    /// @returns `true` if identical
    isIdenticalTo(other: Envelope): boolean;
  }
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
      // TODO: Implement encryption
      throw new Error("Encryption not yet implemented");
    } else if (action.type === "compress") {
      // TODO: Implement compression
      throw new Error("Compression not yet implemented");
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
Envelope.prototype.nodesMatching = function (
  this: Envelope,
  targetDigests: Set<Digest> | undefined,
  obscureTypes: ObscureType[],
): Set<Digest> {
  const result = new Set<Digest>();

  const visitor = (envelope: Envelope): void => {
    // Check if this node matches the target digests
    const digestMatches =
      targetDigests === undefined || Array.from(targetDigests).some((d) => d.equals(envelope.digest()));

    if (!digestMatches) {
      return;
    }

    // If no obscure types specified, include all nodes
    if (obscureTypes.length === 0) {
      result.add(envelope.digest());
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
      result.add(envelope.digest());
    }
  };

  // Walk the envelope tree
  walkEnvelope(this, visitor);

  return result;
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
    return replacement !== undefined ? replacement : envelope;
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

/// Implementation of isIdenticalTo
Envelope.prototype.isIdenticalTo = function (this: Envelope, other: Envelope): boolean {
  // Two envelopes are identical if they have the same digest
  // and the same case type (to handle wrapped vs unwrapped with same content)
  return this.digest().equals(other.digest()) && this.case().type === other.case().type;
};
