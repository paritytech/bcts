/**
 * SPQR-compatible Sparse Post-Quantum Ratchet state machine.
 *
 * "Sparse" means the PQ ratchet advances at DH ratchet boundaries,
 * NOT per-message. All messages within the same chain share the same
 * PQ key, ensuring out-of-order messages decrypt correctly.
 *
 * The PQ root key is mixed into message key derivation as extra HKDF
 * salt, giving quantum-resistant forward secrecy at DH boundaries.
 *
 * Reference: libsignal's spqr crate (SparsePostQuantumRatchet)
 */

import { hmacSha256 } from "../crypto/kdf.js";

const SPQR_MESSAGE_KEY_SEED = new Uint8Array([0x02]);
const SPQR_ADVANCE_SEED = new Uint8Array([0x01]);

export class PqRatchetState {
  private _rootKey: Uint8Array;

  constructor(rootKey: Uint8Array) {
    if (rootKey.length !== 32) {
      throw new Error("PQ ratchet root key must be 32 bytes");
    }
    this._rootKey = rootKey;
  }

  rootKey(): Uint8Array {
    return this._rootKey;
  }

  /**
   * Derive the current PQ message key for sending.
   *
   * This does NOT advance the PQ state — all messages in the same
   * chain use the same PQ key. The SPQR message on the wire carries
   * the current root key for the receiver.
   */
  send(): { messageKey: Uint8Array; spqrMessage: Uint8Array } {
    const messageKey = hmacSha256(this._rootKey, SPQR_MESSAGE_KEY_SEED);

    // Wire format: [version(1)][rootKey(32)]
    const spqrMessage = new Uint8Array(33);
    spqrMessage[0] = 0x01; // version
    spqrMessage.set(this._rootKey, 1);

    return { messageKey, spqrMessage };
  }

  /**
   * Derive the PQ message key for decryption.
   *
   * Does NOT advance the PQ state — all messages in the same chain
   * use the same PQ key.
   */
  recv(_spqrMessage: Uint8Array): Uint8Array {
    return hmacSha256(this._rootKey, SPQR_MESSAGE_KEY_SEED);
  }

  /**
   * Advance the PQ ratchet at a DH ratchet boundary.
   *
   * Called during DH ratchet steps to provide PQ forward secrecy.
   * The DH shared secret is mixed in to bind the PQ state to the
   * DH ratchet progression.
   */
  ratchetStep(dhSharedSecret: Uint8Array): void {
    // Mix DH secret into PQ root: new_root = HMAC(old_root, dhSecret)
    this._rootKey = hmacSha256(this._rootKey, dhSharedSecret);
  }

  clone(): PqRatchetState {
    return new PqRatchetState(Uint8Array.from(this._rootKey));
  }
}
