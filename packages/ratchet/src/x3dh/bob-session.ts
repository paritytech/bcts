/**
 * Bob's X3DH session initialization.
 *
 * Bob processes Alice's prekey message to establish his side of the session.
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs (initialize_bob_session)
 */

import { IdentityKey, type IdentityKeyPair } from "../keys/identity-key.js";
import type { KeyPair } from "../keys/key-pair.js";
import { SessionState } from "../session/session-state.js";
import { RootKey } from "../ratchet/root-key.js";
import { ChainKey } from "../ratchet/chain-key.js";
import { PqRatchetState } from "../ratchet/pq-ratchet.js";
import { hkdfSha256 } from "../crypto/kdf.js";
import { x25519RawAgreement, isCanonicalPublicKey } from "../crypto/agreement.js";
import { InvalidMessageError } from "../error.js";
import {
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
} from "../constants.js";

export interface BobProtocolParameters {
  ourIdentityKeyPair: IdentityKeyPair;
  ourSignedPreKeyPair: KeyPair;
  ourOneTimePreKeyPair?: KeyPair;
  ourRatchetKeyPair: KeyPair;
  theirIdentityKey: IdentityKey;
  theirBaseKey: Uint8Array;
  kyberSharedSecret?: Uint8Array;
}

const X3DH_INFO = new TextEncoder().encode("WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024");

/**
 * Initialize Bob's side of a Signal session using X3DH.
 *
 * Implementation (pre-Kyber version 3):
 * 1. secrets = [0xFF × 32] (discontinuity bytes)
 * 2. DH(our_signed_prekey_private, their_identity_public)
 * 3. DH(our_identity_private, their_base_key)
 * 4. DH(our_signed_prekey_private, their_base_key)
 * 5. if (our_one_time_prekey) DH(our_one_time_prekey_private, their_base_key)
 * 6. HKDF to derive root key + chain key
 */
export function initializeBobSession(params: BobProtocolParameters): SessionState {
  // W1: Validate base key canonicity (matches libsignal)
  if (!isCanonicalPublicKey(params.theirBaseKey)) {
    throw new InvalidMessageError("Non-canonical base key");
  }

  const secrets: Uint8Array[] = [];

  // 1. Discontinuity bytes
  secrets.push(new Uint8Array(32).fill(0xff));

  // 2. DH(our_signed_prekey_private, their_identity_public)
  // Identity keys are X25519-native — no conversion needed.
  secrets.push(
    x25519RawAgreement(params.ourSignedPreKeyPair.privateKey, params.theirIdentityKey.publicKey),
  );

  // 3. DH(our_identity_private, their_base_key)
  secrets.push(x25519RawAgreement(params.ourIdentityKeyPair.privateKey, params.theirBaseKey));

  // 4. DH(our_signed_prekey_private, their_base_key)
  secrets.push(x25519RawAgreement(params.ourSignedPreKeyPair.privateKey, params.theirBaseKey));

  // 5. Optional one-time prekey
  if (params.ourOneTimePreKeyPair) {
    secrets.push(x25519RawAgreement(params.ourOneTimePreKeyPair.privateKey, params.theirBaseKey));
  }

  // 5b. Include Kyber shared secret if v4
  if (params.kyberSharedSecret) {
    secrets.push(params.kyberSharedSecret);
  }

  // Concatenate all secrets
  let totalLen = 0;
  for (const s of secrets) totalLen += s.length;
  const secretInput = new Uint8Array(totalLen);
  let offset = 0;
  for (const s of secrets) {
    secretInput.set(s, offset);
    offset += s.length;
  }

  // 6. Derive root key + chain key + pqr_key
  const derived = hkdfSha256(secretInput, undefined, X3DH_INFO, 96);
  const rootKey = new RootKey(derived.slice(0, 32));
  const chainKey = new ChainKey(derived.slice(32, 64), 0);
  const pqrInitialKey = derived.slice(64, 96);

  // 7. Create session state (v4 if Kyber, v3 otherwise)
  const sessionVersion = params.kyberSharedSecret
    ? CIPHERTEXT_MESSAGE_CURRENT_VERSION
    : CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION;

  const session = new SessionState({
    sessionVersion,
    localIdentityKey: params.ourIdentityKeyPair.identityKey,
    remoteIdentityKey: params.theirIdentityKey,
    rootKey,
    aliceBaseKey: params.theirBaseKey,
  }).withSenderChain(params.ourRatchetKeyPair, chainKey);

  if (params.kyberSharedSecret) {
    session.setPqRatchetState(new PqRatchetState(pqrInitialKey));
  }

  return session;
}
