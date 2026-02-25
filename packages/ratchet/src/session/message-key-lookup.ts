/**
 * Out-of-order message key retrieval.
 *
 * Handles message key lookup for out-of-order and skipped messages
 * by caching intermediate keys.
 *
 * Reference: libsignal/rust/protocol/src/session_cipher.rs (get_or_create_message_key)
 */

import type { SessionState } from "./session-state.js";
import { ChainKey } from "../ratchet/chain-key.js";
import { MessageKeys } from "../ratchet/message-keys.js";
import { DuplicateMessageError, InvalidMessageError } from "../error.js";
import { MAX_FORWARD_JUMPS } from "../constants.js";

/**
 * Get or create the message key for a given counter.
 *
 * - If counter < chainKey.index: look up cached keys (or throw duplicate)
 * - If counter is too far ahead: throw (unless self-session)
 * - Otherwise: advance chain, caching intermediate keys
 *
 * @param pqSalt - Optional PQ ratchet message key used as HKDF salt
 */
export function getOrCreateMessageKey(
  state: SessionState,
  theirEphemeral: Uint8Array,
  chainKey: ChainKey,
  counter: number,
  pqSalt?: Uint8Array,
): MessageKeys {
  const chainIndex = chainKey.index;

  // Message from the past — look up cached key
  if (chainIndex > counter) {
    const cached = state.getMessageKeys(theirEphemeral, counter, pqSalt);
    if (cached) return cached;
    throw new DuplicateMessageError(chainIndex, counter);
  }

  // Check forward jump limit
  const jump = counter - chainIndex;
  if (jump > MAX_FORWARD_JUMPS && !state.sessionWithSelf()) {
    throw new InvalidMessageError(
      `Message from too far into the future: ${jump} messages ahead (max ${MAX_FORWARD_JUMPS})`,
    );
  }

  // Advance chain, caching intermediate keys
  let current = chainKey;
  while (current.index < counter) {
    // Cache this key for later OOO retrieval
    state.setMessageKeys(theirEphemeral, current.messageKeySeed(), current.index);
    current = current.nextChainKey();
  }

  // Update receiver chain key to the next one
  state.setReceiverChainKey(theirEphemeral, current.nextChainKey());

  // Return the message keys for the target counter WITH PQ salt
  return MessageKeys.deriveFrom(current.messageKeySeed(), counter, pqSalt);
}
