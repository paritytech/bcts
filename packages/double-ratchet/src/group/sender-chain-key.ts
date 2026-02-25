/**
 * SenderChainKey -- chain key derivation for group messaging.
 *
 * Reference: libsignal/rust/protocol/src/sender_keys.rs (SenderChainKey)
 */

import { hmacSha256 } from "../crypto/kdf.js";

const MESSAGE_KEY_SEED = new Uint8Array([0x01]);
const CHAIN_KEY_SEED = new Uint8Array([0x02]);

export class SenderChainKey {
  readonly iteration: number;
  readonly seed: Uint8Array;

  constructor(iteration: number, seed: Uint8Array) {
    this.iteration = iteration;
    this.seed = seed;
  }

  /**
   * Derive the next chain key.
   */
  next(): SenderChainKey {
    if (this.iteration >= 0xffffffff) {
      throw new Error("Sender chain is too long");
    }
    return new SenderChainKey(this.iteration + 1, hmacSha256(this.seed, CHAIN_KEY_SEED));
  }

  /**
   * Derive the message key for this iteration.
   */
  senderMessageKey(): SenderMessageKey {
    return new SenderMessageKey(this.iteration, hmacSha256(this.seed, MESSAGE_KEY_SEED));
  }
}

// Import here to avoid circular dependency
import { SenderMessageKey } from "./sender-message-key.js";
