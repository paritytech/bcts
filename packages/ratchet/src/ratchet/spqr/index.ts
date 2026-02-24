/**
 * SPQR (Sparse Post-Quantum Ratchet) — public API.
 *
 * This module provides the high-level API for the SPQR state machine,
 * matching libsignal's spqr crate public interface.
 *
 * Usage:
 *   1. Call initialState() to create the initial serialized state
 *   2. Call spqrSend() with the state to produce a message and optional key
 *   3. Call spqrRecv() with the state and received message to get a key
 *   4. Mix the key into the symmetric chain for PQ-resistant encryption
 *
 * Version negotiation:
 *   - V0: disabled (empty state, empty messages)
 *   - V1: full SPQR with ML-KEM-768
 */

import {
  initA,
  initB,
  send as stateSend,
  recv as stateRecv,
} from "./states.js";
import { serializeMessage, deserializeMessage } from "./message.js";
import {
  serializePqRatchetState,
  deserializePqRatchetState,
  type PqRatchetStateData,
  type VersionNegotiation,
  SpqrVersion,
} from "./serialize.js";
import {
  Chain,
  Direction,
  DEFAULT_CHAIN_PARAMS,
  type ChainParams,
  type EpochSecret,
} from "./chain.js";

// ---- Public types ----

export { Direction, DEFAULT_CHAIN_PARAMS, type ChainParams, type EpochSecret };
export { SpqrVersion };

export const enum Version {
  V0 = 0,
  V1 = 1,
}

export interface SpqrParams {
  direction: Direction;
  version: Version;
  minVersion: Version;
  authKey: Uint8Array;
  chainParams?: ChainParams;
}

export interface SpqrSendResult {
  state: Uint8Array;
  msg: Uint8Array;
  key: Uint8Array | null;
}

export interface SpqrRecvResult {
  state: Uint8Array;
  key: Uint8Array | null;
}

export interface SpqrCurrentVersion {
  type: "negotiating" | "complete";
  version: Version;
  minVersion?: Version;
}

// ---- Public API ----

/**
 * Create an empty (V0 disabled) state.
 */
export function emptyState(): Uint8Array {
  return new Uint8Array(0);
}

/**
 * Create the initial SPQR state.
 *
 * Matches Rust: spqr::initial_state(params)
 */
export function initialState(params: SpqrParams): Uint8Array {
  if (params.version === Version.V0) {
    return emptyState();
  }

  const chainParams = params.chainParams ?? DEFAULT_CHAIN_PARAMS;

  const inner =
    params.direction === Direction.A2B
      ? initA(params.authKey)
      : initB(params.authKey);

  const vn: VersionNegotiation = {
    authKey: Uint8Array.from(params.authKey),
    direction: params.direction,
    minVersion: params.minVersion as unknown as SpqrVersion,
    chainParams,
  };

  const data: PqRatchetStateData = {
    inner,
    chain: null,
    versionNegotiation: vn,
  };

  return serializePqRatchetState(data);
}

/**
 * Get the current version of a serialized state.
 */
export function currentVersion(state: Uint8Array): SpqrCurrentVersion {
  const data = decodeState(state);

  const version = data.inner ? Version.V1 : Version.V0;

  if (data.versionNegotiation) {
    return {
      type: "negotiating",
      version,
      minVersion: data.versionNegotiation.minVersion as unknown as Version,
    };
  }

  return { type: "complete", version };
}

/**
 * Perform a send operation on the SPQR state.
 *
 * Returns the updated state, a message to send, and an optional key.
 *
 * Matches Rust: spqr::send(state, rng)
 */
export function spqrSend(state: Uint8Array): SpqrSendResult {
  const data = decodeState(state);

  // V0: empty state = empty message, no key
  if (!data.inner) {
    return { state: new Uint8Array(0), msg: new Uint8Array(0), key: null };
  }

  // V1: delegate to state machine
  const sendResult = stateSend(data.inner);

  // Resolve chain
  let chain = resolveChain(data);
  let index = 0;
  let msgKey: Uint8Array = new Uint8Array(0);

  if (chain) {
    if (sendResult.key) {
      chain.addEpoch(sendResult.key);
    }
    const [idx, key] = chain.sendKey(sendResult.msg.epoch - 1);
    index = idx;
    msgKey = key;
  } else if (sendResult.key === null) {
    // No chain and no key: pre-negotiation
    index = 0;
    msgKey = new Uint8Array(0);
  }

  // Serialize message
  const msgBytes = serializeMessage(sendResult.msg, index);

  // Serialize updated state
  const newData: PqRatchetStateData = {
    inner: sendResult.state,
    chain: chain?.serialize() ?? null,
    // Sending never changes version negotiation
    versionNegotiation: data.versionNegotiation,
  };

  return {
    state: serializePqRatchetState(newData),
    msg: msgBytes,
    key: msgKey.length > 0 ? msgKey : null,
  };
}

/**
 * Perform a receive operation on the SPQR state.
 *
 * Returns the updated state and an optional key.
 *
 * Matches Rust: spqr::recv(state, msg)
 */
export function spqrRecv(
  state: Uint8Array,
  msg: Uint8Array,
): SpqrRecvResult {
  // Version negotiation
  const prenegotiatedData = decodeState(state);

  const msgVersion = getMsgVersion(msg);

  if (msgVersion === null) {
    // Unrecognized version -- ignore
    return { state, key: null };
  }

  let stateData: PqRatchetStateData;
  const stateVersion = prenegotiatedData.inner ? Version.V1 : Version.V0;

  if (msgVersion >= stateVersion) {
    // Equal or greater: proceed
    stateData = prenegotiatedData;
  } else {
    // Their version < ours. Try to negotiate down.
    if (!prenegotiatedData.versionNegotiation) {
      throw new SpqrError("Version mismatch after negotiation", "VERSION_MISMATCH");
    }
    const vn = prenegotiatedData.versionNegotiation;
    if (msgVersion < (vn.minVersion as unknown as number)) {
      throw new SpqrError("Minimum version not met", "MINIMUM_VERSION");
    }
    // Negotiate down
    const inner =
      msgVersion === Version.V0
        ? null
        : vn.direction === Direction.A2B
          ? initA(vn.authKey)
          : initB(vn.authKey);

    const chain = resolveChain(prenegotiatedData);

    stateData = {
      inner,
      chain: chain?.serialize() ?? null,
      versionNegotiation: null, // Disallow further negotiation
    };
  }

  // Process message
  if (!stateData.inner) {
    // V0
    return { state: new Uint8Array(0), key: null };
  }

  const { msg: sckaMsg, index } = deserializeMessage(msg);
  const recvResult = stateRecv(stateData.inner, sckaMsg);

  const msgKeyEpoch = sckaMsg.epoch - 1;
  let chain = resolveChainFromData(stateData);

  if (recvResult.key) {
    chain?.addEpoch(recvResult.key);
  }

  let msgKey: Uint8Array = new Uint8Array(0);
  if (msgKeyEpoch === 0 && index === 0) {
    msgKey = new Uint8Array(0);
  } else if (chain) {
    msgKey = chain.recvKey(msgKeyEpoch, index);
  }

  const newData: PqRatchetStateData = {
    inner: recvResult.state,
    chain: chain?.serialize() ?? null,
    // Receiving clears version negotiation
    versionNegotiation: null,
  };

  return {
    state: serializePqRatchetState(newData),
    key: msgKey.length > 0 ? msgKey : null,
  };
}

// ---- Error ----

export class SpqrError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SpqrError";
  }
}

// ---- Internal helpers ----

function decodeState(s: Uint8Array): PqRatchetStateData {
  if (s.length === 0) {
    return { inner: null, chain: null, versionNegotiation: null };
  }
  return deserializePqRatchetState(s);
}

function getMsgVersion(msg: Uint8Array): Version | null {
  if (msg.length === 0) return Version.V0;
  const v = msg[0];
  if (v === 0) return Version.V0;
  if (v === 1) return Version.V1;
  return null; // Unrecognized
}

function resolveChain(data: PqRatchetStateData): Chain | null {
  if (data.chain) {
    return Chain.deserialize(data.chain);
  }
  if (data.versionNegotiation) {
    const vn = data.versionNegotiation;
    if ((vn.minVersion as unknown as number) > Version.V0) {
      return Chain.create(vn.authKey, vn.direction, vn.chainParams);
    }
    return null;
  }
  return null;
}

function resolveChainFromData(data: PqRatchetStateData): Chain | null {
  if (data.chain) {
    return Chain.deserialize(data.chain);
  }
  if (data.versionNegotiation) {
    return Chain.create(
      data.versionNegotiation.authKey,
      data.versionNegotiation.direction,
      data.versionNegotiation.chainParams,
    );
  }
  return null;
}
