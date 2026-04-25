import { Envelope } from "@bcts/envelope";
import { IS_A, SOURCE, TARGET, DATE, VERIFIABLE_AT } from "@bcts/known-values";
import type { PrivateKeys, PublicKeys } from "@bcts/components";
import type { XIDDocument } from "@bcts/xid";

export interface FairWitnessInput {
  claim: string;
  sourceXidUr: string;
  targetXidUr: string;
  verifiableAt?: string;
  date?: Date;
  extras?: Record<string, string>;
}

function parseXidUrToEnvelope(ur: string): Envelope {
  return (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(ur);
}

/** Build + wrap + sign a fair-witness attestation (pattern from §2.1). */
export function buildSignedAttestation(input: FairWitnessInput, signer: PrivateKeys): Envelope {
  const src = parseXidUrToEnvelope(input.sourceXidUr);
  const tgt = parseXidUrToEnvelope(input.targetXidUr);

  let env = Envelope.new(input.claim)
    .addAssertion(IS_A, "attestation")
    .addAssertionEnvelope(Envelope.newAssertion(SOURCE, src))
    .addAssertionEnvelope(Envelope.newAssertion(TARGET, tgt))
    .addAssertion(DATE, (input.date ?? new Date()).toISOString());

  if (input.verifiableAt) env = env.addAssertion(VERIFIABLE_AT, input.verifiableAt);
  if (input.extras) {
    for (const [k, v] of Object.entries(input.extras)) if (v) env = env.addAssertion(k, v);
  }
  return env.wrap().sign(signer);
}

/** Try every key in a XID until one verifies the attestation signature. */
export function verifyAttestationAgainstXid(
  signed: Envelope,
  doc: XIDDocument,
): { verified: boolean; keyNickname?: string; matchedPublicKeys?: PublicKeys } {
  for (const k of doc.keys()) {
    const pub = k.publicKeys();
    try {
      if (signed.hasSignatureFrom(pub)) {
        return {
          verified: true,
          keyNickname: k.nickname() || undefined,
          matchedPublicKeys: pub,
        };
      }
    } catch {
      continue;
    }
  }
  return { verified: false };
}

/** Produce a superseding attestation that references the prior digest. */
export function buildSupersedingAttestation(
  original: Envelope,
  input: FairWitnessInput,
  signer: PrivateKeys,
): Envelope {
  const originalDigest = original.digest();
  const src = parseXidUrToEnvelope(input.sourceXidUr);
  const tgt = parseXidUrToEnvelope(input.targetXidUr);

  let env = Envelope.new(input.claim)
    .addAssertion(IS_A, "attestation")
    .addAssertion("supersedes", originalDigest)
    .addAssertionEnvelope(Envelope.newAssertion(SOURCE, src))
    .addAssertionEnvelope(Envelope.newAssertion(TARGET, tgt))
    .addAssertion(DATE, (input.date ?? new Date()).toISOString());

  if (input.verifiableAt) env = env.addAssertion(VERIFIABLE_AT, input.verifiableAt);
  if (input.extras) {
    for (const [k, v] of Object.entries(input.extras)) if (v) env = env.addAssertion(k, v);
  }
  return env.wrap().sign(signer);
}

/** Produce a retraction envelope referencing the original by digest. */
export function buildRetractionAttestation(
  original: Envelope,
  reason: string,
  signer: PrivateKeys,
  subjectText?: string,
): Envelope {
  const d = original.digest();
  const env = Envelope.new(subjectText ?? "RETRACTED: prior attestation")
    .addAssertion(IS_A, "retraction")
    .addAssertion("retracts", d)
    .addAssertion("reason", reason);
  return env.wrap().sign(signer);
}
