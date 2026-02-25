/**
 * SenderMessageKey -- derived message encryption key for group messaging.
 *
 * Reference: libsignal/rust/protocol/src/sender_keys.rs (SenderMessageKey)
 */

import { hkdfSha256 } from "../crypto/kdf.js";

export class SenderMessageKey {
  readonly iteration: number;
  readonly seed: Uint8Array;
  private _derived: { iv: Uint8Array; cipherKey: Uint8Array } | undefined;

  constructor(iteration: number, seed: Uint8Array) {
    this.iteration = iteration;
    this.seed = seed;
  }

  private derive(): { iv: Uint8Array; cipherKey: Uint8Array } {
    if (this._derived == null) {
      // HKDF with no salt, info="WhisperGroup", output=48 bytes
      const derived = hkdfSha256(
        this.seed,
        undefined,
        new TextEncoder().encode("WhisperGroup"),
        48,
      );
      this._derived = {
        iv: derived.slice(0, 16),
        cipherKey: derived.slice(16, 48),
      };
    }
    return this._derived;
  }

  get iv(): Uint8Array {
    return this.derive().iv;
  }

  get cipherKey(): Uint8Array {
    return this.derive().cipherKey;
  }
}
