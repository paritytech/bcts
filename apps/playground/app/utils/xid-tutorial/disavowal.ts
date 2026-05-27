import { Envelope } from "@bcts/envelope";
import { IS_A, SOURCE, TARGET, DATE, NICKNAME } from "@bcts/known-values";
import { XID, type PrivateKeys, type SigningOptions } from "@bcts/components";
import type { DisavowedKey } from "./keys";

export interface DisavowalInput {
  /** UR of the disavowing party's XID identifier (becomes subject + edge source). */
  disavowerXidUr: string;
  /** Unique edge subject, e.g. `disavowal-statement-20260505`. */
  subject: string;
  statement: string;
  reason: string;
  date?: Date;
  keys: DisavowedKey[];
}

/**
 * Build + wrap + sign a disavowal statement. Byte-for-byte structural mirror of
 * upstream XID-Quickstart §5.5 Step 9: a standard edge (`isA` / `source` /
 * `target`, per §3.1) whose `target` is an attestation listing each disavowed
 * key (its public keys, `nickname`, and `xidKeyDigest`). Signed by a current,
 * non-compromised key (the new attestation key).
 */
export function buildSignedDisavowal(input: DisavowalInput, signer: PrivateKeys): Envelope {
  const xid = XID.fromURString(input.disavowerXidUr);

  // The disavowal attestation — this becomes the edge `target`.
  let disavowal = Envelope.new(xid)
    .addAssertion("disavowalStatement", input.statement)
    .addAssertion("disavowalReason", input.reason)
    .addAssertion(DATE, (input.date ?? new Date()).toISOString());

  // Recursively embed each disavowed key as a `disavowedKey` sub-envelope.
  for (const k of input.keys) {
    const keyEnv = Envelope.new(k.pubKeys)
      .addAssertion(NICKNAME, k.nickname)
      .addAssertion("xidKeyDigest", k.assertionDigest);
    disavowal = disavowal.addAssertionEnvelope(Envelope.newAssertion("disavowedKey", keyEnv));
  }

  // Wrap it in a standard edge with a unique subject + isA/source/target.
  const edge = Envelope.new(input.subject)
    .addAssertion(IS_A, "signature-disavowal")
    .addAssertion(SOURCE, xid)
    .addAssertionEnvelope(Envelope.newAssertion(TARGET, disavowal));

  // The signer is a freshly-rotated key, so it's never SSH-backed here.
  const options: SigningOptions | undefined = signer.signingPrivateKey().isSsh()
    ? { type: "Ssh", namespace: "envelope", hashAlg: "sha256" }
    : undefined;
  return edge.signOpt(signer, options);
}
