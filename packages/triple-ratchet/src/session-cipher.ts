// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * Session cipher -- encrypt and decrypt messages using the Triple Ratchet.
 *
 * Wraps the classical double-ratchet session cipher with SPQR (post-quantum
 * ratchet) integration. On every send, the PQ ratchet produces a message and
 * optional key that is mixed into the HKDF salt for message key derivation.
 * On every recv, the PQ ratchet consumes the incoming PQ message to derive
 * the same salt, ensuring forward secrecy even against quantum adversaries.
 *
 * Reference: libsignal/rust/protocol/src/session_cipher.rs (v4/PQXDH path)
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import {
  type ProtocolAddress,
  type SessionStore,
  type IdentityKeyStore,
  type PreKeyStore,
  type SignedPreKeyStore,
  SessionState,
  SessionRecord,
  SessionNotFoundError,
  InvalidMessageError,
  UntrustedIdentityError,
  InvalidSessionError,
  DuplicateMessageError,
  IdentityKey,
  KeyPair,
  aes256CbcEncrypt,
  aes256CbcDecrypt,
} from "@bcts/double-ratchet";

import type { KyberPreKeyStore } from "./stores.js";
import { TripleRatchetSessionState } from "./session-state.js";
import { TripleRatchetSignalMessage, TripleRatchetPreKeySignalMessage } from "./protocol.js";
import { deriveMessageKeys } from "./message-keys.js";
import { initializeBobSession } from "./session-init.js";
import { TripleRatchetError, TripleRatchetErrorCode } from "./error.js";
import type { PreKeysUsed, BobPQXDHParameters } from "./types.js";
import { MAX_UNACKNOWLEDGED_SESSION_AGE_SECS, MAX_FORWARD_JUMPS } from "./constants.js";

// ---------------------------------------------------------------------------
// Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext message using the triple ratchet.
 *
 * Flow:
 * 1. Load session for remote address
 * 2. Get sender chain key
 * 3. PQ ratchet send -> {pqrMsg, pqrKey}
 * 4. Derive message keys: HKDF(salt=pqrKey, ikm=chainSeed, info="WhisperMessageKeys")
 * 5. AES-256-CBC encrypt plaintext
 * 6. Build TripleRatchetSignalMessage with pqrMsg
 * 7. Wrap in PreKeySignalMessage if first message (with kyber fields)
 * 8. Advance chain, save session
 *
 * @param plaintext - The plaintext bytes to encrypt
 * @param remoteAddress - Address of the remote party
 * @param sessionStore - Session persistence
 * @param identityStore - Identity key persistence and trust decisions
 * @param rng - Cryptographic random number generator
 * @param now - Current timestamp in milliseconds (defaults to Date.now())
 * @returns Serialized wire message bytes
 */
export async function tripleRatchetEncrypt(
  plaintext: Uint8Array,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  rng: RandomNumberGenerator,
  now: number = Date.now(),
): Promise<Uint8Array> {
  // 1. Load session
  const sessionRecord = await sessionStore.loadSession(remoteAddress);
  if (sessionRecord == null) {
    throw new SessionNotFoundError(remoteAddress.toString());
  }

  const sessionState = sessionRecord.sessionState();
  if (sessionState == null) {
    throw new SessionNotFoundError(remoteAddress.toString());
  }

  const tripleState = asTripleRatchetState(sessionState);

  // 2. Get sender chain key
  const chainKey = tripleState.getSenderChainKey();
  const chainKeySeed = chainKey.messageKeySeed();
  const counter = chainKey.index;

  // 3. PQ ratchet send -> {msg, key}
  //    SPQR's send() expects RandomBytes = (n: number) => Uint8Array
  const spqrRng = (n: number): Uint8Array => rng.randomData(n);
  let pqrMsg: Uint8Array;
  let pqrKey: Uint8Array | null;
  try {
    const pqResult = tripleState.pqRatchetSend(spqrRng);
    pqrMsg = pqResult.msg;
    pqrKey = pqResult.key;
  } catch (err) {
    if (err instanceof TripleRatchetError) throw err;
    throw new TripleRatchetError(
      "PQ ratchet send failed",
      TripleRatchetErrorCode.PQRatchetSendError,
      err,
    );
  }

  // 4. Derive message keys with PQ salt
  const messageKeys = deriveMessageKeys(chainKeySeed, pqrKey, counter);

  // 5. Read session parameters
  const senderEphemeral = tripleState.senderRatchetKey();
  const previousCounter = tripleState.previousCounter();
  const sessionVersion = tripleState.sessionVersion();

  const localIdentityKey = tripleState.localIdentityKey();
  const theirIdentityKey = tripleState.remoteIdentityKey();
  if (theirIdentityKey == null) {
    throw new InvalidSessionError(`No remote identity key for ${remoteAddress.toString()}`);
  }

  // 6. AES-256-CBC encrypt
  const ciphertext = aes256CbcEncrypt(plaintext, messageKeys.cipherKey, messageKeys.iv);

  // 7. Build message (PreKey or Signal)
  const pendingPreKey = tripleState.pendingPreKey();

  let message: { serialized: Uint8Array };

  if (pendingPreKey != null) {
    // Check for stale unacknowledged session
    if (pendingPreKey.timestamp + MAX_UNACKNOWLEDGED_SESSION_AGE_SECS < Math.floor(now / 1000)) {
      throw new SessionNotFoundError(remoteAddress.toString());
    }

    const signalMessage = TripleRatchetSignalMessage.create(
      sessionVersion,
      messageKeys.macKey,
      senderEphemeral,
      counter,
      previousCounter,
      ciphertext,
      localIdentityKey,
      theirIdentityKey,
      pqrMsg,
    );

    // Extract kyber fields from separate pending kyber prekey
    const pendingKyber = tripleState.pendingKyberPreKey();

    message = TripleRatchetPreKeySignalMessage.create(
      sessionVersion,
      tripleState.localRegistrationId(),
      pendingPreKey.preKeyId,
      pendingPreKey.signedPreKeyId,
      pendingPreKey.baseKey,
      localIdentityKey.serialize(),
      signalMessage,
      pendingKyber?.kyberPreKeyId,
      pendingKyber?.kyberCiphertext,
    );
  } else {
    message = TripleRatchetSignalMessage.create(
      sessionVersion,
      messageKeys.macKey,
      senderEphemeral,
      counter,
      previousCounter,
      ciphertext,
      localIdentityKey,
      theirIdentityKey,
      pqrMsg,
    );
  }

  // 8. Advance sender chain key
  tripleState.setSenderChainKey(chainKey.nextChainKey());

  // Trust check (matches Signal's post-encrypt check)
  if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "sending"))) {
    throw new UntrustedIdentityError(remoteAddress.toString());
  }

  await identityStore.saveIdentity(remoteAddress, theirIdentityKey);
  await sessionStore.storeSession(remoteAddress, sessionRecord);

  return message.serialized;
}

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt a message using the triple ratchet.
 *
 * Flow:
 * 1. Parse message type (PreKey or Signal) from version byte
 * 2. If PreKey: process PQXDH initialization
 * 3. Get/create receiver chain (DH ratchet)
 * 4. Get/create message key seed
 * 5. PQ ratchet recv -> {pqrKey}
 * 6. Derive message keys with PQ salt
 * 7. Verify MAC, decrypt
 * 8. Save session
 *
 * @param message - The serialized wire message bytes
 * @param remoteAddress - Address of the remote party
 * @param sessionStore - Session persistence
 * @param identityStore - Identity key persistence and trust decisions
 * @param preKeyStore - One-time EC pre-key store
 * @param signedPreKeyStore - Signed EC pre-key store
 * @param kyberPreKeyStore - ML-KEM pre-key store
 * @param rng - Cryptographic random number generator
 * @returns Decrypted plaintext bytes
 */
export async function tripleRatchetDecrypt(
  message: Uint8Array,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  preKeyStore: PreKeyStore,
  signedPreKeyStore: SignedPreKeyStore,
  kyberPreKeyStore: KyberPreKeyStore,
  rng: RandomNumberGenerator,
): Promise<Uint8Array> {
  if (message.length === 0) {
    throw new InvalidMessageError("Empty message");
  }

  // Detect message type from version byte.
  // PreKeySignalMessage: version_byte = (v << 4) | v  -> 0x44 for v4
  // SignalMessage:       version_byte = (v << 4) | CURRENT -> 0x44 for v4
  // For v4, both nibbles are equal. Try prekey first, then signal.
  const versionByte = message[0];
  const highNibble = versionByte >> 4;
  const lowNibble = versionByte & 0x0f;
  const isPreKey = highNibble === lowNibble;

  if (isPreKey) {
    try {
      const preKeyMsg = TripleRatchetPreKeySignalMessage.deserialize(message);
      return decryptPreKeyMessage(
        preKeyMsg,
        remoteAddress,
        sessionStore,
        identityStore,
        preKeyStore,
        signedPreKeyStore,
        kyberPreKeyStore,
        rng,
      );
    } catch (err) {
      // If deserialization fails due to missing fields, try as signal message.
      if (err instanceof TripleRatchetError && err.code === TripleRatchetErrorCode.InvalidMessage) {
        // fall through
      } else {
        throw err;
      }
    }
  }

  const signalMsg = TripleRatchetSignalMessage.deserialize(message);
  return decryptSignalMessage(signalMsg, remoteAddress, sessionStore, identityStore, rng);
}

// ---------------------------------------------------------------------------
// PreKey message decryption
// ---------------------------------------------------------------------------

async function decryptPreKeyMessage(
  message: TripleRatchetPreKeySignalMessage,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  preKeyStore: PreKeyStore,
  signedPreKeyStore: SignedPreKeyStore,
  kyberPreKeyStore: KyberPreKeyStore,
  rng: RandomNumberGenerator,
): Promise<Uint8Array> {
  const sessionRecord = (await sessionStore.loadSession(remoteAddress)) ?? SessionRecord.newFresh();

  const { preKeysUsed, theirIdentityKey } = await processTripleRatchetPreKeyMessage(
    message,
    remoteAddress,
    sessionRecord,
    identityStore,
    preKeyStore,
    signedPreKeyStore,
    kyberPreKeyStore,
  );

  // Decrypt the embedded signal message against the session
  const plaintext = decryptWithRecord(sessionRecord, message.message, rng, "prekey");

  // Save identity AFTER successful decryption (M1 fix)
  await identityStore.saveIdentity(remoteAddress, theirIdentityKey);

  // Mark used kyber prekey FIRST (M3 fix: kyber before EC)
  if (preKeysUsed?.kyberPreKeyId !== undefined) {
    await kyberPreKeyStore.markKyberPreKeyUsed(
      preKeysUsed.kyberPreKeyId,
      preKeysUsed.signedEcPreKeyId,
      message.baseKey,
    );
  }

  // Then remove used one-time EC prekey
  if (preKeysUsed?.oneTimeEcPreKeyId !== undefined) {
    await preKeyStore.removePreKey(preKeysUsed.oneTimeEcPreKeyId);
  }

  await sessionStore.storeSession(remoteAddress, sessionRecord);

  return plaintext;
}

// ---------------------------------------------------------------------------
// Signal message decryption
// ---------------------------------------------------------------------------

async function decryptSignalMessage(
  ciphertext: TripleRatchetSignalMessage,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  rng: RandomNumberGenerator,
): Promise<Uint8Array> {
  const sessionRecord = await sessionStore.loadSession(remoteAddress);
  if (sessionRecord == null) {
    throw new SessionNotFoundError(remoteAddress.toString());
  }

  const plaintext = decryptWithRecord(sessionRecord, ciphertext, rng, "signal");

  // Trust check (matches Signal's post-decrypt check)
  const theirIdentityKey = sessionRecord.sessionState()?.remoteIdentityKey();
  if (theirIdentityKey != null) {
    if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "receiving"))) {
      throw new UntrustedIdentityError(remoteAddress.toString());
    }
    await identityStore.saveIdentity(remoteAddress, theirIdentityKey);
  }

  await sessionStore.storeSession(remoteAddress, sessionRecord);

  return plaintext;
}

// ---------------------------------------------------------------------------
// Core decryption with session record (tries current + previous sessions)
// ---------------------------------------------------------------------------

function decryptWithRecord(
  record: SessionRecord,
  ciphertext: TripleRatchetSignalMessage,
  rng: RandomNumberGenerator,
  originalMessageType: "prekey" | "signal",
): Uint8Array {
  const errors: Error[] = [];

  // Try current session
  const currentSessionState = record.sessionState();
  if (currentSessionState != null) {
    const tripleState = asTripleRatchetState(currentSessionState);
    const cloned = tripleState.clone();
    try {
      const plaintext = decryptWithState(cloned, ciphertext, rng);
      record.setSessionState(cloned.innerState());
      return plaintext;
    } catch (e) {
      if (e instanceof DuplicateMessageError) throw e;
      errors.push(e as Error);
    }
  }

  // For prekey messages, skip iterating previous sessions (matches libsignal)
  if (originalMessageType === "prekey") {
    throw new InvalidMessageError("Decryption failed");
  }

  // Try previous sessions (signal messages only)
  const previousStates = record.previousSessionStates();
  for (let i = 0; i < previousStates.length; i++) {
    const tripleState = asTripleRatchetState(previousStates[i]);
    const cloned = tripleState.clone();
    try {
      const plaintext = decryptWithState(cloned, ciphertext, rng);
      record.promoteOldSession(i, cloned.innerState());
      return plaintext;
    } catch (e) {
      if (e instanceof DuplicateMessageError) throw e;
      errors.push(e as Error);
    }
  }

  throw new InvalidMessageError("Decryption failed");
}

// ---------------------------------------------------------------------------
// Core decryption with a single session state
// ---------------------------------------------------------------------------

function decryptWithState(
  state: TripleRatchetSessionState,
  ciphertext: TripleRatchetSignalMessage,
  rng: RandomNumberGenerator,
): Uint8Array {
  // Version check
  if (ciphertext.messageVersion !== state.sessionVersion()) {
    throw new InvalidMessageError(
      `Version mismatch: message=${ciphertext.messageVersion}, session=${state.sessionVersion()}`,
    );
  }

  // Root key validation — an all-zero root key indicates an uninitialized session
  if (state.rootKey().key.every((b) => b === 0)) {
    throw new InvalidMessageError("No session available to decrypt");
  }

  const theirEphemeral = ciphertext.senderRatchetKey;
  const counter = ciphertext.counter;

  // 1. Get or create chain key (may trigger DH ratchet)
  const chainKey = getOrCreateChainKeyTriple(state, theirEphemeral, rng);

  // 2. Advance chain to target counter, caching intermediate seeds
  const { seed: chainKeySeed } = getOrCreateMessageSeed(state, theirEphemeral, chainKey, counter);

  // 3. PQ ratchet recv -> {pqrKey}
  const pqRatchetMsg = ciphertext.pqRatchet ?? new Uint8Array(0);
  let pqrKey: Uint8Array | null;
  try {
    const pqResult = state.pqRatchetRecv(pqRatchetMsg);
    pqrKey = pqResult.key;
  } catch (err) {
    if (err instanceof TripleRatchetError) throw err;
    throw new TripleRatchetError(
      "PQ ratchet recv failed",
      TripleRatchetErrorCode.PQRatchetRecvError,
      err,
    );
  }

  // 4. Derive message keys with PQ salt
  const messageKeys = deriveMessageKeys(chainKeySeed, pqrKey, counter);

  // 5. Verify MAC
  const theirIdentityKey = state.remoteIdentityKey();
  if (theirIdentityKey == null) {
    throw new InvalidSessionError("Cannot decrypt without remote identity key");
  }

  const macValid = ciphertext.verifyMac(
    theirIdentityKey,
    state.localIdentityKey(),
    messageKeys.macKey,
  );
  if (!macValid) {
    throw new InvalidMessageError("MAC verification failed");
  }

  // 6. Decrypt
  const plaintext = aes256CbcDecrypt(ciphertext.ciphertext, messageKeys.cipherKey, messageKeys.iv);

  // 7. Clear pending prekey after successful decrypt
  state.clearPendingPreKey();

  return plaintext;
}

// ---------------------------------------------------------------------------
// DH ratchet step (triple ratchet variant)
// ---------------------------------------------------------------------------

/**
 * Get an existing receiver chain key or create a new one via DH ratchet.
 *
 * Mirrors the double-ratchet getOrCreateChainKey but operates on
 * TripleRatchetSessionState.
 */
function getOrCreateChainKeyTriple(
  state: TripleRatchetSessionState,
  theirEphemeral: Uint8Array,
  rng: RandomNumberGenerator,
): ReturnType<TripleRatchetSessionState["getSenderChainKey"]> {
  const existing = state.getReceiverChainKey(theirEphemeral);
  if (existing != null) {
    return existing;
  }

  // Perform DH ratchet
  const rootKey = state.rootKey();
  const ourEphemeral = state.senderRatchetKeyPair();

  const [receiverRootKey, receiverChainKey] = rootKey.createChain(theirEphemeral, ourEphemeral);

  const ourNewEphemeral = KeyPair.generate(rng);

  const [senderRootKey, senderChainKey] = receiverRootKey.createChain(
    theirEphemeral,
    ourNewEphemeral,
  );

  state.setRootKey(senderRootKey);
  state.addReceiverChain(theirEphemeral, receiverChainKey);

  const currentSenderIndex = state.getSenderChainKey().index;
  const previousIndex = currentSenderIndex > 0 ? currentSenderIndex - 1 : 0;
  state.setPreviousCounter(previousIndex);
  state.setSenderChain(ourNewEphemeral, senderChainKey);

  return receiverChainKey;
}

// ---------------------------------------------------------------------------
// Message key seed retrieval
// ---------------------------------------------------------------------------

/**
 * Get the chain key seed for the target counter, caching intermediate
 * keys for out-of-order message retrieval.
 *
 * Returns the raw seed so the caller can derive keys with the PQ ratchet key.
 */
function getOrCreateMessageSeed(
  state: TripleRatchetSessionState,
  theirEphemeral: Uint8Array,
  chainKey: ReturnType<TripleRatchetSessionState["getReceiverChainKey"]>,
  counter: number,
): { seed: Uint8Array } {
  if (chainKey == null) {
    throw new InvalidMessageError("No chain key for receiver chain");
  }

  const chainIndex = chainKey.index;

  // Message from the past -- look up cached raw seed
  if (chainIndex > counter) {
    const cached = state.removeMessageKeySeed(theirEphemeral, counter);
    if (cached != null) {
      return { seed: cached.seed };
    }
    throw new DuplicateMessageError(chainIndex, counter);
  }

  // Check forward jump limit
  const jump = counter - chainIndex;
  if (jump > MAX_FORWARD_JUMPS && !state.sessionWithSelf()) {
    throw new InvalidMessageError(
      `Message from too far into the future: ${jump} messages ahead (max ${MAX_FORWARD_JUMPS})`,
    );
  }

  // Advance chain, caching intermediate seeds
  let current = chainKey;
  while (current.index < counter) {
    state.setMessageKeys(theirEphemeral, current.messageKeySeed(), current.index);
    current = current.nextChainKey();
  }

  // Update receiver chain key to the next one
  state.setReceiverChainKey(theirEphemeral, current.nextChainKey());

  return { seed: current.messageKeySeed() };
}

// ---------------------------------------------------------------------------
// Triple-ratchet prekey message processing (Bob's side)
// ---------------------------------------------------------------------------

/**
 * Process a TripleRatchetPreKeySignalMessage to establish Bob's side of
 * the session, including ML-KEM decapsulation and SPQR initialization.
 *
 * Uses `initializeBobSession` from session-init.ts when a Kyber ciphertext
 * is present (full PQXDH). Falls back to classical key agreement with an
 * empty PQ state when no Kyber fields are present (backward compatibility).
 */
async function processTripleRatchetPreKeyMessage(
  message: TripleRatchetPreKeySignalMessage,
  remoteAddress: ProtocolAddress,
  sessionRecord: SessionRecord,
  identityStore: IdentityKeyStore,
  preKeyStore: PreKeyStore,
  signedPreKeyStore: SignedPreKeyStore,
  kyberPreKeyStore: KyberPreKeyStore,
): Promise<{ preKeysUsed: PreKeysUsed | undefined; theirIdentityKey: IdentityKey }> {
  // 1. Deserialize and trust-check identity key
  const theirIdentityKey = IdentityKey.deserialize(message.identityKey);

  if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "receiving"))) {
    throw new UntrustedIdentityError(remoteAddress.toString());
  }

  // 2. Check for existing matching session (by version + base key)
  if (sessionRecord.promoteMatchingSession(message.messageVersion, message.baseKey)) {
    return { preKeysUsed: undefined, theirIdentityKey };
  }

  // 3. Load signed prekey
  const ourSignedPreKeyRecord = await signedPreKeyStore.loadSignedPreKey(message.signedPreKeyId);

  // 4. Load optional one-time EC prekey
  let ourOneTimePreKeyPair: KeyPair | undefined;
  if (message.preKeyId !== undefined) {
    const preKeyRecord = await preKeyStore.loadPreKey(message.preKeyId);
    ourOneTimePreKeyPair = preKeyRecord.keyPair;
  }

  // 5. Get our identity key pair
  const ourIdentityKeyPair = await identityStore.getIdentityKeyPair();

  // 6. Reject v3 (classical X3DH) messages — PQXDH is required
  if (message.messageVersion === 3) {
    throw new TripleRatchetError(
      "X3DH no longer supported",
      TripleRatchetErrorCode.X3DHNoLongerSupported,
    );
  }

  // 7. Require Kyber fields for v4
  if (message.kyberPreKeyId === undefined || message.kyberCiphertext == null) {
    throw new TripleRatchetError(
      "Missing Kyber fields in v4 PreKeySignalMessage",
      TripleRatchetErrorCode.MissingKyberCiphertext,
    );
  }

  const kyberPreKeyId = message.kyberPreKeyId;
  const kyberRecord = await kyberPreKeyStore.loadKyberPreKey(kyberPreKeyId);
  const kyberKeyPair = kyberRecord.keyPair;
  const kyberCiphertext = message.kyberCiphertext;

  // 8. Initialize Bob's session via full PQXDH
  const bobParams: BobPQXDHParameters = {
    ourIdentityKeyPair,
    ourSignedPreKeyPair: ourSignedPreKeyRecord.keyPair,
    ourOneTimePreKeyPair,
    ourRatchetKeyPair: ourSignedPreKeyRecord.keyPair,
    ourKyberKeyPair: kyberKeyPair,
    theirIdentityKey,
    theirBaseKey: message.baseKey,
    theirKyberCiphertext: kyberCiphertext,
  };

  const tripleState = initializeBobSession(bobParams);

  // 8. Set registration IDs
  tripleState.setLocalRegistrationId(await identityStore.getLocalRegistrationId());
  tripleState.setRemoteRegistrationId(message.registrationId);

  // 9. Promote new session
  sessionRecord.promoteState(tripleState.innerState());

  // Identity is saved AFTER successful decryption in the caller (M1 fix)
  return {
    preKeysUsed: {
      oneTimeEcPreKeyId: message.preKeyId,
      signedEcPreKeyId: message.signedPreKeyId,
      kyberPreKeyId,
    },
    theirIdentityKey,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrap a SessionState into a TripleRatchetSessionState for PQ operations.
 *
 * If the state is already a TripleRatchetSessionState, returns it directly.
 * If it is a plain SessionState, wraps it with an empty (V0) PQ state
 * for backward compatibility with classical X3DH sessions.
 */
function asTripleRatchetState(state: unknown): TripleRatchetSessionState {
  // Duck-type check
  if (
    state != null &&
    typeof state === "object" &&
    "pqRatchetSend" in state &&
    typeof (state as TripleRatchetSessionState).pqRatchetSend === "function"
  ) {
    return state as TripleRatchetSessionState;
  }

  // Plain SessionState: wrap with empty PQ state (V0/legacy)
  if (state instanceof SessionState) {
    return new TripleRatchetSessionState(state, new Uint8Array(0));
  }

  throw new TripleRatchetError(
    "Invalid session state: expected SessionState or TripleRatchetSessionState",
    TripleRatchetErrorCode.InvalidState,
  );
}
