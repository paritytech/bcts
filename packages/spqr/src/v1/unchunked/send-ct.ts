/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Unchunked send_ct state machine for SPQR V1.
 *
 * Ported from Signal's spqr crate: v1/unchunked/send_ct.rs
 *
 * True incremental ML-KEM-768 implementation (Phase 9):
 *
 * - sendCt1(rng) performs encaps1 using only the header, producing
 *   a REAL ct1 and shared secret. The epoch secret is derived here.
 *
 * - recvEk(ek) validates the encapsulation key against the header
 *   and stores it for encaps2.
 *
 * - sendCt2() calls encaps2(ek, es) to produce ct2, then MACs ct1||ct2.
 *
 * State transitions:
 *   NoHeaderReceived    --recvHeader(epoch, hdr, mac)--> HeaderReceived
 *   HeaderReceived      --sendCt1(rng)----------------> Ct1Sent + REAL ct1 + EpochSecret
 *   Ct1Sent             --recvEk(ek)------------------> Ct1SentEkReceived
 *   Ct1SentEkReceived   --sendCt2()-------------------> Ct2Sent + (ct2, mac)
 *   Ct2Sent             (terminal -- caller creates next KeysUnsampled)
 */

import { Authenticator } from '../../authenticator.js';
import { hkdfSha256 } from '../../kdf.js';
import { concat, bigintToBE8 } from '../../util.js';
import { ZERO_SALT, LABEL_SCKA_KEY } from '../../constants.js';
import {
  encaps1,
  encaps2,
  ekMatchesHeader,
} from '../../incremental-mlkem768.js';
import { SpqrError, SpqrErrorCode } from '../../error.js';
import type { Epoch, EpochSecret, RandomBytes } from '../../types.js';

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

/** Result of Ct1SentEkReceived.sendCt2 */
export interface SendCt2Result {
  /** Next state (terminal for this epoch's send_ct) */
  state: Ct2Sent;
  /** The 128-byte second ciphertext fragment */
  ct2: Uint8Array;
  /** The HMAC-SHA256 MAC over the full ciphertext (ct1 || ct2) */
  mac: Uint8Array;
}

// ---- State: NoHeaderReceived ----

/**
 * Waiting to receive the header from the send_ek peer.
 */
export class NoHeaderReceived {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
  ) {}

  /**
   * Receive the header and verify its MAC.
   *
   * @param epoch - The epoch for this exchange (must match current epoch)
   * @param hdr - The 64-byte public key header
   * @param mac - The 32-byte HMAC-SHA256 MAC over the header
   * @returns Next state
   * @throws {AuthenticatorError} If the header MAC is invalid
   */
  recvHeader(epoch: Epoch, hdr: Uint8Array, mac: Uint8Array): HeaderReceived {
    // Verify header MAC
    this.auth.verifyHdr(epoch, hdr, mac);

    return new HeaderReceived(
      this.epoch,
      this.auth,
      hdr,
    );
  }
}

// ---- State: HeaderReceived ----

/**
 * The header has been received and verified. Ready to produce ct1.
 *
 * In the true incremental ML-KEM approach, sendCt1 performs encaps1
 * using only the header (rho + H(ek)), producing REAL ct1 and shared
 * secret. The epoch secret is derived here.
 */
export class HeaderReceived {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
    public readonly hdr: Uint8Array,
  ) {}

  /**
   * Generate encapsulation randomness and produce REAL ct1.
   *
   * Performs encaps1 using the header to produce:
   * - Real ct1 (960 bytes)
   * - Real shared secret -> epoch secret
   * - Encapsulation state for later encaps2
   *
   * The authenticator is updated with the derived epoch secret.
   *
   * @param rng - Random byte generator
   * @returns [nextState, real_ct1, epochSecret]
   */
  sendCt1(rng: RandomBytes): [Ct1Sent, Uint8Array, EpochSecret] {
    const { ct1, es, sharedSecret } = encaps1(this.hdr, rng);

    // Derive epoch secret (with epoch in HKDF info, matching Rust)
    const epochSecret = deriveEpochSecret(this.epoch, sharedSecret);

    // Update authenticator with the HKDF-derived secret at current epoch
    const auth = this.auth.clone();
    auth.update(this.epoch, epochSecret.secret);

    const nextState = new Ct1Sent(
      this.epoch,
      auth,
      this.hdr,
      es,
      ct1,
    );

    return [nextState, ct1, epochSecret];
  }
}

// ---- State: Ct1Sent ----

/**
 * Real ct1 has been produced. Waiting for the encapsulation key.
 *
 * Stores hdr, es(2080), and ct1(960) for the encaps2 phase.
 */
export class Ct1Sent {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
    public readonly hdr: Uint8Array,
    public readonly es: Uint8Array,
    public readonly ct1: Uint8Array,
  ) {}

  /**
   * Receive the encapsulation key and validate it against the header.
   *
   * In the true incremental approach, this simply validates and stores
   * the ek for later use in sendCt2. No encapsulation happens here.
   *
   * @param ek - The 1152-byte encapsulation key from the send_ek peer
   * @returns Next state
   * @throws {SpqrError} If the ek does not match the header
   */
  recvEk(ek: Uint8Array): Ct1SentEkReceived {
    if (!ekMatchesHeader(ek, this.hdr)) {
      throw new SpqrError(
        'Encapsulation key does not match header',
        SpqrErrorCode.ErroneousDataReceived,
      );
    }

    return new Ct1SentEkReceived(
      this.epoch,
      this.auth,
      this.es,
      ek,
      this.ct1,
    );
  }
}

// ---- State: Ct1SentEkReceived ----

/**
 * The encapsulation key has been received and validated.
 * Ready to send ct2.
 *
 * Stores es(2080), ek(1152), and ct1(960) for encaps2 + MAC.
 */
export class Ct1SentEkReceived {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
    public readonly es: Uint8Array,
    public readonly ek: Uint8Array,
    public readonly ct1: Uint8Array,
  ) {}

  /**
   * Produce ct2 by calling encaps2, then MAC over ct1 || ct2.
   *
   * @returns Result with next state, ct2, and MAC
   */
  sendCt2(): SendCt2Result {
    // encaps2 produces ct2 only
    const ct2 = encaps2(this.ek, this.es);

    // MAC over the full ciphertext: ct1 || ct2
    const fullCt = concat(this.ct1, ct2);
    const mac = this.auth.macCt(this.epoch, fullCt);

    const state = new Ct2Sent(this.epoch, this.auth);

    return {
      state,
      ct2,
      mac,
    };
  }
}

// ---- State: Ct2Sent ----

/**
 * Terminal state for this epoch's send_ct exchange.
 *
 * The caller is responsible for creating the next epoch's
 * send_ek::KeysUnsampled state from the epoch and auth.
 */
export class Ct2Sent {
  constructor(
    public readonly epoch: Epoch,
    public readonly auth: Authenticator,
  ) {}

  /** The next epoch for the send_ek side */
  get nextEpoch(): Epoch {
    return this.epoch + 1n;
  }
}
