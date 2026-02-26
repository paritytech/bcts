/**
 * Chain key for the Signal Protocol symmetric ratchet.
 *
 * Derives message key seeds (HMAC-SHA256(key, 0x01)) and advances
 * the chain (HMAC-SHA256(key, 0x02)).
 *
 * Reference: libsignal/rust/protocol/src/ratchet/keys.rs
 */

import { hmacSha256 } from "../crypto/kdf.js";

const MESSAGE_KEY_SEED = new Uint8Array([0x01]);
const CHAIN_KEY_SEED = new Uint8Array([0x02]);

export class ChainKey {
  readonly key: Uint8Array;
  readonly index: number;

  constructor(key: Uint8Array, index: number) {
    this.key = key;
    this.index = index;
  }

  /**
   * Derive message key seed: HMAC-SHA256(chainKey, 0x01).
   * This seed is then passed through HKDF to derive cipher_key, mac_key, and iv.
   */
  messageKeySeed(): Uint8Array {
    return hmacSha256(this.key, MESSAGE_KEY_SEED);
  }

  /**
   * Advance the chain: HMAC-SHA256(chainKey, 0x02) with incremented index.
   */
  nextChainKey(): ChainKey {
    return new ChainKey(hmacSha256(this.key, CHAIN_KEY_SEED), this.index + 1);
  }
}
