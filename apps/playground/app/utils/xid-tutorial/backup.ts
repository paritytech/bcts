import { Envelope } from "@bcts/envelope";
import { SymmetricKey, SSKRGroupSpec, SSKRSpec, KeyDerivationMethod } from "@bcts/components";

const textEncoder = new TextEncoder();

// `sskrJoin` is a *static* extension method and `fromURString` a static
// constructor; neither carries its type across the package boundary, so we
// reach them through a narrow cast (the same pattern the CLI `join` command
// and `identity.ts` use). Instance methods (`wrap`, `encryptSubject`,
// `sskrSplitFlattened`, `unwrap`, `addSecret`) are typed on `Envelope`.
const EnvelopeStatic = Envelope as unknown as {
  sskrJoin(envelopes: Envelope[]): Envelope;
  fromURString(s: string): Envelope;
};

/**
 * SSKR-split an envelope into flat share UR strings. Byte-for-byte mirror of
 * `envelope sskr split` (`tools/envelope-cli/src/cmd/sskr/split.ts`): wrap the
 * envelope, encrypt its subject under a fresh random content key, then split
 * that key across the requested groups. Default tutorial spec is `(1, [[2,3]])`
 * → a single 2-of-3 group. (§5.3 / §5.4 / §5.5)
 */
export function sskrSplitEnvelope(
  env: Envelope,
  groupThreshold: number,
  groups: [number, number][],
): string[] {
  const contentKey = SymmetricKey.new();
  const wrapped = env.wrap();
  const encrypted = wrapped.encryptSubject(contentKey);
  const groupSpecs = groups.map(([m, n]) => SSKRGroupSpec.new(m, n));
  const spec = SSKRSpec.new(groupThreshold, groupSpecs);
  const shares = encrypted.sskrSplitFlattened(spec, contentKey);
  return shares.map((s) => s.urString());
}

/**
 * Recombine SSKR shares back into the original envelope. Mirror of
 * `envelope sskr join`: combine the shares to recover the wrapped envelope,
 * then unwrap it. (§5.3 / §5.5)
 */
export function sskrJoinShares(shareUrs: string[]): Envelope {
  const envs = shareUrs.map((ur) => EnvelopeStatic.fromURString(ur.trim()));
  const wrapped = EnvelopeStatic.sskrJoin(envs);
  return wrapped.unwrap();
}

/** Safe wrapper around {@link sskrJoinShares}. */
export function trySskrJoin(
  shareUrs: string[],
): { ok: true; env: Envelope } | { ok: false; reason: string } {
  try {
    return { ok: true, env: sskrJoinShares(shareUrs) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "recovery failed" };
  }
}

/**
 * Password-encrypt an envelope's subject (Argon2id). Mirror of
 * `envelope encrypt --password` (`tools/envelope-cli/src/cmd/encrypt.ts`):
 * encrypt the subject under a fresh content key, then lock that content key
 * with the password via `addSecret`. (§5.4)
 */
export function passwordEncrypt(env: Envelope, password: string): Envelope {
  const contentKey = SymmetricKey.new();
  const encrypted = env.encryptSubject(contentKey);
  return encrypted.addSecret(
    KeyDerivationMethod.Argon2id,
    textEncoder.encode(password),
    contentKey,
  );
}
