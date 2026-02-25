/**
 * Bob's X3DH session initialization (classic v3, no post-quantum).
 *
 * Bob processes Alice's prekey message to establish his side of the session.
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs (initialize_bob_session)
 */

import { type IdentityKey, type IdentityKeyPair } from "../keys/identity-key.js";
import type { KeyPair } from "../keys/key-pair.js";
import { SessionState } from "../session/session-state.js";
import { RootKey } from "../ratchet/root-key.js";
import { ChainKey } from "../ratchet/chain-key.js";
import { hkdfSha256 } from "../crypto/kdf.js";
import { x25519RawAgreement, isCanonicalPublicKey } from "../crypto/agreement.js";
import { InvalidMessageError } from "../error.js";
import { CIPHERTEXT_MESSAGE_CURRENT_VERSION } from "../constants.js";

export interface BobProtocolParameters {
  ourIdentityKeyPair: IdentityKeyPair;
  ourSignedPreKeyPair: KeyPair;
  ourOneTimePreKeyPair?: KeyPair;
  ourRatchetKeyPair: KeyPair;
  theirIdentityKey: IdentityKey;
  theirBaseKey: Uint8Array;
}

/** HKDF info label for classic X3DH (Signal Protocol v3). */
const X3DH_INFO = new TextEncoder().encode("WhisperText");

/**
 * Initialize Bob's side of a Signal session using X3DH (v3).
 *
 * Secret input construction (mirror of Alice):
 * 1. [0xFF x 32] (discontinuity bytes)
 * 2. DH(our_signed_prekey_private, their_identity_public)  — DH1
 * 3. DH(our_identity_private, their_base_key)              — DH2
 * 4. DH(our_signed_prekey_private, their_base_key)         — DH3
 * 5. [DH(our_one_time_prekey_private, their_base_key)]     — DH4 (optional)
 *
 * HKDF derivation:
 *   derived = HKDF-SHA256(salt=undefined, ikm=secret_input, info="WhisperText", length=64)
 *   rootKey  = derived[0:32]
 *   chainKey = derived[32:64]
 */
export function initializeBobSession(params: BobProtocolParameters): SessionState {
  // W1: Validate base key canonicity (matches libsignal)
  if (!isCanonicalPublicKey(params.theirBaseKey)) {
    throw new InvalidMessageError("Non-canonical base key");
  }

  const secrets: Uint8Array[] = [];

  // 1. Discontinuity bytes
  secrets.push(new Uint8Array(32).fill(0xff));

  // 2. DH1: DH(our_signed_prekey_private, their_identity_public)
  // Identity keys are X25519-native -- no conversion needed.
  secrets.push(
    x25519RawAgreement(params.ourSignedPreKeyPair.privateKey, params.theirIdentityKey.publicKey),
  );

  // 3. DH2: DH(our_identity_private, their_base_key)
  secrets.push(x25519RawAgreement(params.ourIdentityKeyPair.privateKey, params.theirBaseKey));

  // 4. DH3: DH(our_signed_prekey_private, their_base_key)
  secrets.push(x25519RawAgreement(params.ourSignedPreKeyPair.privateKey, params.theirBaseKey));

  // 5. DH4: Optional one-time prekey
  if (params.ourOneTimePreKeyPair != null) {
    secrets.push(x25519RawAgreement(params.ourOneTimePreKeyPair.privateKey, params.theirBaseKey));
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

  // 6. Derive root key + chain key (64 bytes total)
  const derived = hkdfSha256(secretInput, undefined, X3DH_INFO, 64);
  const rootKey = new RootKey(derived.slice(0, 32));
  const chainKey = new ChainKey(derived.slice(32, 64), 0);

  // 7. Create session state (v3)
  const session = new SessionState({
    sessionVersion: CIPHERTEXT_MESSAGE_CURRENT_VERSION,
    localIdentityKey: params.ourIdentityKeyPair.identityKey,
    remoteIdentityKey: params.theirIdentityKey,
    rootKey,
    aliceBaseKey: params.theirBaseKey,
  }).withSenderChain(params.ourRatchetKeyPair, chainKey);

  return session;
}
