/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { type Digest } from "../base/digest";

/// Extension for envelope inclusion proofs.
///
/// Inclusion proofs allow a holder of an envelope to prove that specific
/// elements exist within the envelope without revealing the entire contents.
/// This is particularly useful for selective disclosure of information in
/// privacy-preserving scenarios.
///
/// ## How Inclusion Proofs Work
///
/// The inclusion proof mechanism leverages the Merkle-like digest tree
/// structure of envelopes:
/// - The holder creates a minimal structure containing only the digests
///   necessary to validate the proof
/// - A verifier with a trusted root digest can confirm that the specific
///   elements exist in the original envelope
/// - All other content can remain elided, preserving privacy
///
/// For enhanced privacy, elements can be salted to prevent correlation attacks.
///
/// @example
/// ```typescript
/// // Create an envelope with multiple assertions
/// const aliceFriends = Envelope.new('Alice')
///   .addAssertion('knows', 'Bob')
///   .addAssertion('knows', 'Carol')
///   .addAssertion('knows', 'Dan');
///
/// // Create a representation of just the root digest
/// const aliceFriendsRoot = aliceFriends.elideRevealingSet(new Set());
///
/// // Create the target we want to prove exists
/// const knowsBobAssertion = Envelope.newAssertion('knows', 'Bob');
///
/// // Generate a proof that Alice knows Bob
/// const aliceKnowsBobProof = aliceFriends.proofContainsTarget(knowsBobAssertion);
///
/// // A third party can verify the proof against the trusted root
/// if (aliceKnowsBobProof) {
///   const isValid = aliceFriendsRoot.confirmContainsTarget(
///     knowsBobAssertion,
///     aliceKnowsBobProof
///   );
///   console.log('Proof is valid:', isValid);
/// }
/// ```

/// Implementation of proof methods on Envelope prototype
// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
  Envelope.prototype.proofContainsSet = function (target: Set<Digest>): Envelope | undefined {
    const revealSet = revealSetOfSet(this, target);

    // Check if all targets can be revealed
    if (!isSubset(target, revealSet)) {
      return undefined;
    }

    // Create a proof by revealing only what's necessary, then eliding the targets
    const revealed = this.elideRevealingSet(revealSet);
    return revealed.elideRemovingSet(target);
  };

  Envelope.prototype.proofContainsTarget = function (target: Envelope): Envelope | undefined {
    const targetSet = new Set<Digest>([target.digest()]);
    return this.proofContainsSet(targetSet);
  };

  Envelope.prototype.confirmContainsSet = function (target: Set<Digest>, proof: Envelope): boolean {
    // Verify the proof has the same digest as this envelope
    if (this.digest().hex() !== proof.digest().hex()) {
      return false;
    }

    // Verify the proof contains all target elements
    return containsAll(proof, target);
  };

  Envelope.prototype.confirmContainsTarget = function (target: Envelope, proof: Envelope): boolean {
    const targetSet = new Set<Digest>([target.digest()]);
    return this.confirmContainsSet(targetSet, proof);
  };
}

/// Internal helper functions

/// Builds a set of all digests needed to reveal the target set.
///
/// This collects all digests in the path from the envelope's root to each
/// target element.
function revealSetOfSet(envelope: Envelope, target: Set<Digest>): Set<Digest> {
  const result = new Set<Digest>();
  revealSets(envelope, target, new Set<Digest>(), result);
  return result;
}

/// Recursively traverses the envelope to collect all digests needed to
/// reveal the target set.
///
/// Builds the set of digests forming the path from the root to each target element.
function revealSets(
  envelope: Envelope,
  target: Set<Digest>,
  current: Set<Digest>,
  result: Set<Digest>,
): void {
  // Add current envelope's digest to the path
  const newCurrent = new Set(current);
  newCurrent.add(envelope.digest());

  // If this is a target, add the entire path to the result
  if (containsDigest(target, envelope.digest())) {
    for (const digest of newCurrent) {
      result.add(digest);
    }
  }

  // Traverse the envelope structure
  const envelopeCase = envelope.case();

  if (envelopeCase.type === "node") {
    // Traverse subject
    revealSets(envelopeCase.subject, target, newCurrent, result);

    // Traverse all assertions
    for (const assertion of envelopeCase.assertions) {
      revealSets(assertion, target, newCurrent, result);
    }
  } else if (envelopeCase.type === "wrapped") {
    // Traverse wrapped envelope
    revealSets(envelopeCase.envelope, target, newCurrent, result);
  } else if (envelopeCase.type === "assertion") {
    // Traverse predicate and object
    const predicate = envelopeCase.assertion.predicate();
    const object = envelopeCase.assertion.object();
    revealSets(predicate, target, newCurrent, result);
    revealSets(object, target, newCurrent, result);
  }
  // For leaf envelopes (elided, encrypted, compressed, leaf), no further traversal needed
}

/// Checks if this envelope contains all elements in the target set.
///
/// Used during proof verification to confirm all target elements exist in the proof.
function containsAll(envelope: Envelope, target: Set<Digest>): boolean {
  const targetCopy = new Set(target);
  removeAllFound(envelope, targetCopy);
  return targetCopy.size === 0;
}

/// Recursively traverses the envelope and removes found target elements from the set.
///
/// Used during proof verification to confirm all target elements are present.
function removeAllFound(envelope: Envelope, target: Set<Digest>): void {
  // Check if this envelope's digest is in the target set
  if (containsDigest(target, envelope.digest())) {
    removeDigest(target, envelope.digest());
  }

  // Early exit if all targets found
  if (target.size === 0) {
    return;
  }

  // Traverse the envelope structure
  const envelopeCase = envelope.case();

  if (envelopeCase.type === "node") {
    // Traverse subject
    removeAllFound(envelopeCase.subject, target);

    // Traverse all assertions
    for (const assertion of envelopeCase.assertions) {
      removeAllFound(assertion, target);
      if (target.size === 0) break;
    }
  } else if (envelopeCase.type === "wrapped") {
    // Traverse wrapped envelope
    removeAllFound(envelopeCase.envelope, target);
  } else if (envelopeCase.type === "assertion") {
    // Traverse predicate and object
    const predicate = envelopeCase.assertion.predicate();
    const object = envelopeCase.assertion.object();
    removeAllFound(predicate, target);
    if (target.size > 0) {
      removeAllFound(object, target);
    }
  }
  // For leaf envelopes (elided, encrypted, compressed, leaf), no further traversal needed
}

/// Helper function to check if a set contains a digest (by hex comparison)
function containsDigest(set: Set<Digest>, digest: Digest): boolean {
  const hexToFind = digest.hex();
  for (const d of set) {
    if (d.hex() === hexToFind) {
      return true;
    }
  }
  return false;
}

/// Helper function to remove a digest from a set (by hex comparison)
function removeDigest(set: Set<Digest>, digest: Digest): void {
  const hexToFind = digest.hex();
  for (const d of set) {
    if (d.hex() === hexToFind) {
      set.delete(d);
      return;
    }
  }
}

/// Helper function to check if one set is a subset of another (by hex comparison)
function isSubset(subset: Set<Digest>, superset: Set<Digest>): boolean {
  for (const digest of subset) {
    if (!containsDigest(superset, digest)) {
      return false;
    }
  }
  return true;
}

/// Register proof extension on Envelope prototype.
/// This function is exported to allow explicit registration.
export function registerProofExtension(): void {
  // Methods are already registered above when this module loads
}
