/**
 * Alice's X3DH session initialization.
 *
 * Alice performs X3DH key agreement to establish a session with Bob,
 * using Bob's published prekey bundle.
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs (initialize_alice_session)
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import { IdentityKey, type IdentityKeyPair } from "../keys/identity-key.js";
import { KeyPair } from "../keys/key-pair.js";
import { SessionState } from "../session/session-state.js";
import { RootKey } from "../ratchet/root-key.js";
import { ChainKey } from "../ratchet/chain-key.js";
import { PqRatchetState } from "../ratchet/pq-ratchet.js";
import { hkdfSha256 } from "../crypto/kdf.js";
import { x25519RawAgreement } from "../crypto/agreement.js";
import {
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
} from "../constants.js";

export interface AliceProtocolParameters {
  ourIdentityKeyPair: IdentityKeyPair;
  ourBaseKeyPair: KeyPair;
  theirIdentityKey: IdentityKey;
  theirSignedPreKey: Uint8Array;
  theirOneTimePreKey?: Uint8Array;
  theirRatchetKey: Uint8Array;
  kyberSharedSecret?: Uint8Array;
}

/**
 * HKDF info label for pre-Kyber (version 3) X3DH.
 *
 * Note: Signal version 4 uses "WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024"
 * but since we implement version 3 (no Kyber), we use the shorter label.
 * However, the actual label used in Signal's derive_keys is the Kyber one
 * even for version 3 sessions (for backward compat when sessions were created
 * before Kyber was added). For wire compatibility, we use the same label.
 */
const X3DH_INFO = new TextEncoder().encode("WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024");

/**
 * Initialize Alice's side of a Signal session using X3DH.
 *
 * Implementation (pre-Kyber version 3):
 * 1. secrets = [0xFF × 32] (discontinuity bytes)
 * 2. DH(our_identity_private, their_signed_prekey)
 * 3. DH(our_base_private, their_identity_public)
 * 4. DH(our_base_private, their_signed_prekey)
 * 5. if (their_one_time_prekey) DH(our_base_private, their_one_time_prekey)
 * 6. HKDF to derive root key + chain key
 * 7. Generate sending ratchet key pair
 * 8. DH ratchet step to derive sending chain
 */
export function initializeAliceSession(
  params: AliceProtocolParameters,
  rng: RandomNumberGenerator,
): SessionState {
  const secrets: Uint8Array[] = [];

  // 1. Discontinuity bytes (32 × 0xFF)
  secrets.push(new Uint8Array(32).fill(0xff));

  // 2. DH(our_identity_private, their_signed_prekey)
  // Identity keys are X25519-native — no conversion needed.
  secrets.push(x25519RawAgreement(params.ourIdentityKeyPair.privateKey, params.theirSignedPreKey));

  // 3. DH(our_base_private, their_identity_public)
  secrets.push(
    x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirIdentityKey.publicKey),
  );

  // 4. DH(our_base_private, their_signed_prekey)
  secrets.push(x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirSignedPreKey));

  // 5. Optional one-time prekey
  if (params.theirOneTimePreKey) {
    secrets.push(x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirOneTimePreKey));
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
  // Signal derives 96 bytes (root=32 + chain=32 + pqr=32)
  const derived = hkdfSha256(secretInput, undefined, X3DH_INFO, 96);
  const rootKey = new RootKey(derived.slice(0, 32));
  const chainKey = new ChainKey(derived.slice(32, 64), 0);
  const pqrInitialKey = derived.slice(64, 96);

  // 7. Create PQR state before initial createChain so both sides match
  const sessionVersion = params.kyberSharedSecret
    ? CIPHERTEXT_MESSAGE_CURRENT_VERSION
    : CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION;

  let pqState: PqRatchetState | undefined;
  if (params.kyberSharedSecret) {
    pqState = new PqRatchetState(pqrInitialKey);
  }

  // 8. Generate sending ratchet key pair
  const sendingRatchetKey = KeyPair.generate(rng);

  // 9. DH ratchet step to derive sending chain (NO PQ — PQ is per-message)
  const [sendingRootKey, sendingChainKey] = rootKey.createChain(
    params.theirRatchetKey,
    sendingRatchetKey,
  );

  // 10. Create session state
  const session = new SessionState({
    sessionVersion,
    localIdentityKey: params.ourIdentityKeyPair.identityKey,
    remoteIdentityKey: params.theirIdentityKey,
    rootKey: sendingRootKey,
    aliceBaseKey: params.ourBaseKeyPair.publicKey,
  })
    .withReceiverChain(params.theirRatchetKey, chainKey)
    .withSenderChain(sendingRatchetKey, sendingChainKey);

  if (pqState) {
    session.setPqRatchetState(pqState);
  }

  return session;
}
