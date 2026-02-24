/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Chunked send_ct state machine for SPQR V1.
 *
 * Wraps the unchunked send_ct states with PolyEncoder/PolyDecoder erasure
 * coding, enabling chunk-by-chunk data transfer.
 *
 * True incremental ML-KEM (Phase 9):
 *   - send_ct produces REAL ct1 chunks from the start.
 *   - ct2 payload carries only ct2(128) + mac(32) = 160 bytes.
 *   - Epoch secret is derived in sendCt1 (when encaps1 is performed).
 *
 * States:
 *   NoHeaderReceived      -- recvHdrChunk(epoch, chunk) --> NoHeaderReceived | HeaderReceived
 *   HeaderReceived        -- sendCt1Chunk(rng) --> [Ct1Sampled, Chunk, EpochSecret]
 *   Ct1Sampled            -- sendCt1Chunk() --> [Ct1Sampled, Chunk]
 *                         -- recvEkChunk(epoch, chunk, ct1Ack) --> 4 outcomes
 *   EkReceivedCt1Sampled  -- sendCt1Chunk() --> [EkReceivedCt1Sampled, Chunk]
 *                         -- recvCt1Ack(epoch) --> Ct2Sampled
 *   Ct1Acknowledged       -- recvEkChunk(epoch, chunk) --> Ct1Acknowledged | Ct2Sampled
 *   Ct2Sampled            -- sendCt2Chunk() --> [Ct2Sampled, Chunk]
 *                         -- recvNextEpoch(epoch) --> sendEk.KeysUnsampled
 */

import * as unchunkedSendCt from '../unchunked/send-ct.js';
import * as unchunkedSendEk from '../unchunked/send-ek.js';
import { PolyEncoder, PolyDecoder } from '../../encoding/polynomial.js';
import type { Chunk } from '../../encoding/polynomial.js';
import { HEADER_SIZE, EK_SIZE, CT2_SIZE } from '../../incremental-mlkem768.js';
import { MAC_SIZE } from '../../authenticator.js';
import { Authenticator } from '../../authenticator.js';
import { concat } from '../../util.js';
import { SpqrError, SpqrErrorCode } from '../../error.js';
import type { Epoch, EpochSecret, RandomBytes } from '../../types.js';
import * as sendEk from './send-ek.js';

// ---------------------------------------------------------------------------
// Discriminated union result types
// ---------------------------------------------------------------------------

export type NoHeaderReceivedRecvChunk =
  | { done: false; state: NoHeaderReceived }
  | { done: true; state: HeaderReceived };

export type Ct1SampledRecvChunk =
  | { tag: 'stillReceivingStillSending'; state: Ct1Sampled }
  | { tag: 'stillReceiving'; state: Ct1Acknowledged }
  | { tag: 'stillSending'; state: EkReceivedCt1Sampled; epochSecret: EpochSecret | null }
  | { tag: 'done'; state: Ct2Sampled; epochSecret: EpochSecret | null };

export type Ct1AcknowledgedRecvChunk =
  | { done: false; state: Ct1Acknowledged }
  | { done: true; state: Ct2Sampled; epochSecret: EpochSecret | null };

// ---------------------------------------------------------------------------
// State 1: NoHeaderReceived
// ---------------------------------------------------------------------------

/**
 * Waiting to receive header chunks from the send_ek peer.
 */
export class NoHeaderReceived {
  constructor(
    public readonly uc: unchunkedSendCt.NoHeaderReceived,
    public readonly receivingHdr: PolyDecoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /**
   * Create the initial NoHeaderReceived from an auth key.
   */
  static create(authKey: Uint8Array): NoHeaderReceived {
    const auth = Authenticator.create(authKey, 1n);
    const uc = new unchunkedSendCt.NoHeaderReceived(1n, auth);
    const receivingHdr = PolyDecoder.create(HEADER_SIZE + MAC_SIZE);
    return new NoHeaderReceived(uc, receivingHdr);
  }

  /** Receive a header chunk. Returns done when header is fully decoded. */
  recvHdrChunk(epoch: Epoch, chunk: Chunk): NoHeaderReceivedRecvChunk {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    this.receivingHdr.addChunk(chunk);
    const decoded = this.receivingHdr.decodedMessage();

    if (decoded !== null) {
      // Split: hdr(64) + mac(32)
      const hdr = decoded.slice(0, HEADER_SIZE);
      const mac = decoded.slice(HEADER_SIZE);

      // Verify header MAC and transition
      const ucResult = this.uc.recvHeader(epoch, hdr, mac);

      // Create ek decoder
      const receivingEk = PolyDecoder.create(EK_SIZE);

      return { done: true, state: new HeaderReceived(ucResult, receivingEk) };
    }

    return { done: false, state: this };
  }
}

// ---------------------------------------------------------------------------
// State 2: HeaderReceived
// ---------------------------------------------------------------------------

/**
 * Header has been received and verified. Ready to produce ct1 chunks.
 */
export class HeaderReceived {
  constructor(
    public readonly uc: unchunkedSendCt.HeaderReceived,
    public readonly receivingEk: PolyDecoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /**
   * Generate encapsulation randomness, produce REAL ct1, encode it,
   * and return the first ct1 chunk.
   *
   * Returns [Ct1Sampled, Chunk, EpochSecret] -- real epoch secret.
   */
  sendCt1Chunk(rng: RandomBytes): [Ct1Sampled, Chunk, EpochSecret] {
    const [ct1Sent, realCt1, epochSecret] = this.uc.sendCt1(rng);
    const sendingCt1 = PolyEncoder.encodeBytes(realCt1);
    const chunk = sendingCt1.nextChunk();
    return [
      new Ct1Sampled(ct1Sent, sendingCt1, this.receivingEk),
      chunk,
      epochSecret,
    ];
  }
}

// ---------------------------------------------------------------------------
// State 3: Ct1Sampled
// ---------------------------------------------------------------------------

/**
 * Real ct1 has been produced and encoding started.
 * Sending ct1 chunks while receiving ek chunks.
 */
export class Ct1Sampled {
  constructor(
    public readonly uc: unchunkedSendCt.Ct1Sent,
    public readonly sendingCt1: PolyEncoder,
    public readonly receivingEk: PolyDecoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /** Produce the next ct1 chunk. */
  sendCt1Chunk(): [Ct1Sampled, Chunk] {
    const chunk = this.sendingCt1.nextChunk();
    return [this, chunk];
  }

  /**
   * Receive an ek chunk, with optional ct1 acknowledgement from peer.
   *
   * Four possible outcomes depending on whether ek is complete and
   * whether the peer acknowledged ct1:
   *   - Both: done (Ct2Sampled + epochSecret)
   *   - ek complete, no ack: stillSending (EkReceivedCt1Sampled + epochSecret)
   *   - ek incomplete, ack: stillReceiving (Ct1Acknowledged)
   *   - Neither: stillReceivingStillSending (Ct1Sampled)
   */
  recvEkChunk(
    epoch: Epoch,
    chunk: Chunk,
    ct1Ack: boolean,
  ): Ct1SampledRecvChunk {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    this.receivingEk.addChunk(chunk);
    const ekDecoded = this.receivingEk.decodedMessage();

    if (ekDecoded !== null && ct1Ack) {
      // Both ek complete and ct1 acknowledged
      const ucResult = this.uc.recvEk(ekDecoded);
      const { state: ct2SentUc, ct2, mac } = ucResult.sendCt2();
      // ct2 payload = ct2(128) + mac(32) = 160 bytes
      const ct2Payload = concat(ct2, mac);
      const sendingCt2 = PolyEncoder.encodeBytes(ct2Payload);
      return {
        tag: 'done',
        state: new Ct2Sampled(ct2SentUc, sendingCt2),
        epochSecret: null, // Epoch secret already derived in sendCt1
      };
    }

    if (ekDecoded !== null && !ct1Ack) {
      // ek complete but ct1 not yet acknowledged
      const ucResult = this.uc.recvEk(ekDecoded);
      return {
        tag: 'stillSending',
        state: new EkReceivedCt1Sampled(ucResult, this.sendingCt1),
        epochSecret: null, // Epoch secret already derived in sendCt1
      };
    }

    if (ekDecoded === null && ct1Ack) {
      // ct1 acknowledged but ek not yet complete
      return {
        tag: 'stillReceiving',
        state: new Ct1Acknowledged(this.uc, this.receivingEk),
      };
    }

    // Neither complete
    return {
      tag: 'stillReceivingStillSending',
      state: this,
    };
  }
}

// ---------------------------------------------------------------------------
// State 4: EkReceivedCt1Sampled
// ---------------------------------------------------------------------------

/**
 * ek has been received and validated.
 * Still sending ct1 chunks, waiting for ct1 acknowledgement.
 */
export class EkReceivedCt1Sampled {
  constructor(
    public readonly uc: unchunkedSendCt.Ct1SentEkReceived,
    public readonly sendingCt1: PolyEncoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /** Produce the next ct1 chunk. */
  sendCt1Chunk(): [EkReceivedCt1Sampled, Chunk] {
    const chunk = this.sendingCt1.nextChunk();
    return [this, chunk];
  }

  /** Peer has acknowledged ct1. Produce ct2 and encode it. */
  recvCt1Ack(epoch: Epoch): Ct2Sampled {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    const { state: ct2SentUc, ct2, mac } = this.uc.sendCt2();
    // ct2 payload = ct2(128) + mac(32) = 160 bytes
    const ct2Payload = concat(ct2, mac);
    const sendingCt2 = PolyEncoder.encodeBytes(ct2Payload);

    return new Ct2Sampled(ct2SentUc, sendingCt2);
  }
}

// ---------------------------------------------------------------------------
// State 5: Ct1Acknowledged
// ---------------------------------------------------------------------------

/**
 * ct1 has been acknowledged by the peer. Still receiving ek chunks.
 * When ek arrives, validate it and produce ct2.
 */
export class Ct1Acknowledged {
  constructor(
    public readonly uc: unchunkedSendCt.Ct1Sent,
    public readonly receivingEk: PolyDecoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /** Receive an ek chunk. Returns done when ek is fully decoded. */
  recvEkChunk(epoch: Epoch, chunk: Chunk): Ct1AcknowledgedRecvChunk {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    this.receivingEk.addChunk(chunk);
    const decoded = this.receivingEk.decodedMessage();

    if (decoded !== null) {
      const ucResult = this.uc.recvEk(decoded);
      const { state: ct2SentUc, ct2, mac } = ucResult.sendCt2();
      // ct2 payload = ct2(128) + mac(32) = 160 bytes
      const ct2Payload = concat(ct2, mac);
      const sendingCt2 = PolyEncoder.encodeBytes(ct2Payload);
      return {
        done: true,
        state: new Ct2Sampled(ct2SentUc, sendingCt2),
        epochSecret: null, // Epoch secret already derived in sendCt1
      };
    }

    return { done: false, state: this };
  }
}

// ---------------------------------------------------------------------------
// State 6: Ct2Sampled
// ---------------------------------------------------------------------------

/**
 * ct2 payload (ct2 + mac) has been encoded. Sending ct2 chunks.
 * Terminal for this epoch once all chunks sent and next epoch begins.
 */
export class Ct2Sampled {
  constructor(
    public readonly uc: unchunkedSendCt.Ct2Sent,
    public readonly sendingCt2: PolyEncoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /** Produce the next ct2 chunk. */
  sendCt2Chunk(): [Ct2Sampled, Chunk] {
    const chunk = this.sendingCt2.nextChunk();
    return [this, chunk];
  }

  /**
   * Transition to the next epoch's send_ek KeysUnsampled.
   */
  recvNextEpoch(_epoch: Epoch): sendEk.KeysUnsampled {
    const nextEpoch = this.uc.nextEpoch;
    const nextUc = new unchunkedSendEk.KeysUnsampled(nextEpoch, this.uc.auth);
    return new sendEk.KeysUnsampled(nextUc);
  }
}
