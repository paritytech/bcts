/**
 * Bob processes Alice's PreKeySignalMessage to establish a session (classic X3DH v3).
 *
 * Reference: libsignal/rust/protocol/src/session.rs (process_prekey)
 */

import type { PreKeySignalMessage } from "../protocol/pre-key-signal-message.js";
import { type SessionRecord } from "../session/session-record.js";
import type { SessionState } from "../session/session-state.js";
import {
  type ProtocolAddress,
  type IdentityKeyStore,
  type PreKeyStore,
  type SignedPreKeyStore,
} from "../storage/interfaces.js";
import { UntrustedIdentityError } from "../error.js";
import { initializeBobSession } from "./bob-session.js";

export interface PreKeysUsed {
  oneTimePreKeyId: number | undefined;
  signedPreKeyId: number;
}

/**
 * Process a PreKeySignalMessage to establish Bob's side of the session.
 *
 * Returns the prekeys that were used (so the one-time prekey can be deleted).
 */
export async function processPreKeyMessage(
  message: PreKeySignalMessage,
  remoteAddress: ProtocolAddress,
  sessionRecord: SessionRecord,
  identityStore: IdentityKeyStore,
  preKeyStore: PreKeyStore,
  signedPreKeyStore: SignedPreKeyStore,
): Promise<{ preKeysUsed: PreKeysUsed | undefined; sessionState: SessionState }> {
  const theirIdentityKey = message.identityKey;

  // 1. Check trust
  if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "receiving"))) {
    throw new UntrustedIdentityError(remoteAddress.toString());
  }

  // 1b. Check for existing matching session FIRST (raw 32-byte key, no prefix).
  // This must happen before we do any key agreement work.
  if (sessionRecord.promoteMatchingSession(message.messageVersion, message.baseKey)) {
    // Already have a session for this message
    const matchedState = sessionRecord.sessionState();
    if (matchedState == null) throw new Error("expected session state after promotion");
    return {
      preKeysUsed: undefined,
      sessionState: matchedState,
    };
  }

  // 2. Load signed prekey
  const ourSignedPreKeyRecord = await signedPreKeyStore.loadSignedPreKey(message.signedPreKeyId);

  // 3. Load optional one-time prekey
  let ourOneTimePreKeyPair;
  if (message.preKeyId !== undefined) {
    const preKeyRecord = await preKeyStore.loadPreKey(message.preKeyId);
    ourOneTimePreKeyPair = preKeyRecord.keyPair;
  }

  // 4. Get our identity key pair
  const ourIdentityKeyPair = await identityStore.getIdentityKeyPair();

  // 5. Initialize Bob session (classic X3DH, no Kyber)
  const newSession = initializeBobSession({
    ourIdentityKeyPair,
    ourSignedPreKeyPair: ourSignedPreKeyRecord.keyPair,
    ourOneTimePreKeyPair,
    ourRatchetKeyPair: ourSignedPreKeyRecord.keyPair, // signed prekey is also ratchet key
    theirIdentityKey,
    theirBaseKey: message.baseKey,
  });

  // 6. Set registration IDs
  newSession.setLocalRegistrationId(await identityStore.getLocalRegistrationId());
  newSession.setRemoteRegistrationId(message.registrationId);

  // 7. Promote new session
  sessionRecord.promoteState(newSession);

  return {
    preKeysUsed: {
      oneTimePreKeyId: message.preKeyId,
      signedPreKeyId: message.signedPreKeyId,
    },
    sessionState: newSession,
  };
}
