/**
 * Session cipher — encrypt and decrypt messages using the Double Ratchet.
 *
 * Reference: libsignal/rust/protocol/src/session_cipher.rs
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import { aes256CbcEncrypt, aes256CbcDecrypt } from "../crypto/aes-cbc.js";
import { MessageKeys } from "../ratchet/message-keys.js";
import { SignalMessage } from "../protocol/signal-message.js";
import { PreKeySignalMessage } from "../protocol/pre-key-signal-message.js";
import { SessionRecord } from "./session-record.js";
import type { SessionState } from "./session-state.js";
import {
  type ProtocolAddress,
  type SessionStore,
  type IdentityKeyStore,
  type PreKeyStore,
  type SignedPreKeyStore,
  type ProtocolStore,
} from "../storage/interfaces.js";
import {
  SessionNotFoundError,
  InvalidMessageError,
  UntrustedIdentityError,
  InvalidSessionError,
  DuplicateMessageError,
} from "../error.js";
import { MAX_UNACKNOWLEDGED_SESSION_AGE_MS } from "../constants.js";
import { getOrCreateChainKey } from "./ratchet-step.js";
import { getOrCreateMessageKey } from "./message-key-lookup.js";
import { processPreKeyMessage } from "../x3dh/process-prekey-message.js";

/**
 * Encrypt a plaintext message using the session for the remote address.
 *
 * Returns either a SignalMessage or a PreKeySignalMessage (if the session
 * has pending prekey info that hasn't been acknowledged yet).
 *
 * Overload: accepts a single ProtocolStore instead of separate stores.
 */
export async function messageEncrypt(
  plaintext: Uint8Array,
  remoteAddress: ProtocolAddress,
  store: ProtocolStore,
  now?: number,
): Promise<SignalMessage | PreKeySignalMessage>;
/**
 * Encrypt a plaintext message using the session for the remote address.
 *
 * Returns either a SignalMessage or a PreKeySignalMessage (if the session
 * has pending prekey info that hasn't been acknowledged yet).
 */
export async function messageEncrypt(
  plaintext: Uint8Array,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  now?: number,
): Promise<SignalMessage | PreKeySignalMessage>;
export async function messageEncrypt(
  plaintext: Uint8Array,
  remoteAddress: ProtocolAddress,
  sessionStoreOrProtocolStore: SessionStore | ProtocolStore,
  identityStoreOrNow?: IdentityKeyStore | number,
  now: number = Date.now(),
): Promise<SignalMessage | PreKeySignalMessage> {
  // Resolve overloaded parameters
  let sessionStore: SessionStore;
  let identityStore: IdentityKeyStore;

  if (typeof identityStoreOrNow === "number" || identityStoreOrNow === undefined) {
    // ProtocolStore overload: (plaintext, address, store, now?)
    const store = sessionStoreOrProtocolStore as ProtocolStore;
    sessionStore = store;
    identityStore = store;
    if (typeof identityStoreOrNow === "number") {
      now = identityStoreOrNow;
    }
  } else {
    // Separate stores overload: (plaintext, address, sessionStore, identityStore, now?)
    sessionStore = sessionStoreOrProtocolStore;
    identityStore = identityStoreOrNow;
  }

  return messageEncryptImpl(plaintext, remoteAddress, sessionStore, identityStore, now);
}

async function messageEncryptImpl(
  plaintext: Uint8Array,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  now: number = Date.now(),
): Promise<SignalMessage | PreKeySignalMessage> {
  const sessionRecord = await sessionStore.loadSession(remoteAddress);
  if (!sessionRecord) {
    throw new SessionNotFoundError(remoteAddress.toString());
  }

  const sessionState = sessionRecord.sessionState();
  if (!sessionState) {
    throw new SessionNotFoundError(remoteAddress.toString());
  }

  const chainKey = sessionState.getSenderChainKey();

  const messageKeys = MessageKeys.deriveFrom(chainKey.messageKeySeed(), chainKey.index);

  const senderEphemeral = sessionState.senderRatchetKey();
  const previousCounter = sessionState.previousCounter();
  const sessionVersion = sessionState.sessionVersion();

  const localIdentityKey = sessionState.localIdentityKey();
  const theirIdentityKey = sessionState.remoteIdentityKey();
  if (!theirIdentityKey) {
    throw new InvalidSessionError(`No remote identity key for ${remoteAddress}`);
  }

  // Encrypt plaintext with AES-256-CBC
  const ciphertext = aes256CbcEncrypt(plaintext, messageKeys.cipherKey, messageKeys.iv);

  // Check pending prekey info
  const pendingPreKey = sessionState.pendingPreKey();

  let message: SignalMessage | PreKeySignalMessage;

  if (pendingPreKey) {
    // Check for stale unacknowledged session
    if (pendingPreKey.timestamp + MAX_UNACKNOWLEDGED_SESSION_AGE_MS < now) {
      throw new SessionNotFoundError(remoteAddress.toString());
    }

    const signalMessage = SignalMessage.create(
      sessionVersion,
      messageKeys.macKey,
      senderEphemeral,
      chainKey.index,
      previousCounter,
      ciphertext,
      localIdentityKey,
      theirIdentityKey,
    );

    message = PreKeySignalMessage.create(
      sessionVersion,
      sessionState.localRegistrationId(),
      pendingPreKey.preKeyId,
      pendingPreKey.signedPreKeyId,
      pendingPreKey.baseKey,
      localIdentityKey,
      signalMessage,
    );
  } else {
    message = SignalMessage.create(
      sessionVersion,
      messageKeys.macKey,
      senderEphemeral,
      chainKey.index,
      previousCounter,
      ciphertext,
      localIdentityKey,
      theirIdentityKey,
    );
  }

  // Advance sender chain key
  sessionState.setSenderChainKey(chainKey.nextChainKey());

  // Trust check (matches Signal's post-encrypt check)
  if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "sending"))) {
    throw new UntrustedIdentityError(remoteAddress.toString());
  }

  await identityStore.saveIdentity(remoteAddress, theirIdentityKey);
  await sessionStore.storeSession(remoteAddress, sessionRecord);

  return message;
}

/**
 * Decrypt a message using the session for the remote address.
 *
 * Overload: accepts a single ProtocolStore instead of separate stores.
 */
export async function messageDecrypt(
  ciphertext: SignalMessage | PreKeySignalMessage,
  remoteAddress: ProtocolAddress,
  store: ProtocolStore,
  rng: RandomNumberGenerator,
): Promise<Uint8Array>;
/**
 * Decrypt a message using the session for the remote address.
 */
export async function messageDecrypt(
  ciphertext: SignalMessage | PreKeySignalMessage,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  preKeyStore: PreKeyStore,
  signedPreKeyStore: SignedPreKeyStore,
  rng: RandomNumberGenerator,
): Promise<Uint8Array>;
export async function messageDecrypt(
  ciphertext: SignalMessage | PreKeySignalMessage,
  remoteAddress: ProtocolAddress,
  sessionStoreOrProtocolStore: SessionStore | ProtocolStore,
  identityStoreOrRng: IdentityKeyStore | RandomNumberGenerator,
  preKeyStore?: PreKeyStore,
  signedPreKeyStore?: SignedPreKeyStore,
  rng?: RandomNumberGenerator,
): Promise<Uint8Array> {
  // Resolve overloaded parameters
  let sessionStore: SessionStore;
  let identityStore: IdentityKeyStore;
  let resolvedPreKeyStore: PreKeyStore;
  let resolvedSignedPreKeyStore: SignedPreKeyStore;
  let resolvedRng: RandomNumberGenerator;

  if (preKeyStore === undefined && signedPreKeyStore === undefined && rng === undefined) {
    // ProtocolStore overload: (ciphertext, address, store, rng)
    const store = sessionStoreOrProtocolStore as ProtocolStore;
    sessionStore = store;
    identityStore = store;
    resolvedPreKeyStore = store;
    resolvedSignedPreKeyStore = store;
    resolvedRng = identityStoreOrRng as RandomNumberGenerator;
  } else {
    // Separate stores overload
    sessionStore = sessionStoreOrProtocolStore;
    identityStore = identityStoreOrRng as IdentityKeyStore;
    resolvedPreKeyStore = preKeyStore!;
    resolvedSignedPreKeyStore = signedPreKeyStore!;
    resolvedRng = rng!;
  }

  if (ciphertext instanceof PreKeySignalMessage) {
    return messageDecryptPreKey(
      ciphertext,
      remoteAddress,
      sessionStore,
      identityStore,
      resolvedPreKeyStore,
      resolvedSignedPreKeyStore,
      resolvedRng,
    );
  }
  return messageDecryptSignal(ciphertext, remoteAddress, sessionStore, identityStore, resolvedRng);
}

async function messageDecryptPreKey(
  message: PreKeySignalMessage,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  preKeyStore: PreKeyStore,
  signedPreKeyStore: SignedPreKeyStore,
  rng: RandomNumberGenerator,
): Promise<Uint8Array> {
  const sessionRecord = (await sessionStore.loadSession(remoteAddress)) ?? SessionRecord.newFresh();

  // No H2 retry — go straight to prekey processing (matches libsignal)
  const { preKeysUsed } = await processPreKeyMessage(
    message,
    remoteAddress,
    sessionRecord,
    identityStore,
    preKeyStore,
    signedPreKeyStore,
  );

  const plaintext = decryptMessageWithRecord(
    remoteAddress,
    sessionRecord,
    message.message,
    rng,
    "prekey",
  );

  // Save identity
  await identityStore.saveIdentity(remoteAddress, message.identityKey);

  // Remove used one-time prekey
  if (preKeysUsed?.oneTimePreKeyId !== undefined) {
    await preKeyStore.removePreKey(preKeysUsed.oneTimePreKeyId);
  }

  await sessionStore.storeSession(remoteAddress, sessionRecord);

  return plaintext;
}

async function messageDecryptSignal(
  ciphertext: SignalMessage,
  remoteAddress: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  rng: RandomNumberGenerator,
): Promise<Uint8Array> {
  const sessionRecord = await sessionStore.loadSession(remoteAddress);
  if (!sessionRecord) {
    throw new SessionNotFoundError(remoteAddress.toString());
  }

  const plaintext = decryptMessageWithRecord(
    remoteAddress,
    sessionRecord,
    ciphertext,
    rng,
    "signal",
  );

  // Trust check (matches Signal's post-decrypt check)
  const theirIdentityKey = sessionRecord.sessionState()?.remoteIdentityKey();
  if (theirIdentityKey) {
    if (!(await identityStore.isTrustedIdentity(remoteAddress, theirIdentityKey, "receiving"))) {
      throw new UntrustedIdentityError(remoteAddress.toString());
    }
    await identityStore.saveIdentity(remoteAddress, theirIdentityKey);
  }

  await sessionStore.storeSession(remoteAddress, sessionRecord);

  return plaintext;
}

function decryptMessageWithRecord(
  _remoteAddress: ProtocolAddress,
  record: SessionRecord,
  ciphertext: SignalMessage,
  rng: RandomNumberGenerator,
  originalMessageType: "prekey" | "signal",
): Uint8Array {
  const errors: Error[] = [];

  // Try current session
  if (record.sessionState()) {
    const currentState = record.sessionState()!.clone();
    try {
      const plaintext = decryptMessageWithState(currentState, ciphertext, rng);
      record.setSessionState(currentState);
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
    const cloned = previousStates[i].clone();
    try {
      const plaintext = decryptMessageWithState(cloned, ciphertext, rng);
      record.promoteOldSession(i, cloned);
      return plaintext;
    } catch (e) {
      if (e instanceof DuplicateMessageError) throw e;
      errors.push(e as Error);
    }
  }

  throw new InvalidMessageError("Decryption failed");
}

function decryptMessageWithState(
  state: SessionState,
  ciphertext: SignalMessage,
  rng: RandomNumberGenerator,
): Uint8Array {
  // Version check
  if (ciphertext.messageVersion !== state.sessionVersion()) {
    throw new InvalidMessageError(
      `Version mismatch: message=${ciphertext.messageVersion}, session=${state.sessionVersion()}`,
    );
  }

  const theirEphemeral = ciphertext.senderRatchetKey;
  const counter = ciphertext.counter;

  // Get or create chain key (may trigger DH ratchet)
  const chainKey = getOrCreateChainKey(state, theirEphemeral, rng);

  // Get or create message key
  const messageKeys = getOrCreateMessageKey(state, theirEphemeral, chainKey, counter);

  // Verify MAC
  const theirIdentityKey = state.remoteIdentityKey();
  if (!theirIdentityKey) {
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

  // Decrypt
  const plaintext = aes256CbcDecrypt(ciphertext.ciphertext, messageKeys.cipherKey, messageKeys.iv);

  // Clear pending prekey after successful decrypt
  state.clearPendingPreKey();

  return plaintext;
}
