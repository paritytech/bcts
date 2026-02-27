// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * CiphertextMessage — type-safe union of all encrypted message types.
 *
 * Reference: libsignal/rust/protocol/src/protocol.rs:23-59
 * Reference: libsignal/node/ts/index.ts (CiphertextMessage, CiphertextMessageConvertible)
 */

import type { SignalMessage } from "./signal-message.js";
import type { PreKeySignalMessage } from "./pre-key-signal-message.js";
import type { SenderKeyMessage } from "./sender-key-message.js";
import type { PlaintextContent } from "./plaintext-content.js";

export enum CiphertextMessageType {
  Whisper = 2,
  PreKey = 3,
  SenderKey = 7,
  Plaintext = 8,
}

export type CiphertextMessage =
  | { type: CiphertextMessageType.Whisper; message: SignalMessage }
  | { type: CiphertextMessageType.PreKey; message: PreKeySignalMessage }
  | { type: CiphertextMessageType.SenderKey; message: SenderKeyMessage }
  | { type: CiphertextMessageType.Plaintext; message: PlaintextContent };

/**
 * Interface for protocol message types that can be converted to a CiphertextMessage.
 *
 * Matches libsignal's Node.js CiphertextMessageConvertible interface.
 */
export interface CiphertextMessageConvertible {
  asCiphertextMessage(): CiphertextMessage;
}

export function ciphertextMessageType(msg: CiphertextMessage): CiphertextMessageType {
  return msg.type;
}

export function ciphertextMessageSerialize(msg: CiphertextMessage): Uint8Array {
  return msg.message.serialized;
}

/**
 * Create a CiphertextMessage from any convertible message type.
 * Matches libsignal's CiphertextMessage.from() static method.
 */
export function ciphertextMessageFrom(msg: CiphertextMessageConvertible): CiphertextMessage {
  return msg.asCiphertextMessage();
}
