/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Chunked state machine dispatcher for SPQR V1.
 *
 * Provides the top-level send/recv interface that dispatches to the
 * appropriate chunked send_ek or send_ct state, handling epoch
 * validation and state transitions.
 */

import type { Chunk } from '../../encoding/polynomial.js';
import type { Epoch, EpochSecret, RandomBytes } from '../../types.js';
import { SpqrError, SpqrErrorCode } from '../../error.js';
import { Authenticator } from '../../authenticator.js';
import * as unchunked from '../unchunked/send-ek.js';
import * as sendEk from './send-ek.js';
import * as sendCt from './send-ct.js';

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type MessagePayload =
  | { type: 'none' }
  | { type: 'hdr'; chunk: Chunk }
  | { type: 'ek'; chunk: Chunk }
  | { type: 'ekCt1Ack'; chunk: Chunk }
  | { type: 'ct1Ack' }
  | { type: 'ct1'; chunk: Chunk }
  | { type: 'ct2'; chunk: Chunk };

export interface Message {
  epoch: Epoch;
  payload: MessagePayload;
}

export interface SendResult {
  msg: Message;
  key: EpochSecret | null;
  state: States;
}

export interface RecvResult {
  key: EpochSecret | null;
  state: States;
}

// ---------------------------------------------------------------------------
// States discriminated union
// ---------------------------------------------------------------------------

export type States =
  | { tag: 'keysUnsampled'; state: sendEk.KeysUnsampled }
  | { tag: 'keysSampled'; state: sendEk.KeysSampled }
  | { tag: 'headerSent'; state: sendEk.HeaderSent }
  | { tag: 'ct1Received'; state: sendEk.Ct1Received }
  | { tag: 'ekSentCt1Received'; state: sendEk.EkSentCt1Received }
  | { tag: 'noHeaderReceived'; state: sendCt.NoHeaderReceived }
  | { tag: 'headerReceived'; state: sendCt.HeaderReceived }
  | { tag: 'ct1Sampled'; state: sendCt.Ct1Sampled }
  | { tag: 'ekReceivedCt1Sampled'; state: sendCt.EkReceivedCt1Sampled }
  | { tag: 'ct1Acknowledged'; state: sendCt.Ct1Acknowledged }
  | { tag: 'ct2Sampled'; state: sendCt.Ct2Sampled };

// ---------------------------------------------------------------------------
// Epoch accessor
// ---------------------------------------------------------------------------

function getEpoch(s: States): Epoch {
  return s.state.epoch;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize Alice (send_ek side) at epoch 1.
 */
export function initA(authKey: Uint8Array): States {
  const auth = Authenticator.create(authKey, 1n);
  const ucState = new unchunked.KeysUnsampled(1n, auth);
  return {
    tag: 'keysUnsampled',
    state: new sendEk.KeysUnsampled(ucState),
  };
}

/**
 * Initialize Bob (send_ct side) at epoch 1.
 */
export function initB(authKey: Uint8Array): States {
  return {
    tag: 'noHeaderReceived',
    state: sendCt.NoHeaderReceived.create(authKey),
  };
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/**
 * Produce the next outgoing message from the current state.
 */
export function send(current: States, rng: RandomBytes): SendResult {
  const epoch = getEpoch(current);

  switch (current.tag) {
    case 'keysUnsampled': {
      const [next, chunk] = current.state.sendHdrChunk(rng);
      return {
        msg: { epoch, payload: { type: 'hdr', chunk } },
        key: null,
        state: { tag: 'keysSampled', state: next },
      };
    }

    case 'keysSampled': {
      const [next, chunk] = current.state.sendHdrChunk();
      return {
        msg: { epoch, payload: { type: 'hdr', chunk } },
        key: null,
        state: { tag: 'keysSampled', state: next },
      };
    }

    case 'headerSent': {
      const [next, chunk] = current.state.sendEkChunk();
      return {
        msg: { epoch, payload: { type: 'ek', chunk } },
        key: null,
        state: { tag: 'headerSent', state: next },
      };
    }

    case 'ct1Received': {
      const [next, chunk] = current.state.sendEkChunk();
      return {
        msg: { epoch, payload: { type: 'ekCt1Ack', chunk } },
        key: null,
        state: { tag: 'ct1Received', state: next },
      };
    }

    case 'ekSentCt1Received': {
      return {
        msg: { epoch, payload: { type: 'ct1Ack' } },
        key: null,
        state: current,
      };
    }

    case 'noHeaderReceived': {
      return {
        msg: { epoch, payload: { type: 'none' } },
        key: null,
        state: current,
      };
    }

    case 'headerReceived': {
      const [next, chunk, epochSecret] = current.state.sendCt1Chunk(rng);
      return {
        msg: { epoch, payload: { type: 'ct1', chunk } },
        key: epochSecret,
        state: { tag: 'ct1Sampled', state: next },
      };
    }

    case 'ct1Sampled': {
      const [next, chunk] = current.state.sendCt1Chunk();
      return {
        msg: { epoch, payload: { type: 'ct1', chunk } },
        key: null,
        state: { tag: 'ct1Sampled', state: next },
      };
    }

    case 'ekReceivedCt1Sampled': {
      const [next, chunk] = current.state.sendCt1Chunk();
      return {
        msg: { epoch, payload: { type: 'ct1', chunk } },
        key: null,
        state: { tag: 'ekReceivedCt1Sampled', state: next },
      };
    }

    case 'ct1Acknowledged': {
      return {
        msg: { epoch, payload: { type: 'none' } },
        key: null,
        state: current,
      };
    }

    case 'ct2Sampled': {
      const [next, chunk] = current.state.sendCt2Chunk();
      return {
        msg: { epoch, payload: { type: 'ct2', chunk } },
        key: null,
        state: { tag: 'ct2Sampled', state: next },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Recv
// ---------------------------------------------------------------------------

/**
 * Process an incoming message and transition the state.
 */
export function recv(current: States, msg: Message): RecvResult {
  const stateEpoch = getEpoch(current);

  // Handle epoch mismatch: messages from the past are ignored
  if (msg.epoch < stateEpoch) {
    // Special case: ct2Sampled can accept messages for the next epoch
    if (current.tag === 'ct2Sampled' && msg.epoch === stateEpoch) {
      // fall through to normal processing
    } else {
      return { key: null, state: current };
    }
  }

  // Messages from the future are an error (except ct2Sampled epoch+1)
  if (msg.epoch > stateEpoch) {
    if (current.tag === 'ct2Sampled' && msg.epoch === stateEpoch + 1n) {
      // Next epoch -- transition to send_ek
      const next = current.state.recvNextEpoch(msg.epoch);
      // Recursively process the message in the new state
      return recv({ tag: 'keysUnsampled', state: next }, msg);
    }
    throw new SpqrError(
      `Epoch too far ahead: state=${stateEpoch}, msg=${msg.epoch}`,
      SpqrErrorCode.EpochOutOfRange,
    );
  }

  // msg.epoch === stateEpoch -- process the payload
  const payload = msg.payload;

  switch (current.tag) {
    case 'keysUnsampled': {
      // Waiting to send -- nothing to receive
      return { key: null, state: current };
    }

    case 'keysSampled': {
      if (payload.type === 'ct1') {
        const next = current.state.recvCt1Chunk(msg.epoch, payload.chunk);
        return { key: null, state: { tag: 'headerSent', state: next } };
      }
      return { key: null, state: current };
    }

    case 'headerSent': {
      if (payload.type === 'ct1') {
        const result = current.state.recvCt1Chunk(msg.epoch, payload.chunk);
        if (result.done) {
          return {
            key: null,
            state: { tag: 'ct1Received', state: result.state },
          };
        }
        return {
          key: null,
          state: { tag: 'headerSent', state: result.state },
        };
      }
      return { key: null, state: current };
    }

    case 'ct1Received': {
      if (payload.type === 'ct2') {
        const next = current.state.recvCt2Chunk(msg.epoch, payload.chunk);
        return {
          key: null,
          state: { tag: 'ekSentCt1Received', state: next },
        };
      }
      return { key: null, state: current };
    }

    case 'ekSentCt1Received': {
      if (payload.type === 'ct2') {
        const result = current.state.recvCt2Chunk(msg.epoch, payload.chunk);
        if (result.done) {
          return {
            key: result.epochSecret,
            state: { tag: 'noHeaderReceived', state: result.state },
          };
        }
        return {
          key: null,
          state: { tag: 'ekSentCt1Received', state: result.state },
        };
      }
      return { key: null, state: current };
    }

    case 'noHeaderReceived': {
      if (payload.type === 'hdr') {
        const result = current.state.recvHdrChunk(msg.epoch, payload.chunk);
        if (result.done) {
          return {
            key: null,
            state: { tag: 'headerReceived', state: result.state },
          };
        }
        return {
          key: null,
          state: { tag: 'noHeaderReceived', state: result.state },
        };
      }
      return { key: null, state: current };
    }

    case 'headerReceived': {
      // Waiting to send ct1 -- nothing to receive in this state
      return { key: null, state: current };
    }

    case 'ct1Sampled': {
      if (payload.type === 'ek') {
        const result = current.state.recvEkChunk(
          msg.epoch,
          payload.chunk,
          false,
        );
        return mapCt1SampledResult(result);
      }
      if (payload.type === 'ekCt1Ack') {
        const result = current.state.recvEkChunk(
          msg.epoch,
          payload.chunk,
          true,
        );
        return mapCt1SampledResult(result);
      }
      return { key: null, state: current };
    }

    case 'ekReceivedCt1Sampled': {
      if (payload.type === 'ct1Ack' || payload.type === 'ekCt1Ack') {
        const next = current.state.recvCt1Ack(msg.epoch);
        return {
          key: null,
          state: { tag: 'ct2Sampled', state: next },
        };
      }
      return { key: null, state: current };
    }

    case 'ct1Acknowledged': {
      if (payload.type === 'ek' || payload.type === 'ekCt1Ack') {
        const chunk =
          payload.type === 'ek' ? payload.chunk : payload.chunk;
        const result = current.state.recvEkChunk(msg.epoch, chunk);
        if (result.done) {
          return {
            key: result.epochSecret,
            state: { tag: 'ct2Sampled', state: result.state },
          };
        }
        return {
          key: null,
          state: { tag: 'ct1Acknowledged', state: result.state },
        };
      }
      return { key: null, state: current };
    }

    case 'ct2Sampled': {
      // If we receive a message for the current epoch, nothing to do
      // (next epoch handled above)
      return { key: null, state: current };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCt1SampledResult(result: sendCt.Ct1SampledRecvChunk): RecvResult {
  switch (result.tag) {
    case 'done':
      return {
        key: result.epochSecret,
        state: { tag: 'ct2Sampled', state: result.state },
      };
    case 'stillSending':
      return {
        key: result.epochSecret,
        state: { tag: 'ekReceivedCt1Sampled', state: result.state },
      };
    case 'stillReceiving':
      return {
        key: null,
        state: { tag: 'ct1Acknowledged', state: result.state },
      };
    case 'stillReceivingStillSending':
      return {
        key: null,
        state: { tag: 'ct1Sampled', state: result.state },
      };
  }
}
