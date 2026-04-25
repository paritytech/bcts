import type { Envelope } from "@bcts/envelope";

/** Fully elide an envelope by removing its own root digest target.
 *  Result is `ELIDED` alone — same digest as the original (§2.2 pattern). */
export function commitElide(signed: Envelope): Envelope {
  return signed.elideRemovingTarget(signed);
}

/** Elide a specific assertion by predicate. The predicate stays in the tree; the whole
 *  assertion becomes ELIDED. */
export function elideAssertionByPredicate(env: Envelope, predicate: unknown): Envelope {
  try {
    const assertion = env.assertionWithPredicate(predicate as never);
    return env.elideRemovingTarget(assertion);
  } catch {
    return env;
  }
}

/** Elide only the object of an assertion (leaving the predicate visible). §4.3 pattern. */
export function elideObjectByPredicate(env: Envelope, predicate: unknown): Envelope {
  try {
    const obj = env.objectForPredicate(predicate as never);
    return env.elideRemovingTarget(obj);
  } catch {
    return env;
  }
}

/** Compare two envelopes' root digests for equality (inclusion proof check). */
export function digestsMatch(a: Envelope, b: Envelope): boolean {
  return a.digest().hex() === b.digest().hex();
}
