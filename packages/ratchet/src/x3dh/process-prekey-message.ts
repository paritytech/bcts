/**
 * Bob processes Alice's PreKeySignalMessage to establish a session.
 *
 * Reference: libsignal/rust/protocol/src/session.rs (process_prekey)
 */

import type { PreKeySignalMessage } from "../protocol/pre-key-signal-message.js";
import { SessionRecord } from "../session/session-record.js";
import type { SessionState } from "../session/session-state.js";
import {
  type ProtocolAddress,
  type IdentityKeyStore,
  type PreKeyStore,
  type SignedPreKeyStore,
  type KyberPreKeyStore,
} from "../storage/interfaces.js";
import { UntrustedIdentityError, InvalidMessageError } from "../error.js";
import { CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION } from "../constants.js";
import { initializeBobSession } from "./bob-session.js";
import { kemDecapsulate, kemDeserializeCiphertext } from "../kem/kem-types.js";

export interface PreKeysUsed {
  oneTimePreKeyId: number | undefined;
  signedPreKeyId: number;
  kyberPreKeyId?: number;
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
  kyberPreKeyStore?: KyberPreKeyStore,
): Promise<{ preKeysUsed: PreKeysUsed | undefined; sessionState: SessionState }> {
  const theirIdentityKey = message.identityKey;

  // 1. Check trust
  if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "receiving"))) {
    throw new UntrustedIdentityError(remoteAddress.toString());
  }

  // 1b. Check for existing matching session FIRST (raw 32-byte key, no prefix).
  // This must happen before the version check so we don't reject a session
  // that has already been set up (we already performed XDH for it).
  // Matches libsignal: process_prekey_impl checks promote_matching_session first.
  if (sessionRecord.promoteMatchingSession(message.messageVersion, message.baseKey)) {
    // Already have a session for this message
    return {
      preKeysUsed: undefined,
      sessionState: sessionRecord.sessionState()!,
    };
  }

  // 1c. Reject pre-Kyber (v3) sessions — libsignal no longer supports X3DH-only.
  // Specifically return InvalidMessageError (not LegacyCiphertextVersion) so the
  // sender and receiver can move to a PQXDH session (matches libsignal behavior).
  if (message.messageVersion === CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION) {
    throw new InvalidMessageError("X3DH no longer supported");
  }

  // 1d. Require Kyber pre-key for v4 messages
  if (message.kyberPreKeyId === undefined) {
    throw new InvalidMessageError("missing pq pre-key ID");
  }

  // 3. Load signed prekey
  const ourSignedPreKeyRecord = await signedPreKeyStore.loadSignedPreKey(message.signedPreKeyId);

  // 4. Load optional one-time prekey
  let ourOneTimePreKeyPair;
  if (message.preKeyId !== undefined) {
    const preKeyRecord = await preKeyStore.loadPreKey(message.preKeyId);
    ourOneTimePreKeyPair = preKeyRecord.keyPair;
  }

  // 4b. Load and decapsulate Kyber pre-key (v4)
  let kyberSharedSecret: Uint8Array | undefined;
  if (message.kyberPreKeyId !== undefined && message.kyberCiphertext && kyberPreKeyStore) {
    const kyberPreKey = await kyberPreKeyStore.loadKyberPreKey(message.kyberPreKeyId);
    const { ciphertext: rawCiphertext } = kemDeserializeCiphertext(message.kyberCiphertext);
    kyberSharedSecret = kemDecapsulate(rawCiphertext, kyberPreKey.keyPair.secretKey);
  }

  // 5. Get our identity key pair
  const ourIdentityKeyPair = await identityStore.getIdentityKeyPair();

  // 6. Initialize Bob session
  const newSession = initializeBobSession({
    ourIdentityKeyPair,
    ourSignedPreKeyPair: ourSignedPreKeyRecord.keyPair,
    ourOneTimePreKeyPair,
    ourRatchetKeyPair: ourSignedPreKeyRecord.keyPair, // signed prekey is also ratchet key
    theirIdentityKey,
    theirBaseKey: message.baseKey,
    kyberSharedSecret,
  });

  // 7. Set registration IDs
  newSession.setLocalRegistrationId(await identityStore.getLocalRegistrationId());
  newSession.setRemoteRegistrationId(message.registrationId);

  // 8. Promote new session
  sessionRecord.promoteState(newSession);

  return {
    preKeysUsed: {
      oneTimePreKeyId: message.preKeyId,
      signedPreKeyId: message.signedPreKeyId,
      kyberPreKeyId: message.kyberPreKeyId,
    },
    sessionState: newSession,
  };
}
