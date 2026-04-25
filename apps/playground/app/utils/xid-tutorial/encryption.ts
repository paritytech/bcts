import type { Envelope } from "@bcts/envelope";
import type { PublicKeys, PrivateKeys } from "@bcts/components";

/** Encrypt an already-signed envelope for a specific recipient's public keys.
 *  Returns ENCRYPTED + 'hasRecipient': SealedMessage + 'signed': Signature (§2.3). */
export function encryptForRecipient(signed: Envelope, recipient: PublicKeys): Envelope {
  return signed.encryptSubjectToRecipient(recipient);
}

/** Encrypt for several recipients at once. Each recipient can decrypt independently. */
export function encryptForRecipients(signed: Envelope, recipients: PublicKeys[]): Envelope {
  return signed.encryptSubjectToRecipients(recipients);
}

/** Decrypt an envelope with a recipient private key; returns the decrypted envelope. */
export function decryptForRecipient(env: Envelope, recipient: PrivateKeys): Envelope {
  return env.decryptSubjectToRecipient(recipient);
}

/** Safe wrapper — catches the "not a valid recipient" error. */
export function tryDecrypt(
  env: Envelope,
  recipient: PrivateKeys,
): { ok: true; env: Envelope } | { ok: false; reason: string } {
  try {
    return { ok: true, env: env.decryptSubjectToRecipient(recipient) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "decryption failed" };
  }
}
