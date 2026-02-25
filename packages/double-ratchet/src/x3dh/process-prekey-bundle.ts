/**
 * Alice processes Bob's prekey bundle to establish a session (classic X3DH v3).
 *
 * Reference: libsignal/rust/protocol/src/session.rs (process_prekey_bundle)
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import { type PreKeyBundle } from "../keys/pre-key-bundle.js";
import { KeyPair } from "../keys/key-pair.js";
import { SessionRecord } from "../session/session-record.js";
import {
  type ProtocolAddress,
  type SessionStore,
  type IdentityKeyStore,
} from "../storage/interfaces.js";
import { UntrustedIdentityError, SignatureValidationError } from "../error.js";
import { initializeAliceSession } from "./alice-session.js";

/**
 * Process a prekey bundle to establish a session with a remote party.
 *
 * 1. Validates the signed prekey signature
 * 2. Checks identity trust
 * 3. Generates ephemeral base key
 * 4. Initializes Alice's session via X3DH (v3)
 * 5. Stores session with pending prekey info
 */
export async function processPreKeyBundle(
  bundle: PreKeyBundle,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  rng: RandomNumberGenerator,
  now: number = Date.now(),
): Promise<void> {
  const theirIdentityKey = bundle.identityKey;

  // 1. Check trust
  if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "sending"))) {
    throw new UntrustedIdentityError(remoteAddress.toString());
  }

  // 2. Verify signed prekey signature
  const serializedSignedPreKey = new Uint8Array(33);
  serializedSignedPreKey[0] = 0x05;
  serializedSignedPreKey.set(bundle.signedPreKey, 1);
  if (!theirIdentityKey.verifySignature(serializedSignedPreKey, bundle.signedPreKeySignature)) {
    throw new SignatureValidationError();
  }

  // 3. Load or create session record
  const sessionRecord = (await sessionStore.loadSession(remoteAddress)) ?? SessionRecord.newFresh();

  // 4. Generate ephemeral base key pair
  const ourBaseKeyPair = KeyPair.generate(rng);

  // 5. Get our identity key pair
  const ourIdentityKeyPair = await identityStore.getIdentityKeyPair();

  // 6. Initialize Alice session (classic X3DH, no Kyber)
  const aliceParams: Parameters<typeof initializeAliceSession>[0] = {
    ourIdentityKeyPair,
    ourBaseKeyPair,
    theirIdentityKey,
    theirSignedPreKey: bundle.signedPreKey,
    theirRatchetKey: bundle.signedPreKey, // signed prekey is also ratchet key
  };
  if (bundle.preKey != null) aliceParams.theirOneTimePreKey = bundle.preKey;
  const session = initializeAliceSession(aliceParams, rng);

  // 7. Set pending prekey info
  session.setPendingPreKey({
    preKeyId: bundle.preKeyId,
    signedPreKeyId: bundle.signedPreKeyId,
    baseKey: ourBaseKeyPair.publicKey,
    timestamp: now,
  });

  // 8. Set registration IDs
  session.setLocalRegistrationId(await identityStore.getLocalRegistrationId());
  session.setRemoteRegistrationId(bundle.registrationId);

  // 9. Save identity and session
  await identityStore.saveIdentity(remoteAddress, theirIdentityKey);

  sessionRecord.promoteState(session);
  await sessionStore.storeSession(remoteAddress, sessionRecord);
}
