/**
 * Root key for the Signal Protocol DH ratchet.
 *
 * Creates new chain keys by combining the current root key with a DH shared secret.
 *
 * Reference: libsignal/rust/protocol/src/ratchet/keys.rs (RootKey::create_chain)
 */

import { hkdfSha256 } from "../crypto/kdf.js";
import { ChainKey } from "./chain-key.js";
import type { KeyPair } from "../keys/key-pair.js";

const INFO = new TextEncoder().encode("WhisperRatchet");

export class RootKey {
  readonly key: Uint8Array;

  constructor(key: Uint8Array) {
    this.key = key;
  }

  /**
   * DH ratchet step: derive new RootKey + ChainKey from DH shared secret.
   *
   * 1. Compute raw X25519 agreement
   * 2. HKDF-SHA256(salt=rootKey, ikm=sharedSecret, info="WhisperRatchet", length=64)
   * 3. Split 64 bytes: newRootKey (32) + newChainKey (32)
   *
   * PQ ratchet is now per-message, not per-DH-step, so it is not involved here.
   *
   * @param theirRatchetKey - Their 32-byte ephemeral public key
   * @param ourRatchetKey - Our ephemeral key pair
   * @returns [newRootKey, newChainKey] with chain index 0
   */
  createChain(theirRatchetKey: Uint8Array, ourRatchetKey: KeyPair): [RootKey, ChainKey] {
    const sharedSecret = ourRatchetKey.calculateAgreement(theirRatchetKey);

    const derived = hkdfSha256(sharedSecret, this.key, INFO, 64);
    return [new RootKey(derived.slice(0, 32)), new ChainKey(derived.slice(32, 64), 0)];
  }
}
