/**
 * Copyright © 2025 Signal Messenger, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Chunked send_ek state machine for SPQR V1.
 *
 * Wraps the unchunked send_ek states with PolyEncoder/PolyDecoder erasure
 * coding, enabling chunk-by-chunk data transfer.
 *
 * States:
 *   KeysUnsampled       -- sendHdrChunk(rng) --> KeysSampled + Chunk
 *   KeysSampled          -- sendHdrChunk() --> KeysSampled + Chunk
 *                        -- recvCt1Chunk(epoch, chunk) --> HeaderSent
 *   HeaderSent           -- sendEkChunk() --> HeaderSent + Chunk
 *                        -- recvCt1Chunk(epoch, chunk) --> HeaderSent | Ct1Received
 *   Ct1Received          -- sendEkChunk() --> Ct1Received + Chunk
 *                        -- recvCt2Chunk(epoch, chunk) --> EkSentCt1Received
 *   EkSentCt1Received    -- recvCt2Chunk(epoch, chunk) --> EkSentCt1Received | sendCt.NoHeaderReceived
 */

import type * as unchunked from "../unchunked/send-ek.js";
import * as unchunkedSendCt from "../unchunked/send-ct.js";
import { PolyEncoder, PolyDecoder } from "../../encoding/polynomial.js";
import type { Chunk } from "../../encoding/polynomial.js";
import { HEADER_SIZE, CT1_SIZE, CT2_SIZE } from "../../incremental-mlkem768.js";
import { MAC_SIZE } from "../../authenticator.js";
import { concat } from "../../util.js";
import { SpqrError, SpqrErrorCode } from "../../error.js";
import type { Epoch, EpochSecret, RandomBytes } from "../../types.js";
import type * as sendCt from "./send-ct.js";

// ---------------------------------------------------------------------------
// Discriminated union result types
// ---------------------------------------------------------------------------

export type HeaderSentRecvChunk =
  | { done: false; state: HeaderSent }
  | { done: true; state: Ct1Received };

export type EkSentCt1ReceivedRecvChunk =
  | { done: false; state: EkSentCt1Received }
  | { done: true; state: sendCt.NoHeaderReceived; epochSecret: EpochSecret };

// ---------------------------------------------------------------------------
// State 1: KeysUnsampled
// ---------------------------------------------------------------------------

/**
 * Initial chunked send_ek state. No keypair generated yet.
 * Wraps unchunked.KeysUnsampled.
 */
export class KeysUnsampled {
  constructor(public readonly uc: unchunked.KeysUnsampled) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /**
   * Generate keypair, produce header + MAC, encode into PolyEncoder,
   * and return the first header chunk.
   */
  sendHdrChunk(rng: RandomBytes): [KeysSampled, Chunk] {
    const [headerSent, hdr, mac] = this.uc.sendHeader(rng);
    const hdrPayload = concat(hdr, mac);
    const sendingHdr = PolyEncoder.encodeBytes(hdrPayload);
    const chunk = sendingHdr.nextChunk();
    return [new KeysSampled(headerSent, sendingHdr), chunk];
  }
}

// ---------------------------------------------------------------------------
// State 2: KeysSampled
// ---------------------------------------------------------------------------

/**
 * Header has been generated and encoding started. Still sending header chunks.
 * Can also begin receiving ct1 chunks.
 */
export class KeysSampled {
  constructor(
    public readonly uc: unchunked.HeaderSent,
    public readonly sendingHdr: PolyEncoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /** Produce the next header chunk. */
  sendHdrChunk(): [KeysSampled, Chunk] {
    const chunk = this.sendingHdr.nextChunk();
    return [this, chunk];
  }

  /**
   * Receive a ct1 chunk from the send_ct peer.
   * This triggers sending the encapsulation key.
   */
  recvCt1Chunk(epoch: Epoch, chunk: Chunk): HeaderSent {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    // Create ct1 decoder
    const receivingCt1 = PolyDecoder.create(CT1_SIZE);
    receivingCt1.addChunk(chunk);

    // Transition unchunked: send ek
    const [ekSent, ek] = this.uc.sendEk();
    const sendingEk = PolyEncoder.encodeBytes(ek);

    return new HeaderSent(ekSent, sendingEk, receivingCt1);
  }
}

// ---------------------------------------------------------------------------
// State 3: HeaderSent
// ---------------------------------------------------------------------------

/**
 * Sending ek chunks while receiving ct1 chunks.
 */
export class HeaderSent {
  constructor(
    public readonly uc: unchunked.EkSent,
    public readonly sendingEk: PolyEncoder,
    public readonly receivingCt1: PolyDecoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /** Produce the next ek chunk. */
  sendEkChunk(): [HeaderSent, Chunk] {
    const chunk = this.sendingEk.nextChunk();
    return [this, chunk];
  }

  /** Receive a ct1 chunk. Returns done when ct1 is fully decoded. */
  recvCt1Chunk(epoch: Epoch, chunk: Chunk): HeaderSentRecvChunk {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    this.receivingCt1.addChunk(chunk);
    const decoded = this.receivingCt1.decodedMessage();

    if (decoded !== null) {
      // ct1 fully received -- transition unchunked
      const ucResult = this.uc.recvCt1(decoded);
      return { done: true, state: new Ct1Received(ucResult, this.sendingEk) };
    }

    return { done: false, state: this };
  }
}

// ---------------------------------------------------------------------------
// State 4: Ct1Received
// ---------------------------------------------------------------------------

/**
 * ct1 has been fully decoded. Still sending ek chunks.
 * Can begin receiving ct2 chunks.
 */
export class Ct1Received {
  constructor(
    public readonly uc: unchunked.EkSentCt1Received,
    public readonly sendingEk: PolyEncoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /** Produce the next ek chunk. */
  sendEkChunk(): [Ct1Received, Chunk] {
    const chunk = this.sendingEk.nextChunk();
    return [this, chunk];
  }

  /**
   * Receive a ct2 chunk. Creates the ct2 decoder.
   * ct2 payload is CT2_SIZE + MAC_SIZE = 160 bytes
   * (carries ct2 + mac).
   */
  recvCt2Chunk(epoch: Epoch, chunk: Chunk): EkSentCt1Received {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    const receivingCt2 = PolyDecoder.create(CT2_SIZE + MAC_SIZE);
    receivingCt2.addChunk(chunk);

    return new EkSentCt1Received(this.uc, receivingCt2);
  }
}

// ---------------------------------------------------------------------------
// State 5: EkSentCt1Received
// ---------------------------------------------------------------------------

/**
 * Both ek sending and ct1 receiving are done. Now receiving ct2 chunks.
 * When ct2 is fully decoded, extract ct2 and mac, then perform decapsulation
 * to derive the epoch secret.
 */
export class EkSentCt1Received {
  constructor(
    public readonly uc: unchunked.EkSentCt1Received,
    public readonly receivingCt2: PolyDecoder,
  ) {}

  get epoch(): Epoch {
    return this.uc.epoch;
  }

  /**
   * Receive a ct2 chunk. Returns done when ct2 is fully decoded and
   * epoch secret is derived.
   */
  recvCt2Chunk(epoch: Epoch, chunk: Chunk): EkSentCt1ReceivedRecvChunk {
    if (epoch !== this.uc.epoch) {
      throw new SpqrError(
        `Epoch mismatch: expected ${this.uc.epoch}, got ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    this.receivingCt2.addChunk(chunk);
    const decoded = this.receivingCt2.decodedMessage();

    if (decoded !== null) {
      // Split the 160-byte payload: ct2(128) + mac(32)
      const ct2 = decoded.slice(0, CT2_SIZE);
      const mac = decoded.slice(CT2_SIZE);

      // Use the unchunked state directly (ct1 is already the REAL ct1)
      const result = this.uc.recvCt2(ct2, mac);

      // Construct the next-epoch send_ct NoHeaderReceived state
      const nextUcSendCt = new unchunkedSendCt.NoHeaderReceived(result.nextEpoch, result.auth);
      const receivingHdr = PolyDecoder.create(HEADER_SIZE + MAC_SIZE);

      return {
        done: true,
        state: createSendCtNoHeaderReceived(nextUcSendCt, receivingHdr),
        epochSecret: result.epochSecret,
      };
    }

    return { done: false, state: this };
  }
}

// ---------------------------------------------------------------------------
// Factory for creating send-ct NoHeaderReceived (breaks circular dependency)
// ---------------------------------------------------------------------------

/** @internal Set by the chunked index module to break circular imports. */
let createSendCtNoHeaderReceived: (
  uc: unchunkedSendCt.NoHeaderReceived,
  receivingHdr: PolyDecoder,
) => sendCt.NoHeaderReceived;

/** @internal Called by the index module to wire up the factory. */
export function _setCreateSendCtNoHeaderReceived(
  factory: (
    uc: unchunkedSendCt.NoHeaderReceived,
    receivingHdr: PolyDecoder,
  ) => sendCt.NoHeaderReceived,
): void {
  createSendCtNoHeaderReceived = factory;
}
