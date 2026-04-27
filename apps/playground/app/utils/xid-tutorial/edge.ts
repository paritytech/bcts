import { Envelope } from "@bcts/envelope";
import { IS_A, SOURCE, TARGET, DATE, VERIFIABLE_AT, CONFORMS_TO } from "@bcts/known-values";
import { XID, PublicKeys, type PrivateKeys, type SigningOptions } from "@bcts/components";
import type { XIDDocument } from "@bcts/xid";

export interface EdgeTargetInput {
  xidUr: string;
  extras?: Record<string, string | number | boolean>;
  /** Optional SSH public keys to embed as `sshSigningKey` (UR) — mirrors
   * the upstream tutorial's `pred-obj string "sshSigningKey" ur $SSH_PUBKEYS`. */
  sshPublicKeysUr?: string;
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

// Edge `source` / `target` sub-envelopes are built from the XID *identifier*
// (a tagged value), not the full XID document envelope. Parse the `ur:xid/…`
// string and wrap it as an envelope subject.
function parseXid(ur: string): Envelope {
  return Envelope.new(XID.fromURString(ur));
}

function buildSubEnvelope(input: EdgeTargetInput): Envelope {
  let env = parseXid(input.xidUr);
  if (input.extras) {
    for (const [k, v] of Object.entries(input.extras)) {
      if (v === undefined || v === null || v === "") continue;
      env = env.addAssertion(k, v);
    }
  }
  if (input.sshPublicKeysUr) {
    const pubKeys = PublicKeys.fromURString(input.sshPublicKeysUr);
    env = env.addAssertion("sshSigningKey", pubKeys);
  }
  return env;
}

/** Build + wrap + sign an edge envelope (§3.1 pattern).
 *
 * SSH signing keys need a per-signer `SigningOptions.Ssh { namespace, hashAlg }`
 * — the same defaults the `envelope sign` CLI uses (`tools/envelope-cli/src/cmd/sign.ts:69`).
 */
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

  const options: SigningOptions | undefined = signer.signingPrivateKey().isSsh()
    ? { type: "Ssh", namespace: "envelope", hashAlg: "sha256" }
    : undefined;
  return edge.signOpt(signer, options);
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

/** Pull the embedded SSH `PublicKeys` out of an edge's target sub-envelope.
 *
 * The edge target was built with `addAssertion("sshSigningKey", pubKeys)`
 * (`buildSubEnvelope`), so the object is a tagged-CBOR `PublicKeys`. This
 * mirrors the upstream §3.2 verification flow which extracts the SSH key from
 * the GitHub attachment and verifies the signature against it. */
export function extractEdgeSshPublicKeys(edge: Envelope): PublicKeys | undefined {
  try {
    const target = extractEdgeTarget(edge);
    const obj = target.objectForPredicate("sshSigningKey" as never);
    const ext = obj as unknown as {
      extractSubject<T>(decoder: (cbor: unknown) => T): T;
    };
    return ext.extractSubject((cbor) => PublicKeys.fromTaggedCbor(cbor as never));
  } catch {
    return undefined;
  }
}
