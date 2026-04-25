import { Envelope } from "@bcts/envelope";
import { IS_A, SOURCE, TARGET, DATE, VERIFIABLE_AT, CONFORMS_TO } from "@bcts/known-values";
import type { PrivateKeys, PublicKeys } from "@bcts/components";
import type { XIDDocument } from "@bcts/xid";

export interface EdgeTargetInput {
  xidUr: string;
  extras?: Record<string, string | number | boolean>;
}

export interface EdgeBuildInput {
  subject: string;
  isA: string;
  source: EdgeTargetInput;
  target: EdgeTargetInput;
  date?: Date;
  conformsTo?: string;
  verifiableAt?: string;
}

function parseXid(ur: string): Envelope {
  return (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(ur);
}

function buildSubEnvelope(input: EdgeTargetInput): Envelope {
  let env = parseXid(input.xidUr);
  if (input.extras) {
    for (const [k, v] of Object.entries(input.extras)) {
      if (v === undefined || v === null || v === "") continue;
      env = env.addAssertion(k, v);
    }
  }
  return env;
}

/** Build + wrap + sign an edge envelope (§3.1 pattern). */
export function buildSignedEdge(input: EdgeBuildInput, signer: PrivateKeys): Envelope {
  const src = buildSubEnvelope(input.source);
  const tgt = buildSubEnvelope(input.target);

  let edge = Envelope.new(input.subject)
    .addAssertion(IS_A, input.isA)
    .addAssertionEnvelope(Envelope.newAssertion(SOURCE, src))
    .addAssertionEnvelope(Envelope.newAssertion(TARGET, tgt));

  if (input.conformsTo) edge = edge.addAssertion(CONFORMS_TO, input.conformsTo);
  if (input.date) edge = edge.addAssertion(DATE, input.date.toISOString());
  if (input.verifiableAt) edge = edge.addAssertion(VERIFIABLE_AT, input.verifiableAt);

  return edge.wrap().sign(signer);
}

/** Attach a signed edge to a XID. */
export function attachEdge(doc: XIDDocument, signedEdge: Envelope): void {
  doc.addEdge(signedEdge);
}

/** Remove an edge by its digest. */
export function removeEdgeByDigest(doc: XIDDocument, edge: Envelope): boolean {
  const removed = doc.removeEdge(edge.digest());
  return removed !== undefined;
}

/** Navigate into an edge to get the unwrapped inner envelope. */
export function unwrapEdge(edge: Envelope): Envelope {
  return edge.tryUnwrap();
}

/** Pull the target sub-envelope out of a wrapped edge. */
export function extractEdgeTarget(edge: Envelope): Envelope {
  const inner = edge.tryUnwrap();
  const targetAssertion = inner.assertionWithPredicate(TARGET);
  // targetAssertion is a full assertion envelope. The object is the target sub-envelope.
  const obj = (
    targetAssertion as unknown as {
      case(): { type: "assertion"; assertion: { object(): Envelope } };
    }
  ).case();
  if (obj.type !== "assertion") throw new Error("target predicate is not an assertion");
  return obj.assertion.object();
}

/** Pull a named assertion's string value out of a sub-envelope. */
export function extractString(env: Envelope, predicate: unknown): string | undefined {
  try {
    const obj = env.objectForPredicate(predicate as never);
    const ext = obj as unknown as { asText(): string | undefined };
    return ext.asText?.();
  } catch {
    return undefined;
  }
}

/** Verify a signed edge's signature against a given SSH or attestation key. */
export function verifyEdgeSignature(edge: Envelope, pub: PublicKeys): boolean {
  try {
    return edge.hasSignatureFrom(pub);
  } catch {
    return false;
  }
}
