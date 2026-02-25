/**
 * Alice's X3DH session initialization (classic v3, no post-quantum).
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
import { hkdfSha256 } from "../crypto/kdf.js";
import { x25519RawAgreement } from "../crypto/agreement.js";
import { CIPHERTEXT_MESSAGE_CURRENT_VERSION } from "../constants.js";

export interface AliceProtocolParameters {
  ourIdentityKeyPair: IdentityKeyPair;
  ourBaseKeyPair: KeyPair;
  theirIdentityKey: IdentityKey;
  theirSignedPreKey: Uint8Array;
  theirOneTimePreKey?: Uint8Array;
  theirRatchetKey: Uint8Array;
}

/** HKDF info label for classic X3DH (Signal Protocol v3). */
const X3DH_INFO = new TextEncoder().encode("WhisperText");

/**
 * Initialize Alice's side of a Signal session using X3DH (v3).
 *
 * Secret input construction:
 * 1. [0xFF x 32] (discontinuity bytes)
 * 2. DH(our_identity_private, their_signed_prekey)   — DH1
 * 3. DH(our_base_private, their_identity_public)     — DH2
 * 4. DH(our_base_private, their_signed_prekey)       — DH3
 * 5. [DH(our_base_private, their_one_time_prekey)]   — DH4 (optional)
 *
 * HKDF derivation:
 *   derived = HKDF-SHA256(salt=undefined, ikm=secret_input, info="WhisperText", length=64)
 *   rootKey  = derived[0:32]
 *   chainKey = derived[32:64]
 */
export function initializeAliceSession(
  params: AliceProtocolParameters,
  rng: RandomNumberGenerator,
): SessionState {
  const secrets: Uint8Array[] = [];

  // 1. Discontinuity bytes (32 x 0xFF)
  secrets.push(new Uint8Array(32).fill(0xff));

  // 2. DH1: DH(our_identity_private, their_signed_prekey)
  // Identity keys are X25519-native -- no conversion needed.
  secrets.push(x25519RawAgreement(params.ourIdentityKeyPair.privateKey, params.theirSignedPreKey));

  // 3. DH2: DH(our_base_private, their_identity_public)
  secrets.push(
    x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirIdentityKey.publicKey),
  );

  // 4. DH3: DH(our_base_private, their_signed_prekey)
  secrets.push(x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirSignedPreKey));

  // 5. DH4: Optional one-time prekey
  if (params.theirOneTimePreKey) {
    secrets.push(x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirOneTimePreKey));
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

  // 7. Generate sending ratchet key pair
  const sendingRatchetKey = KeyPair.generate(rng);

  // 8. DH ratchet step to derive sending chain
  const [sendingRootKey, sendingChainKey] = rootKey.createChain(
    params.theirRatchetKey,
    sendingRatchetKey,
  );

  // 9. Create session state (v3)
  const session = new SessionState({
    sessionVersion: CIPHERTEXT_MESSAGE_CURRENT_VERSION,
    localIdentityKey: params.ourIdentityKeyPair.identityKey,
    remoteIdentityKey: params.theirIdentityKey,
    rootKey: sendingRootKey,
    aliceBaseKey: params.ourBaseKeyPair.publicKey,
  })
    .withReceiverChain(params.theirRatchetKey, chainKey)
    .withSenderChain(sendingRatchetKey, sendingChainKey);

  return session;
}
