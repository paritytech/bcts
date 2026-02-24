/**
 * SPQR Adapter -- thin compatibility layer wrapping @bcts/spqr.
 *
 * This module re-exports the standalone @bcts/spqr package with the
 * function signatures expected by session-state.ts and the public
 * index.ts re-exports. In particular:
 *
 *  - spqrSend(state) wraps send(state, rng) using a default RNG
 *  - spqrRecv(state, msg) is a direct pass-through to recv()
 *  - Types are re-exported with their legacy names (SpqrParams, etc.)
 *
 * @deprecated The embedded SPQR at ./spqr/ is retained for backward
 * compatibility but should not be used for new code.
 */

import {
  send,
  recv,
  initialState as spqrInitialState,
  emptyState as spqrEmptyState,
  currentVersion as spqrCurrentVersion,
  Version,
  Direction,
  SpqrError,
  SpqrErrorCode,
} from '@bcts/spqr';
import type {
  Params,
  Send,
  Recv,
  CurrentVersion,
  SerializedState,
  SerializedMessage,
  RandomBytes,
  ChainParams,
} from '@bcts/spqr';

// ---------------------------------------------------------------------------
// Default RNG (Web Crypto API -- available in Node 19+, Bun, all browsers)
// ---------------------------------------------------------------------------

const defaultRng: RandomBytes = (len: number): Uint8Array => {
  const buf = new Uint8Array(len);
  globalThis.crypto.getRandomValues(buf);
  return buf;
};

// ---------------------------------------------------------------------------
// Legacy type aliases (for backward-compatible re-exports from index.ts)
// ---------------------------------------------------------------------------

export type SpqrParams = Params;
export type SpqrSendResult = Send;
export type SpqrRecvResult = Recv;
export type SpqrCurrentVersion = CurrentVersion;
export type SpqrChainParams = ChainParams;
export type SpqrRandomBytes = RandomBytes;

// ---------------------------------------------------------------------------
// Wrapped functions
// ---------------------------------------------------------------------------

/**
 * spqrSend -- wraps @bcts/spqr send() with the default RNG.
 *
 * The standalone package requires an explicit `rng` parameter; this adapter
 * provides a default using globalThis.crypto.getRandomValues().
 */
export function spqrSend(state: SerializedState): Send {
  return send(state, defaultRng);
}

/**
 * spqrRecv -- direct pass-through to @bcts/spqr recv().
 */
export function spqrRecv(state: SerializedState, msg: SerializedMessage): Recv {
  return recv(state, msg);
}

// ---------------------------------------------------------------------------
// Re-exports (unchanged API surface)
// ---------------------------------------------------------------------------

export {
  spqrInitialState as initialState,
  spqrEmptyState as emptyState,
  spqrCurrentVersion as currentVersion,
  Version,
  Direction,
  SpqrError,
  SpqrErrorCode,
};
export type { Params, Send, Recv, CurrentVersion, SerializedState, SerializedMessage, RandomBytes, ChainParams };

/**
 * Default chain parameters matching Rust DEFAULT_CHAIN_PARAMS.
 * Re-exported here so that the ratchet's public API can continue to
 * expose SPQR_DEFAULT_CHAIN_PARAMS without depending on @bcts/spqr internals.
 */
export const DEFAULT_CHAIN_PARAMS: ChainParams = {
  maxJump: 25_000,
  maxOooKeys: 2_000,
};
