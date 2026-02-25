/**
 * SPQR Authenticator — HMAC-SHA256 MAC for KEM exchanges.
 *
 * Ported from Signal's spqr crate: authenticator.rs
 *
 * The Authenticator produces and verifies MACs over ciphertext and header
 * data using HMAC-SHA256. The internal root_key and mac_key are updated
 * via HKDF at each epoch transition.
 *
 * All info strings and data formats MUST match the Rust implementation exactly.
 */

import { hkdfSha256, hmacSha256 } from "../../crypto/kdf.js";
import { constantTimeEqual } from "../../crypto/constant-time.js";

// MAC output size in bytes
export const MAC_SIZE = 32;

const ZERO_SALT = new Uint8Array(32);

// ---- Errors ----

export class AuthenticatorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AuthenticatorError";
  }
}

// ---- Authenticator ----

export class Authenticator {
  private rootKey: Uint8Array;
  private macKey: Uint8Array;

  constructor(rootKey: Uint8Array, macKey: Uint8Array) {
    this.rootKey = rootKey;
    this.macKey = macKey;
  }

  /**
   * Create a new Authenticator from a root key and initial epoch.
   * Matches Rust: Authenticator::new(root_key, ep)
   */
  static create(rootKey: Uint8Array, epoch: number): Authenticator {
    const auth = new Authenticator(new Uint8Array(32), new Uint8Array(32));
    auth.update(epoch, rootKey);
    return auth;
  }

  /**
   * Update the authenticator with a new epoch and key material.
   *
   * HKDF info: "Signal_PQCKA_V1_MLKEM768:Authenticator Update" + epoch_be8
   */
  update(epoch: number, key: Uint8Array): void {
    // ikm = [root_key || key]
    const ikm = new Uint8Array(this.rootKey.length + key.length);
    ikm.set(this.rootKey, 0);
    ikm.set(key, this.rootKey.length);

    const infoStr = new TextEncoder().encode("Signal_PQCKA_V1_MLKEM768:Authenticator Update");
    const epochBe8 = epochToBeBytes(epoch);
    const info = concat(infoStr, epochBe8);

    const derived = hkdfSha256(ikm, ZERO_SALT, info, 64);
    this.rootKey = derived.slice(0, 32);
    this.macKey = derived.slice(32, 64);
  }

  /**
   * Compute MAC over ciphertext.
   *
   * HMAC data: "Signal_PQCKA_V1_MLKEM768:ciphertext" + epoch_be8 + ct
   */
  macCt(epoch: number, ct: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode("Signal_PQCKA_V1_MLKEM768:ciphertext");
    const epochBe8 = epochToBeBytes(epoch);
    const data = concat(prefix, epochBe8, ct);
    return hmacSha256(this.macKey, data);
  }

  /**
   * Compute MAC over header (encapsulation key header).
   *
   * HMAC data: "Signal_PQCKA_V1_MLKEM768:ekheader" + epoch_be8 + hdr
   */
  macHdr(epoch: number, hdr: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode("Signal_PQCKA_V1_MLKEM768:ekheader");
    const epochBe8 = epochToBeBytes(epoch);
    const data = concat(prefix, epochBe8, hdr);
    return hmacSha256(this.macKey, data);
  }

  /**
   * Verify ciphertext MAC (constant-time).
   */
  verifyCt(epoch: number, ct: Uint8Array, expectedMac: Uint8Array): void {
    const computed = this.macCt(epoch, ct);
    if (!constantTimeEqual(computed, expectedMac)) {
      throw new AuthenticatorError("Ciphertext MAC is invalid", "INVALID_CT_MAC");
    }
  }

  /**
   * Verify header MAC (constant-time).
   */
  verifyHdr(epoch: number, hdr: Uint8Array, expectedMac: Uint8Array): void {
    const computed = this.macHdr(epoch, hdr);
    if (!constantTimeEqual(computed, expectedMac)) {
      throw new AuthenticatorError("Encapsulation key MAC is invalid", "INVALID_HDR_MAC");
    }
  }

  // ---- Serialization ----

  serialize(): { rootKey: Uint8Array; macKey: Uint8Array } {
    return {
      rootKey: Uint8Array.from(this.rootKey),
      macKey: Uint8Array.from(this.macKey),
    };
  }

  static deserialize(data: { rootKey: Uint8Array; macKey: Uint8Array }): Authenticator {
    return new Authenticator(Uint8Array.from(data.rootKey), Uint8Array.from(data.macKey));
  }

  clone(): Authenticator {
    return new Authenticator(Uint8Array.from(this.rootKey), Uint8Array.from(this.macKey));
  }
}

// ---- Helpers ----

/** Convert epoch (u64) to 8 big-endian bytes */
function epochToBeBytes(epoch: number): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  // JS number is safe for epochs up to 2^53; use two 32-bit writes
  view.setUint32(0, Math.floor(epoch / 0x100000000), false);
  view.setUint32(4, epoch >>> 0, false);
  return buf;
}

/** Concatenate multiple Uint8Arrays */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const a of arrays) totalLen += a.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}
