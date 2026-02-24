/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Unchunked send_ek state machine for SPQR V1.
 *
 * Ported from Signal's spqr crate: v1/unchunked/send_ek.rs
 *
 * The send_ek side generates an ML-KEM-768 keypair, sends the public key
 * header (hdr) and encapsulation key (ek), then receives ct1 and ct2 from
 * the send_ct peer. On receiving ct2, it performs decapsulation to derive
 * the shared epoch secret.
 *
 * State transitions:
 *   KeysUnsampled      --sendHeader(rng)--> HeaderSent + (hdr, mac)
 *   HeaderSent         --sendEk()---------> EkSent + ek
 *   EkSent             --recvCt1(ct1)-----> EkSentCt1Received
 *   EkSentCt1Received  --recvCt2(ct2, mac)--> RecvCt2Result (epoch, auth, epochSecret)
 *
 * The caller is responsible for constructing the next-epoch send_ct state
 * (NoHeaderReceived) from the RecvCt2Result, avoiding circular imports.
 */

import { Authenticator } from "../../authenticator.js";
import { hkdfSha256 } from "../../kdf.js";
import { concat, bigintToBE8 } from "../../util.js";
import { ZERO_SALT, LABEL_SCKA_KEY } from "../../constants.js";
import { generate, decaps } from "../../incremental-mlkem768.js";
import type { Epoch, EpochSecret, RandomBytes } from "../../types.js";

// Pre-encode the SCKA label
const SCKA_KEY_LABEL = new TextEncoder().encode(LABEL_SCKA_KEY);

/**
 * Derive the epoch secret from the KEM shared secret.
 *
 * HKDF-SHA256(ikm=sharedSecret, salt=ZERO_SALT,
 *             info=LABEL_SCKA_KEY || epoch_be8, length=32)
 *
 * Matches Rust: info = [b"Signal_PQCKA_V1_MLKEM768:SCKA Key", epoch.to_be_bytes()].concat()
 */
function deriveEpochSecret(epoch: Epoch, sharedSecret: Uint8Array): EpochSecret {
  const info = concat(SCKA_KEY_LABEL, bigintToBE8(epoch));
  const secret = hkdfSha256(sharedSecret, ZERO_SALT, info, 32);
  return { epoch, secret };
}

/** Result of EkSentCt1Received.recvCt2 */
export interface RecvCt2Result {
  /** The next epoch (current + 1) */
  nextEpoch: Epoch;
  /** The updated authenticator for the next epoch */
  auth: Authenticator;
  /** The derived epoch secret for chain advancement */
  epochSecret: EpochSecret;
}

// ---- State: KeysUnsampled ----

/**
 * Initial send_ek state. No keypair has been generated yet.
 */
export class KeysUnsampled {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
  ) {}

  /**
   * Generate an ML-KEM-768 keypair and produce the header + MAC.
   *
   * @param rng - Random byte generator
   * @returns [nextState, hdr, hdrMac]
   */
  sendHeader(rng: RandomBytes): [HeaderSent, Uint8Array, Uint8Array] {
    const keys = generate(rng);
    const mac = this.auth.macHdr(this.epoch, keys.hdr);

    const nextState = new HeaderSent(this.epoch, this.auth, keys.ek, keys.dk);

    return [nextState, keys.hdr, mac];
  }
}

// ---- State: HeaderSent ----

/**
 * The header has been sent to the peer. Ready to send the encapsulation key.
 */
export class HeaderSent {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
    public readonly ek: Uint8Array,
    public readonly dk: Uint8Array,
  ) {}

  /**
   * Produce the encapsulation key to send to the peer.
   *
   * @returns [nextState, ek]
   */
  sendEk(): [EkSent, Uint8Array] {
    const nextState = new EkSent(this.epoch, this.auth, this.dk);
    return [nextState, this.ek];
  }
}

// ---- State: EkSent ----

/**
 * Both the header and encapsulation key have been sent.
 * Waiting to receive ct1 from the send_ct peer.
 */
export class EkSent {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
    public readonly dk: Uint8Array,
  ) {}

  /**
   * Receive the first ciphertext fragment from the peer.
   *
   * @param ct1 - The 960-byte first ciphertext fragment
   * @returns Next state
   */
  recvCt1(ct1: Uint8Array): EkSentCt1Received {
    return new EkSentCt1Received(this.epoch, this.auth, this.dk, ct1);
  }
}

// ---- State: EkSentCt1Received ----

/**
 * ct1 has been received. Waiting for ct2 to complete decapsulation.
 */
export class EkSentCt1Received {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
    public readonly dk: Uint8Array,
    public readonly ct1: Uint8Array,
  ) {}

  /**
   * Receive ct2 and MAC, perform decapsulation, verify the MAC,
   * and derive the epoch secret.
   *
   * The caller constructs the next send_ct::NoHeaderReceived state from
   * the returned nextEpoch and auth.
   *
   * @param ct2 - The 128-byte second ciphertext fragment
   * @param mac - The 32-byte HMAC-SHA256 MAC over the full ciphertext
   * @returns Result containing next epoch, updated auth, and epoch secret
   * @throws {AuthenticatorError} If the ciphertext MAC is invalid
   */
  recvCt2(ct2: Uint8Array, mac: Uint8Array): RecvCt2Result {
    // Decapsulate to recover shared secret
    const sharedSecret = decaps(this.dk, this.ct1, ct2);

    // Derive epoch secret (with epoch in HKDF info, matching Rust)
    const epochSecret = deriveEpochSecret(this.epoch, sharedSecret);

    // Update authenticator with the HKDF-derived secret at current epoch
    const auth = this.auth.clone();
    auth.update(this.epoch, epochSecret.secret);

    // Verify the ciphertext MAC: MAC over ct1 || ct2
    const fullCt = concat(this.ct1, ct2);
    auth.verifyCt(this.epoch, fullCt, mac);

    const nextEpoch = this.epoch + 1n;

    return { nextEpoch, auth, epochSecret };
  }
}
