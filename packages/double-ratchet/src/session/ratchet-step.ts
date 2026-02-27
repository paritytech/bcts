// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * DH ratchet step — creates new chain keys when receiving a new ephemeral key.
 *
 * Reference: libsignal/rust/protocol/src/session_cipher.rs (get_or_create_chain_key)
 */

import type { RandomNumberGenerator } from "@bcts/rand";
import type { SessionState } from "./session-state.js";
import { type ChainKey } from "../ratchet/chain-key.js";
import { KeyPair } from "../keys/key-pair.js";
import { InvalidKeyError } from "../error.js";

/**
 * Get an existing receiver chain key or create a new one via DH ratchet.
 *
 * If the sender's ratchet key is already known, returns the existing chain key.
 * Otherwise, performs a DH ratchet step:
 * 1. Derive receiver chain from root key + old ephemeral
 * 2. Generate new ephemeral key pair
 * 3. Derive sender chain from new root key + new ephemeral
 * 4. Update session state
 */
export function getOrCreateChainKey(
  state: SessionState,
  theirEphemeral: Uint8Array,
  rng: RandomNumberGenerator,
): ChainKey {
  // Check if we already have a chain for this ephemeral
  const existing = state.getReceiverChainKey(theirEphemeral);
  if (existing != null) {
    return existing;
  }

  // Perform DH ratchet
  const rootKey = state.rootKey();
  const ourEphemeral = state.senderRatchetKeyPair();

  // Step 1: Derive receiver chain
  const [receiverRootKey, receiverChainKey] = rootKey.createChain(theirEphemeral, ourEphemeral);

  // Step 2: Generate new ephemeral
  const ourNewEphemeral = KeyPair.generate(rng);

  // Step 3: Derive sender chain
  const [senderRootKey, senderChainKey] = receiverRootKey.createChain(
    theirEphemeral,
    ourNewEphemeral,
  );

  // H5: Verify root key is valid after DH ratchet
  if (senderRootKey.key.every((b) => b === 0)) {
    throw new InvalidKeyError("DH ratchet produced invalid root key");
  }

  // Step 4: Update state
  state.setRootKey(senderRootKey);
  state.addReceiverChain(theirEphemeral, receiverChainKey);

  const currentSenderIndex = state.getSenderChainKey().index;
  const previousIndex = currentSenderIndex > 0 ? currentSenderIndex - 1 : 0;
  state.setPreviousCounter(previousIndex);
  state.setSenderChain(ourNewEphemeral, senderChainKey);

  return receiverChainKey;
}
