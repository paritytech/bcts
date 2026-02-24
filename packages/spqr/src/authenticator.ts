/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * SPQR Authenticator -- HMAC-SHA256 MAC for KEM exchanges.
 *
 * Ported from Signal's spqr crate: authenticator.rs
 *
 * The Authenticator produces and verifies MACs over ciphertext and header
 * data using HMAC-SHA256. The internal rootKey and macKey are updated
 * via HKDF at each epoch transition.
 *
 * All info strings and data formats MUST match the Rust implementation exactly.
 */

import { hkdfSha256, hmacSha256 } from './kdf.js';
import { concat, bigintToBE8, constantTimeEqual } from './util.js';
import {
  ZERO_SALT,
  MAC_SIZE,
  LABEL_AUTH_UPDATE,
  LABEL_CT_MAC,
  LABEL_HDR_MAC,
} from './constants.js';
import { AuthenticatorError } from './error.js';
import type { Epoch } from './types.js';
import type { PbAuthenticator } from './proto/pq-ratchet-types.js';

// Pre-encode label strings
const enc = new TextEncoder();
const AUTH_UPDATE_INFO = enc.encode(LABEL_AUTH_UPDATE);
const CT_MAC_PREFIX = enc.encode(LABEL_CT_MAC);
const HDR_MAC_PREFIX = enc.encode(LABEL_HDR_MAC);

export { MAC_SIZE };

/**
 * Authenticator manages root_key and mac_key state for producing
 * and verifying MACs over KEM ciphertext and headers.
 *
 * The update operation uses HKDF:
 *   IKM  = [rootKey || key]
 *   Salt = ZERO_SALT (32 zeros)
 *   Info = LABEL_AUTH_UPDATE + epoch_be8
 *   Output: 64 bytes -> [0..32] = new rootKey, [32..64] = new macKey
 *
 * MAC operations use HMAC-SHA256:
 *   Key  = macKey
 *   Data = [label_prefix || epoch_be8 || payload]
 */
export class Authenticator {
  private rootKey: Uint8Array;
  private macKey: Uint8Array;

  constructor(rootKey: Uint8Array, macKey: Uint8Array) {
    this.rootKey = rootKey;
    this.macKey = macKey;
  }

  /**
   * Create a new Authenticator from a root key and initial epoch.
   * Matches Rust: `Authenticator::new(root_key, ep)`
   *
   * Initializes with zero keys, then immediately updates with
   * the provided root key and epoch.
   */
  static create(rootKey: Uint8Array, epoch: Epoch): Authenticator {
    const auth = new Authenticator(new Uint8Array(32), new Uint8Array(32));
    auth.update(epoch, rootKey);
    return auth;
  }

  /**
   * Update the authenticator with a new epoch and key material.
   *
   * HKDF(IKM=[rootKey||key], salt=ZERO_SALT, info=[label||epoch_be8], length=64)
   *
   * Output split: rootKey = [0..32], macKey = [32..64]
   */
  update(epoch: Epoch, key: Uint8Array): void {
    // ikm = [root_key || key]
    const ikm = concat(this.rootKey, key);

    const epochBe8 = bigintToBE8(epoch);
    const info = concat(AUTH_UPDATE_INFO, epochBe8);

    const derived = hkdfSha256(ikm, ZERO_SALT, info, 64);
    this.rootKey = derived.slice(0, 32);
    this.macKey = derived.slice(32, 64);
  }

  /**
   * Compute MAC over ciphertext.
   *
   * HMAC-SHA256(macKey, [LABEL_CT_MAC || epoch_be8 || ct])
   */
  macCt(epoch: Epoch, ct: Uint8Array): Uint8Array {
    const epochBe8 = bigintToBE8(epoch);
    const data = concat(CT_MAC_PREFIX, epochBe8, ct);
    return hmacSha256(this.macKey, data);
  }

  /**
   * Verify ciphertext MAC (constant-time comparison).
   * Throws AuthenticatorError if the MAC does not match.
   */
  verifyCt(epoch: Epoch, ct: Uint8Array, expectedMac: Uint8Array): void {
    const computed = this.macCt(epoch, ct);
    if (!constantTimeEqual(computed, expectedMac)) {
      throw new AuthenticatorError('Ciphertext MAC is invalid', 'INVALID_CT_MAC');
    }
  }

  /**
   * Compute MAC over header (encapsulation key header).
   *
   * HMAC-SHA256(macKey, [LABEL_HDR_MAC || epoch_be8 || hdr])
   */
  macHdr(epoch: Epoch, hdr: Uint8Array): Uint8Array {
    const epochBe8 = bigintToBE8(epoch);
    const data = concat(HDR_MAC_PREFIX, epochBe8, hdr);
    return hmacSha256(this.macKey, data);
  }

  /**
   * Verify header MAC (constant-time comparison).
   * Throws AuthenticatorError if the MAC does not match.
   */
  verifyHdr(epoch: Epoch, hdr: Uint8Array, expectedMac: Uint8Array): void {
    const computed = this.macHdr(epoch, hdr);
    if (!constantTimeEqual(computed, expectedMac)) {
      throw new AuthenticatorError('Encapsulation key MAC is invalid', 'INVALID_HDR_MAC');
    }
  }

  /**
   * Deep clone this authenticator.
   */
  clone(): Authenticator {
    return new Authenticator(
      Uint8Array.from(this.rootKey),
      Uint8Array.from(this.macKey),
    );
  }

  // ---- Protobuf serialization ----

  /**
   * Serialize to protobuf representation.
   * Matches Rust Authenticator::into_pb().
   */
  toProto(): PbAuthenticator {
    return {
      rootKey: Uint8Array.from(this.rootKey),
      macKey: Uint8Array.from(this.macKey),
    };
  }

  /**
   * Deserialize from protobuf representation.
   * Matches Rust Authenticator::from_pb().
   */
  static fromProto(pb: PbAuthenticator): Authenticator {
    return new Authenticator(
      Uint8Array.from(pb.rootKey),
      Uint8Array.from(pb.macKey),
    );
  }
}
