/**
 * PreKey bundle processing with Kyber (PQXDH).
 *
 * Alice processes Bob's published PQXDH pre-key bundle to establish a
 * triple-ratchet session. This extends the classical X3DH process_prekey_bundle
 * with ML-KEM encapsulation.
 *
 * Flow:
 *   1. Validate signed prekey signature (identity key signs signed prekey)
 *   2. Validate kyber prekey signature (identity key signs kyber prekey)
 *   3. Check identity trust
 *   4. Generate ephemeral base key
 *   5. ML-KEM encapsulate: (sharedSecret, ciphertext) = encapsulate(bundle.kyberPreKey)
 *   6. Initialize Alice session via initializeAliceSession (PQXDH)
 *   7. Set pending prekey (include kyber ciphertext + kyber prekey ID)
 *   8. Save session
 *
 * Reference: libsignal/rust/protocol/src/session.rs (process_prekey_bundle, v4 path)
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import {
  type ProtocolAddress,
  type SessionStore,
  type IdentityKeyStore,
  KeyPair,
  SessionRecord,
  UntrustedIdentityError,
  SignatureValidationError,
} from "@bcts/double-ratchet";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";

import type { PQXDHPreKeyBundle } from "./stores.js";
import { initializeAliceSession } from "./session-init.js";
import { TripleRatchetError, TripleRatchetErrorCode } from "./error.js";
import { KYBER_KEY_TYPE_BYTE } from "./constants.js";
import type { AlicePQXDHParameters } from "./types.js";

/**
 * Process a PQXDH pre-key bundle to establish a triple-ratchet session
 * with a remote party.
 *
 * @param bundle - Bob's published PQXDH pre-key bundle
 * @param remoteAddress - Protocol address of the remote party
 * @param sessionStore - Session persistence store
 * @param identityStore - Identity key persistence and trust decisions
 * @param rng - Cryptographic random byte generator
 * @param now - Current timestamp in milliseconds (defaults to Date.now())
 */
export async function processPreKeyBundle(
  bundle: PQXDHPreKeyBundle,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  rng: RandomNumberGenerator,
  now: number = Date.now(),
): Promise<void> {
  const theirIdentityKey = bundle.identityKey;

  // 1. Check trust
  if (
    !(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "sending"))
  ) {
    throw new UntrustedIdentityError(remoteAddress.toString());
  }

  // 2. Verify signed prekey signature
  //    The signed prekey is serialized with 0x05 DJB prefix (33 bytes) for
  //    signature verification, matching libsignal's behavior.
  const serializedSignedPreKey = new Uint8Array(33);
  serializedSignedPreKey[0] = 0x05;
  serializedSignedPreKey.set(bundle.signedPreKey, 1);
  if (
    !theirIdentityKey.verifySignature(
      serializedSignedPreKey,
      bundle.signedPreKeySignature,
    )
  ) {
    throw new SignatureValidationError();
  }

  // 3. Verify kyber prekey signature
  //    The kyber public key is serialized with 0x08 type prefix for
  //    signature verification, matching libsignal's behavior.
  const serializedKyberPreKey = new Uint8Array(1 + bundle.kyberPreKey.length);
  serializedKyberPreKey[0] = KYBER_KEY_TYPE_BYTE;
  serializedKyberPreKey.set(bundle.kyberPreKey, 1);
  if (
    !theirIdentityKey.verifySignature(
      serializedKyberPreKey,
      bundle.kyberPreKeySignature,
    )
  ) {
    throw new TripleRatchetError(
      "Kyber pre-key signature verification failed",
      TripleRatchetErrorCode.MissingKyberPreKey,
    );
  }

  // 4. Load or create session record
  const sessionRecord =
    (await sessionStore.loadSession(remoteAddress)) ?? SessionRecord.newFresh();

  // 5. Generate ephemeral base key pair
  const ourBaseKeyPair = KeyPair.generate(rng);

  // 6. Get our identity key pair
  const ourIdentityKeyPair = await identityStore.getIdentityKeyPair();

  // 7. ML-KEM encapsulate: (sharedSecret, ciphertext)
  const encapsResult = ml_kem1024.encapsulate(bundle.kyberPreKey);
  const kyberSharedSecret = encapsResult.sharedSecret;
  const kyberCiphertext = encapsResult.cipherText;

  // 8. Initialize Alice session via PQXDH
  const aliceParams: AlicePQXDHParameters = {
    ourIdentityKeyPair,
    ourBaseKeyPair,
    theirIdentityKey,
    theirSignedPreKey: bundle.signedPreKey,
    theirOneTimePreKey: bundle.preKey,
    theirRatchetKey: bundle.signedPreKey, // signed prekey doubles as ratchet key
    theirKyberPreKey: bundle.kyberPreKey,
    kyberCiphertext,
    kyberSharedSecret,
  };

  const tripleState = initializeAliceSession(aliceParams, rng);

  // 9. Set pending prekey info
  tripleState.setPendingPreKey({
    preKeyId: bundle.preKeyId,
    signedPreKeyId: bundle.signedPreKeyId,
    baseKey: ourBaseKeyPair.publicKey,
    timestamp: now,
  });

  // 10. Set pending kyber prekey info (separate field for proper serialization)
  tripleState.setPendingKyberPreKey({
    kyberPreKeyId: bundle.kyberPreKeyId,
    kyberCiphertext,
  });

  // 11. Set registration IDs
  tripleState.setLocalRegistrationId(
    await identityStore.getLocalRegistrationId(),
  );
  tripleState.setRemoteRegistrationId(bundle.registrationId);

  // 12. Save identity and session
  await identityStore.saveIdentity(remoteAddress, theirIdentityKey);

  sessionRecord.promoteState(tripleState.innerState());
  await sessionStore.storeSession(remoteAddress, sessionRecord);
}

