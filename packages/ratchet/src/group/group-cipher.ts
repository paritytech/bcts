/**
 * Group cipher -- encrypt/decrypt for group messaging using sender keys.
 *
 * Reference: libsignal/rust/protocol/src/group_cipher.rs
 */

import type { ProtocolAddress, SenderKeyStore } from "../storage/interfaces.js";
import { SenderKeyRecord } from "./sender-key-record.js";
import { SenderKeyMessage } from "../protocol/sender-key-message.js";
import { SenderKeyDistributionMessage } from "../protocol/sender-key-distribution-message.js";
import { aes256CbcEncrypt, aes256CbcDecrypt } from "../crypto/aes-cbc.js";
import {
  NoSenderKeyStateError,
  InvalidSenderKeySessionError,
  InvalidMessageError,
  DuplicateMessageError,
  SignatureValidationError,
} from "../error.js";
import { MAX_FORWARD_JUMPS, SENDERKEY_MESSAGE_CURRENT_VERSION } from "../constants.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { type SenderMessageKey } from "./sender-message-key.js";
import type { SenderKeyState } from "./sender-key-state.js";

/**
 * Encrypt a plaintext for a group using the sender key.
 */
export async function groupEncrypt(
  senderKeyStore: SenderKeyStore,
  sender: ProtocolAddress,
  distributionId: string,
  plaintext: Uint8Array,
): Promise<SenderKeyMessage> {
  const recordBytes = await senderKeyStore.loadSenderKey(sender, distributionId);
  if (!recordBytes) {
    throw new NoSenderKeyStateError(distributionId);
  }

  const record = SenderKeyRecord.deserialize(recordBytes);
  const state = record.senderKeyState();
  if (!state) {
    throw new InvalidSenderKeySessionError(distributionId);
  }

  const senderChainKey = state.senderChainKey();
  if (!senderChainKey) {
    throw new InvalidSenderKeySessionError(distributionId);
  }

  const messageKeys = senderChainKey.senderMessageKey();

  // Encrypt with AES-256-CBC
  const ciphertext = aes256CbcEncrypt(plaintext, messageKeys.cipherKey, messageKeys.iv);

  // Get signing private key
  const signingPrivateKey = state.signingKeyPrivate();
  if (!signingPrivateKey) {
    throw new InvalidSenderKeySessionError(distributionId);
  }

  // Convert distributionId UUID string to 16-byte buffer
  const distIdBytes = uuidToBytes(distributionId);

  // Create signed message
  const skm = SenderKeyMessage.create(
    state.messageVersion,
    distIdBytes,
    state.chainId,
    messageKeys.iteration,
    ciphertext,
    signingPrivateKey,
  );

  // Advance chain key
  state.setSenderChainKey(senderChainKey.next());

  // Store updated record
  await senderKeyStore.storeSenderKey(sender, distributionId, record.serialize());

  return skm;
}

/**
 * Decrypt a group message.
 */
export async function groupDecrypt(
  ciphertextBytes: Uint8Array,
  senderKeyStore: SenderKeyStore,
  sender: ProtocolAddress,
): Promise<Uint8Array> {
  const skm = SenderKeyMessage.deserialize(ciphertextBytes);

  const distributionId = bytesToUuid(skm.distributionId);

  const recordBytes = await senderKeyStore.loadSenderKey(sender, distributionId);
  if (!recordBytes) {
    throw new NoSenderKeyStateError(distributionId);
  }

  const record = SenderKeyRecord.deserialize(recordBytes);
  const state = record.senderKeyStateForChainId(skm.chainId);
  if (!state) {
    throw new NoSenderKeyStateError(distributionId);
  }

  // Version check
  if (skm.messageVersion !== state.messageVersion) {
    throw new InvalidMessageError(
      `SenderKey message version mismatch: ${skm.messageVersion} vs ${state.messageVersion}`,
    );
  }

  // Verify signature
  const signingKey = state.signingKeyPublic();
  if (!skm.verifySignature(signingKey)) {
    throw new SignatureValidationError();
  }

  // Get sender key for this iteration
  const senderKey = getSenderKey(state, skm.iteration, distributionId);

  // Decrypt
  const plaintext = aes256CbcDecrypt(skm.ciphertext, senderKey.cipherKey, senderKey.iv);

  // Store updated record
  await senderKeyStore.storeSenderKey(sender, distributionId, record.serialize());

  return plaintext;
}

/**
 * Create a sender key distribution message for a group.
 */
export async function createSenderKeyDistributionMessage(
  senderKeyStore: SenderKeyStore,
  sender: ProtocolAddress,
  distributionId: string,
): Promise<SenderKeyDistributionMessage> {
  let recordBytes = await senderKeyStore.loadSenderKey(sender, distributionId);

  if (!recordBytes) {
    // Generate new sender key state
    const chainId =
      crypto.getRandomValues(new Uint8Array(4)).reduce((acc, b, i) => acc | (b << (i * 8)), 0) >>>
      1; // 31-bit integer matching libsignal-protocol-java
    const senderKey = crypto.getRandomValues(new Uint8Array(32));
    const signingPrivateKey = crypto.getRandomValues(new Uint8Array(32));
    const signingPublicKey = ed25519.getPublicKey(signingPrivateKey);

    const record = new SenderKeyRecord();
    record.addSenderKeyState(
      SENDERKEY_MESSAGE_CURRENT_VERSION,
      chainId,
      0,
      senderKey,
      signingPublicKey,
      signingPrivateKey,
    );

    const serialized = record.serialize();
    await senderKeyStore.storeSenderKey(sender, distributionId, serialized);
    recordBytes = serialized;
  }

  const record = SenderKeyRecord.deserialize(recordBytes);
  const state = record.senderKeyState();
  if (!state) {
    throw new InvalidSenderKeySessionError(distributionId);
  }

  const chainKey = state.senderChainKey();
  if (!chainKey) {
    throw new InvalidSenderKeySessionError(distributionId);
  }

  const distIdBytes = uuidToBytes(distributionId);

  return SenderKeyDistributionMessage.create(
    state.messageVersion,
    distIdBytes,
    state.chainId,
    chainKey.iteration,
    chainKey.seed,
    state.signingKeyPublic(),
  );
}

/**
 * Process a received sender key distribution message.
 */
export async function processSenderKeyDistributionMessage(
  sender: ProtocolAddress,
  distributionId: string,
  skdm: SenderKeyDistributionMessage,
  senderKeyStore: SenderKeyStore,
): Promise<void> {
  const recordBytes = await senderKeyStore.loadSenderKey(sender, distributionId);
  const record = recordBytes ? SenderKeyRecord.deserialize(recordBytes) : new SenderKeyRecord();

  // Strip 0x05 prefix from signing key if present
  let signingKey = skdm.signingKey;
  if (signingKey.length === 33 && signingKey[0] === 0x05) {
    signingKey = signingKey.slice(1);
  }

  record.addSenderKeyState(
    skdm.messageVersion,
    skdm.chainId,
    skdm.iteration,
    skdm.chainKey,
    signingKey,
  );

  await senderKeyStore.storeSenderKey(sender, distributionId, record.serialize());
}

// --- Internal helpers ---

function getSenderKey(
  state: SenderKeyState,
  iteration: number,
  distributionId: string,
): SenderMessageKey {
  const chainKey = state.senderChainKey();
  if (!chainKey) {
    throw new InvalidSenderKeySessionError(distributionId);
  }
  const currentIteration = chainKey.iteration;

  if (currentIteration > iteration) {
    // Look up cached key
    const cached = state.removeSenderMessageKey(iteration);
    if (cached) return cached;
    throw new DuplicateMessageError(currentIteration, iteration);
  }

  const jump = iteration - currentIteration;
  if (jump > MAX_FORWARD_JUMPS) {
    throw new InvalidMessageError(`SenderKey message from too far into the future: ${jump}`);
  }

  // Forward-fill: cache intermediate keys
  let ck = chainKey;
  while (ck.iteration < iteration) {
    state.addSenderMessageKey(ck.senderMessageKey());
    ck = ck.next();
  }

  // Advance past the target iteration
  state.setSenderChainKey(ck.next());
  return ck.senderMessageKey();
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
