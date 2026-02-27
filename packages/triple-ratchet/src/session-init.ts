/**
 * PQXDH session initialization for the triple ratchet.
 *
 * Provides:
 *   - deriveKeys()              — HKDF-SHA256 key derivation (Phase 2)
 *   - spqrChainParams()         — SPQR chain configuration (Phase 2)
 *   - initializeAliceSession()  — Alice's PQXDH session setup (Task 13)
 *   - initializeBobSession()    — Bob's PQXDH session setup (Task 14)
 *
 * Secret input layout (PQXDH):
 *   [0xFF x 32] || DH1 || DH2 || DH3 [|| DH4] || KEM_SS
 *
 * Where:
 *   DH1 = DH(identity_a, signed_prekey_b)
 *   DH2 = DH(base_a, identity_b)
 *   DH3 = DH(base_a, signed_prekey_b)
 *   DH4 = DH(base_a, one_time_prekey_b) [optional]
 *   KEM_SS = ML-KEM-768 shared secret
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs
 */

import {
  hkdfSha256,
  KeyPair,
  RootKey,
  ChainKey,
  SessionState,
  x25519RawAgreement,
  isCanonicalPublicKey,
  InvalidMessageError,
} from "@bcts/double-ratchet";
import type { RandomNumberGenerator } from "@bcts/rand";
import * as spqr from "@bcts/spqr";
import type { ChainParams } from "@bcts/spqr";
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";

import {
  MAX_FORWARD_JUMPS,
  MAX_MESSAGE_KEYS,
  KDF_LABEL_PQXDH,
  DISCONTINUITY_BYTES,
  CIPHERTEXT_MESSAGE_CURRENT_VERSION,
} from "./constants.js";
import type { AlicePQXDHParameters, BobPQXDHParameters, PQXDHDerivedKeys } from "./types.js";
import { TripleRatchetSessionState } from "./session-state.js";

const PQXDH_INFO = new TextEncoder().encode(KDF_LABEL_PQXDH);

// ---------------------------------------------------------------------------
// Key derivation helpers (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Derive root key, chain key, and PQR auth key from PQXDH secret input.
 *
 * HKDF-SHA256(salt=undefined, ikm=secretInput, info=KDF_LABEL_PQXDH, len=96)
 *
 * @param secretInput - Concatenated DH+KEM secrets: 0xFF*32 || DH1 || DH2 || DH3 [|| DH4] || KEM_SS
 * @returns { rootKey[0:32], chainKey[32:64], pqrAuthKey[64:96] }
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs derive_keys
 */
export function deriveKeys(secretInput: Uint8Array): PQXDHDerivedKeys {
  const derived = hkdfSha256(secretInput, undefined, PQXDH_INFO, 96);
  return {
    rootKey: derived.slice(0, 32),
    chainKey: derived.slice(32, 64),
    pqrAuthKey: derived.slice(64, 96),
  };
}

/**
 * Build SPQR chain params based on whether this is a self-session.
 *
 * Self-sessions (same identity on both sides) use maxJump=0xFFFFFFFF
 * to allow unlimited forward jumps.
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs spqr_chain_params
 */
export function spqrChainParams(selfSession: boolean): ChainParams {
  return {
    maxJump: selfSession ? 0xFFFFFFFF : MAX_FORWARD_JUMPS,
    maxOooKeys: MAX_MESSAGE_KEYS,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Concatenate multiple Uint8Arrays into a single buffer.
 */
function concatSecrets(parts: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const s of parts) totalLen += s.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const s of parts) {
    result.set(s, offset);
    offset += s.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Alice session initialization (Task 13)
// ---------------------------------------------------------------------------

/**
 * Initialize Alice's side of a PQXDH session (triple ratchet, v4).
 *
 * Alice has already encapsulated against Bob's ML-KEM pre-key, so
 * `params.kyberSharedSecret` and `params.kyberCiphertext` are ready.
 *
 * Secret input construction:
 *   1. [0xFF x 32]  (discontinuity bytes)
 *   2. DH(ourIdentity, theirSignedPreKey)            -- DH1
 *   3. DH(ourBase, theirIdentity)                    -- DH2
 *   4. DH(ourBase, theirSignedPreKey)                -- DH3
 *   5. [DH(ourBase, theirOneTimePreKey)]             -- DH4 (optional)
 *   6. ML-KEM shared secret                          -- KEM_SS
 *
 * Derives 96 bytes via HKDF:
 *   rootKey(32) + chainKey(32) + pqrAuthKey(32)
 *
 * Then performs an asymmetric DH ratchet step to create the sending chain
 * and initializes SPQR with direction A2B.
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs initialize_alice_session_pqxdh
 *
 * @param params - Alice's PQXDH parameters
 * @param rng    - Random number generator for ephemeral key generation
 * @returns A fully initialized TripleRatchetSessionState
 */
export function initializeAliceSession(
  params: AlicePQXDHParameters,
  rng: RandomNumberGenerator,
): TripleRatchetSessionState {
  // 1. Build secret input
  const secrets: Uint8Array[] = [DISCONTINUITY_BYTES];

  // DH1: DH(ourIdentity, theirSignedPreKey)
  secrets.push(
    x25519RawAgreement(params.ourIdentityKeyPair.privateKey, params.theirSignedPreKey),
  );

  // DH2: DH(ourBase, theirIdentity)
  secrets.push(
    x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirIdentityKey.publicKey),
  );

  // DH3: DH(ourBase, theirSignedPreKey)
  secrets.push(
    x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirSignedPreKey),
  );

  // DH4: DH(ourBase, theirOneTimePreKey) — optional
  if (params.theirOneTimePreKey != null) {
    secrets.push(
      x25519RawAgreement(params.ourBaseKeyPair.privateKey, params.theirOneTimePreKey),
    );
  }

  // KEM: ML-KEM shared secret (already computed by caller)
  secrets.push(params.kyberSharedSecret);

  // 2. Concatenate and derive root key + chain key + PQR auth key
  const secretInput = concatSecrets(secrets);
  const { rootKey: rootKeyBytes, chainKey: chainKeyBytes, pqrAuthKey } = deriveKeys(secretInput);

  const rootKey = new RootKey(rootKeyBytes);
  const chainKey = new ChainKey(chainKeyBytes, 0);

  // 3. Generate sending ratchet key pair
  const sendingRatchetKey = KeyPair.generate(rng);

  // 4. DH ratchet step: derive sending chain from root key
  const [sendingRootKey, sendingChainKey] = rootKey.createChain(
    params.theirRatchetKey,
    sendingRatchetKey,
  );

  // 5. Build inner double-ratchet SessionState (v4)
  const inner = new SessionState({
    sessionVersion: CIPHERTEXT_MESSAGE_CURRENT_VERSION,
    localIdentityKey: params.ourIdentityKeyPair.identityKey,
    remoteIdentityKey: params.theirIdentityKey,
    rootKey: sendingRootKey,
    aliceBaseKey: params.ourBaseKeyPair.publicKey,
  })
    .withReceiverChain(params.theirRatchetKey, chainKey)
    .withSenderChain(sendingRatchetKey, sendingChainKey);

  // 6. Initialize SPQR state
  const selfSession = params.ourIdentityKeyPair.identityKey.equals(params.theirIdentityKey);
  const pqrState = spqr.initialState({
    authKey: pqrAuthKey,
    version: spqr.Version.V1,
    direction: spqr.Direction.A2B,
    minVersion: spqr.Version.V0,
    chainParams: spqrChainParams(selfSession),
  });

  return new TripleRatchetSessionState(inner, pqrState);
}

// ---------------------------------------------------------------------------
// Bob session initialization (Task 14)
// ---------------------------------------------------------------------------

/**
 * Initialize Bob's side of a PQXDH session (triple ratchet, v4).
 *
 * Bob decapsulates the ML-KEM ciphertext to recover the shared secret,
 * then mirrors Alice's DH computations from his perspective.
 *
 * Secret input construction (mirror of Alice):
 *   1. [0xFF x 32]  (discontinuity bytes)
 *   2. DH(ourSignedPreKey, theirIdentity)            -- DH1
 *   3. DH(ourIdentity, theirBase)                    -- DH2
 *   4. DH(ourSignedPreKey, theirBase)                -- DH3
 *   5. [DH(ourOneTimePreKey, theirBase)]             -- DH4 (optional)
 *   6. ML-KEM shared secret (decapsulated)           -- KEM_SS
 *
 * Bob does NOT perform a DH ratchet step. He creates only a sender chain
 * using his ratchet key pair and the derived chain key. Alice will
 * perform the first asymmetric ratchet when she receives Bob's first message.
 *
 * SPQR is initialized with direction B2A (opposite of Alice).
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs initialize_bob_session_pqxdh
 *
 * @param params - Bob's PQXDH parameters
 * @returns A fully initialized TripleRatchetSessionState
 */
export function initializeBobSession(
  params: BobPQXDHParameters,
): TripleRatchetSessionState {
  // W1: Validate base key canonicity (matches libsignal)
  if (!isCanonicalPublicKey(params.theirBaseKey)) {
    throw new InvalidMessageError("Non-canonical base key");
  }

  // 1. Build secret input
  const secrets: Uint8Array[] = [DISCONTINUITY_BYTES];

  // DH1: DH(ourSignedPreKey, theirIdentity)
  secrets.push(
    x25519RawAgreement(params.ourSignedPreKeyPair.privateKey, params.theirIdentityKey.publicKey),
  );

  // DH2: DH(ourIdentity, theirBase)
  secrets.push(
    x25519RawAgreement(params.ourIdentityKeyPair.privateKey, params.theirBaseKey),
  );

  // DH3: DH(ourSignedPreKey, theirBase)
  secrets.push(
    x25519RawAgreement(params.ourSignedPreKeyPair.privateKey, params.theirBaseKey),
  );

  // DH4: DH(ourOneTimePreKey, theirBase) — optional
  if (params.ourOneTimePreKeyPair != null) {
    secrets.push(
      x25519RawAgreement(params.ourOneTimePreKeyPair.privateKey, params.theirBaseKey),
    );
  }

  // KEM: Decapsulate ML-KEM-768 ciphertext to recover shared secret
  const kyberSharedSecret = ml_kem1024.decapsulate(
    params.theirKyberCiphertext,
    params.ourKyberKeyPair.secretKey,
  );
  secrets.push(kyberSharedSecret);

  // 2. Concatenate and derive root key + chain key + PQR auth key
  const secretInput = concatSecrets(secrets);
  const { rootKey: rootKeyBytes, chainKey: chainKeyBytes, pqrAuthKey } = deriveKeys(secretInput);

  const rootKey = new RootKey(rootKeyBytes);
  const chainKey = new ChainKey(chainKeyBytes, 0);

  // 3. Build inner double-ratchet SessionState (v4)
  //    Bob creates only a sender chain — no receiver chain yet.
  //    aliceBaseKey = theirBaseKey (Alice's ephemeral base key).
  const inner = new SessionState({
    sessionVersion: CIPHERTEXT_MESSAGE_CURRENT_VERSION,
    localIdentityKey: params.ourIdentityKeyPair.identityKey,
    remoteIdentityKey: params.theirIdentityKey,
    rootKey,
    aliceBaseKey: params.theirBaseKey,
  }).withSenderChain(params.ourRatchetKeyPair, chainKey);

  // 4. Initialize SPQR state (direction B2A — opposite of Alice)
  const selfSession = params.ourIdentityKeyPair.identityKey.equals(params.theirIdentityKey);
  const pqrState = spqr.initialState({
    authKey: pqrAuthKey,
    version: spqr.Version.V1,
    direction: spqr.Direction.B2A,
    minVersion: spqr.Version.V0,
    chainParams: spqrChainParams(selfSession),
  });

  return new TripleRatchetSessionState(inner, pqrState);
}
