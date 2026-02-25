/**
 * Message keys derived from a chain key seed.
 *
 * Uses HKDF-SHA256(salt=undefined, ikm=seed, info="WhisperMessageKeys", length=80)
 * to produce: cipherKey (32) + macKey (32) + iv (16).
 *
 * Reference: libsignal/rust/protocol/src/ratchet/keys.rs (MessageKeys::derive_keys)
 */

import { hkdfSha256 } from "../crypto/kdf.js";
import type { MessageKeyProto } from "../protocol/proto.js";

const INFO = new TextEncoder().encode("WhisperMessageKeys");

export class MessageKeys {
  readonly cipherKey: Uint8Array;
  readonly macKey: Uint8Array;
  readonly iv: Uint8Array;
  readonly counter: number;

  constructor(cipherKey: Uint8Array, macKey: Uint8Array, iv: Uint8Array, counter: number) {
    this.cipherKey = cipherKey;
    this.macKey = macKey;
    this.iv = iv;
    this.counter = counter;
  }

  /**
   * Derive message keys from a chain key seed via HKDF.
   *
   * HKDF-SHA256(salt=undefined, ikm=seed, info="WhisperMessageKeys", length=80)
   * produces: cipherKey[0:32] + macKey[32:64] + iv[64:80].
   *
   * @param seed - 32-byte message key seed from ChainKey.messageKeySeed()
   * @param counter - Message counter (chain key index at time of derivation)
   * @returns MessageKeys with cipherKey, macKey, iv, and counter
   */
  static deriveFrom(seed: Uint8Array, counter: number): MessageKeys {
    const derived = hkdfSha256(seed, undefined, INFO, 80);
    return new MessageKeys(
      derived.slice(0, 32),
      derived.slice(32, 64),
      derived.slice(64, 80),
      counter,
    );
  }
}

/**
 * MessageKeyGenerator — deferred key derivation.
 *
 * Matches libsignal's MessageKeyGenerator enum with Keys and Seed variants.
 * - `Keys` variant holds pre-computed MessageKeys (legacy v3 sessions).
 * - `Seed` variant stores (seed, counter) and derives keys lazily via HKDF("WhisperMessageKeys").
 *
 * The seed-based approach is used for newer sessions and is stored as protobuf
 * MessageKey field 5 (`seed: bytes`). When the seed field is present in a
 * deserialized MessageKey, use it to derive keys on demand. When absent,
 * use the legacy cipher_key/mac_key/iv fields.
 *
 * Reference: libsignal/rust/protocol/src/ratchet/keys.rs (MessageKeyGenerator)
 */
export type MessageKeyGenerator =
  | { readonly variant: "keys"; readonly keys: MessageKeys }
  | { readonly variant: "seed"; readonly seed: Uint8Array; readonly counter: number };

export const MessageKeyGeneratorFactory = {
  /**
   * Create a Seed-based generator from a seed and counter.
   * Keys will be derived lazily when generateKeys() is called.
   */
  fromSeed(seed: Uint8Array, counter: number): MessageKeyGenerator {
    return { variant: "seed", seed: Uint8Array.from(seed), counter };
  },

  /**
   * Create a Keys-based generator from pre-computed MessageKeys.
   * Used for legacy v3 sessions where keys are stored directly.
   */
  fromKeys(keys: MessageKeys): MessageKeyGenerator {
    return { variant: "keys", keys };
  },

  /**
   * Generate the final MessageKeys.
   *
   * - For Seed variant: derives keys via HKDF with the seed.
   * - For Keys variant: returns the pre-computed keys directly.
   *
   * @param generator - The MessageKeyGenerator (Seed or Keys variant)
   */
  generateKeys(generator: MessageKeyGenerator): MessageKeys {
    if (generator.variant === "seed") {
      return MessageKeys.deriveFrom(generator.seed, generator.counter);
    }
    return generator.keys;
  },

  /**
   * Serialize a MessageKeyGenerator to protobuf MessageKey format.
   *
   * - Seed variant: stores seed and index, leaves cipher_key/mac_key/iv empty.
   * - Keys variant: stores cipher_key/mac_key/iv and index, leaves seed empty.
   */
  toProto(generator: MessageKeyGenerator): MessageKeyProto {
    if (generator.variant === "seed") {
      return {
        index: generator.counter,
        seed: generator.seed,
      };
    }
    return {
      index: generator.keys.counter,
      cipherKey: generator.keys.cipherKey,
      macKey: generator.keys.macKey,
      iv: generator.keys.iv,
    };
  },

  /**
   * Deserialize a MessageKeyGenerator from protobuf MessageKey format.
   *
   * When the seed field is present (non-empty), creates a Seed-based generator.
   * Otherwise, creates a Keys-based generator from the legacy fields.
   *
   * @throws Error if legacy key fields have invalid lengths
   */
  fromProto(proto: MessageKeyProto): MessageKeyGenerator {
    if (proto.seed && proto.seed.length > 0) {
      return {
        variant: "seed",
        seed: proto.seed,
        counter: proto.index ?? 0,
      };
    }
    // Legacy Keys variant
    if (!proto.cipherKey || proto.cipherKey.length !== 32) {
      throw new Error("Invalid message cipher key");
    }
    if (!proto.macKey || proto.macKey.length !== 32) {
      throw new Error("Invalid message MAC key");
    }
    if (!proto.iv || proto.iv.length !== 16) {
      throw new Error("Invalid message IV");
    }
    return {
      variant: "keys",
      keys: new MessageKeys(proto.cipherKey, proto.macKey, proto.iv, proto.index ?? 0),
    };
  },
} as const;
