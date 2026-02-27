// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

import { hkdfSha256, MessageKeys } from "@bcts/double-ratchet";

const INFO = new TextEncoder().encode("WhisperMessageKeys");

/**
 * Derive message keys combining classical chain key seed with PQ ratchet key.
 *
 * HKDF-SHA256(
 *   salt = pqRatchetKey (32 bytes, or undefined for V0/legacy),
 *   ikm  = chainKeySeed (32 bytes from ChainKey.messageKeySeed()),
 *   info = "WhisperMessageKeys",
 *   len  = 80
 * )
 *
 * Split: cipherKey[0:32] + macKey[32:64] + iv[64:80]
 *
 * CRITICAL: pqRatchetKey goes in the SALT position, chainKeySeed is IKM.
 * When pqRatchetKey is null, salt is undefined (matches standard double-ratchet).
 *
 * Reference: libsignal/rust/protocol/src/ratchet/keys.rs MessageKeys::derive_keys
 */
export function deriveMessageKeys(
  chainKeySeed: Uint8Array,
  pqRatchetKey: Uint8Array | null,
  counter: number,
): MessageKeys {
  const salt = pqRatchetKey ?? undefined;
  const derived = hkdfSha256(chainKeySeed, salt, INFO, 80);
  return new MessageKeys(
    derived.slice(0, 32),
    derived.slice(32, 64),
    derived.slice(64, 80),
    counter,
  );
}
