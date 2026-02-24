/**
 * Copyright © 2025 Signal Messenger, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Top-level public API for the SPQR protocol.
 *
 * Matches Signal's Rust `lib.rs` interface. All state is serialized as
 * opaque protobuf bytes (Uint8Array) so that callers never need to touch
 * internal types.
 *
 * Exported functions:
 *   - emptyState()      -> empty serialized state (V0)
 *   - initialState(p)   -> create initial serialized state
 *   - send(state, rng)  -> produce next message + advance state
 *   - recv(state, msg)  -> consume incoming message + advance state
 *   - currentVersion(s) -> inspect version negotiation status
 */

import {
  type States,
  initA,
  initB,
  send as chunkedSend,
  recv as chunkedRecv,
} from "./v1/chunked/index.js";
import { serializeMessage, deserializeMessage } from "./v1/chunked/message.js";
import { statesToPb, statesFromPb } from "./v1/chunked/serialize.js";
import { Chain } from "./chain.js";
import { encodePqRatchetState, decodePqRatchetState } from "./proto/index.js";
import type { PbPqRatchetState, PbVersionNegotiation } from "./proto/pq-ratchet-types.js";
import { SpqrError, SpqrErrorCode } from "./error.js";
import {
  Version,
  Direction,
  type Params,
  type Send,
  type Recv,
  type CurrentVersion,
  type SerializedState,
  type SerializedMessage,
  type RandomBytes,
  type ChainParams,
} from "./types.js";

// Re-export public types
export {
  Version,
  Direction,
  type Params,
  type Send,
  type Recv,
  type CurrentVersion,
  type SerializedState,
  type SerializedMessage,
  type RandomBytes,
  type ChainParams,
};
export { SpqrError, SpqrErrorCode } from "./error.js";

// ---------------------------------------------------------------------------
// emptyState
// ---------------------------------------------------------------------------

/**
 * Return an empty (V0) serialized state.
 */
export function emptyState(): SerializedState {
  return new Uint8Array(0);
}

// ---------------------------------------------------------------------------
// initialState
// ---------------------------------------------------------------------------

/**
 * Create an initial serialized state from parameters.
 *
 * For V0, returns an empty state. For V1+, initializes the inner V1
 * state machine and version negotiation.
 */
export function initialState(params: Params): SerializedState {
  if (params.version === Version.V0) {
    return emptyState();
  }

  // Initialize the V1 inner state
  const inner = initInner(params.version, params.direction, params.authKey);

  // Build version negotiation
  const versionNegotiation: PbVersionNegotiation = {
    authKey: Uint8Array.from(params.authKey),
    direction: params.direction,
    minVersion: params.minVersion,
    chainParams: {
      maxJump: params.chainParams.maxJump,
      maxOooKeys: params.chainParams.maxOooKeys,
    },
  };

  const pbState: PbPqRatchetState = {
    versionNegotiation,
    chain: undefined,
    v1: inner,
  };

  return encodePqRatchetState(pbState);
}

// ---------------------------------------------------------------------------
// send
// ---------------------------------------------------------------------------

/**
 * Produce the next outgoing message from the current state.
 *
 * Returns the updated state, serialized message, and optional message key.
 */
export function send(state: SerializedState, rng: RandomBytes): Send {
  // V0: empty state passthrough
  if (state.length === 0) {
    return { state: new Uint8Array(0), msg: new Uint8Array(0), key: null };
  }

  const statePb = decodePqRatchetState(state);

  if (statePb.v1 === undefined) {
    // No V1 inner => V0
    return { state: new Uint8Array(0), msg: new Uint8Array(0), key: null };
  }

  // Deserialize runtime states from protobuf
  const runtimeStates = statesFromPb(statePb.v1);

  // Execute the chunked send
  const sendResult = chunkedSend(runtimeStates, rng);

  // Get or create chain
  let chain: Chain | undefined;
  if (statePb.chain !== undefined) {
    chain = Chain.fromProto(statePb.chain);
  } else if (statePb.versionNegotiation !== undefined) {
    const vn = statePb.versionNegotiation;
    if ((vn.minVersion as Version) > Version.V0) {
      chain = chainFromVersionNegotiation(vn);
    }
  } else {
    throw new SpqrError(
      "Chain not available and no version negotiation",
      SpqrErrorCode.ChainNotAvailable,
    );
  }

  let index = 0;
  let msgKey: Uint8Array = new Uint8Array(0);
  let chainPb = statePb.chain;

  if (chain === undefined) {
    // No chain (min_version === V0, still negotiating)
    if (sendResult.key !== null) {
      // Should not happen in V0 min_version case during negotiation
      throw new SpqrError("Unexpected epoch secret without chain", SpqrErrorCode.ChainNotAvailable);
    }
    index = 0;
    msgKey = new Uint8Array(0);
    chainPb = undefined;
  } else {
    if (sendResult.key !== null) {
      // Epoch secret epoch matches chain expectation:
      // state machine epoch N maps directly to chain addEpoch(N)
      // since chain.currentEpoch starts at 0 and expects N = currentEpoch + 1
      chain.addEpoch(sendResult.key);
    }
    const msgEpoch = sendResult.msg.epoch - 1n;
    const [sendIndex, sendKey] = chain.sendKey(msgEpoch);
    index = sendIndex;
    msgKey = sendKey;
    chainPb = chain.toProto();
  }

  // Serialize message
  const serializedMsg = serializeMessage(sendResult.msg, index);

  // Serialize updated state
  const v1Pb = statesToPb(sendResult.state);
  const newStatePb: PbPqRatchetState = {
    versionNegotiation: statePb.versionNegotiation, // preserved on send
    chain: chainPb,
    v1: v1Pb,
  };

  return {
    state: encodePqRatchetState(newStatePb),
    msg: serializedMsg,
    key: msgKey.length === 0 ? null : msgKey,
  };
}

// ---------------------------------------------------------------------------
// recv
// ---------------------------------------------------------------------------

/**
 * Process an incoming message and transition the state.
 *
 * Returns the updated state and optional message key.
 */
export function recv(state: SerializedState, msg: SerializedMessage): Recv {
  // V0: empty state passthrough
  if (state.length === 0 && msg.length === 0) {
    return { state: new Uint8Array(0), key: null };
  }

  // Decode the pre-negotiated state
  const prenegotiatedPb =
    state.length === 0
      ? ({ v1: undefined, chain: undefined, versionNegotiation: undefined } as PbPqRatchetState)
      : decodePqRatchetState(state);

  // Determine message version
  const msgVer = msgVersion(msg);
  if (msgVer === undefined) {
    // Unknown version, ignore the message
    return { state: Uint8Array.from(state), key: null };
  }

  const stateVer = stateVersion(prenegotiatedPb);

  // Version negotiation
  let statePb: PbPqRatchetState;
  if (msgVer >= stateVer) {
    // Equal or greater version -- proceed with current state
    statePb = prenegotiatedPb;
  } else {
    // Message version < state version -- negotiate down
    const vn = prenegotiatedPb.versionNegotiation;
    if (vn === undefined) {
      throw new SpqrError(
        `Version mismatch: state=${stateVer}, msg=${msgVer}, no negotiation available`,
        SpqrErrorCode.VersionMismatch,
      );
    }
    if (msgVer < (vn.minVersion as Version)) {
      throw new SpqrError(
        `Minimum version not met: min=${vn.minVersion}, msg=${msgVer}`,
        SpqrErrorCode.MinimumVersion,
      );
    }

    // Negotiate down to the message version
    const inner = initInner(
      msgVer,
      vn.direction as Direction,
      Uint8Array.from(vn.authKey),
    );
    const chainResult = chainFrom(prenegotiatedPb.chain, vn);
    statePb = {
      v1: inner,
      versionNegotiation: undefined, // disallow further negotiation
      chain: chainResult,
    };
  }

  // Process the message
  if (statePb.v1 === undefined) {
    // V0 state
    return { state: new Uint8Array(0), key: null };
  }

  // Deserialize the message
  const { msg: sckaMsg, index } = deserializeMessage(msg);

  // Deserialize runtime states from protobuf
  const runtimeStates = statesFromPb(statePb.v1);

  // Execute the chunked recv
  const recvResult = chunkedRecv(runtimeStates, sckaMsg);

  // Chain key derivation
  const msgKeyEpoch = sckaMsg.epoch - 1n;
  const chainObj = chainFromState(statePb.chain, statePb.versionNegotiation);

  if (recvResult.key !== null) {
    // Epoch secret epoch matches chain expectation directly
    chainObj.addEpoch(recvResult.key);
  }

  let msgKey: Uint8Array;
  if (msgKeyEpoch === 0n && index === 0) {
    // First message has no chain key
    msgKey = new Uint8Array(0);
  } else {
    msgKey = chainObj.recvKey(msgKeyEpoch, index);
  }

  // Serialize the updated state
  const v1Pb = statesToPb(recvResult.state);
  const newStatePb: PbPqRatchetState = {
    versionNegotiation: undefined, // cleared on recv
    chain: chainObj.toProto(),
    v1: v1Pb,
  };

  return {
    state: encodePqRatchetState(newStatePb),
    key: msgKey.length === 0 ? null : msgKey,
  };
}

// ---------------------------------------------------------------------------
// currentVersion
// ---------------------------------------------------------------------------

/**
 * Inspect the current version negotiation status of a serialized state.
 */
export function currentVersion(state: SerializedState): CurrentVersion {
  if (state.length === 0) {
    return { type: "negotiation_complete", version: Version.V0 };
  }

  const statePb = decodePqRatchetState(state);
  const version = statePb.v1 !== undefined ? Version.V1 : Version.V0;

  if (statePb.versionNegotiation !== undefined) {
    return {
      type: "still_negotiating",
      version,
      minVersion: statePb.versionNegotiation.minVersion as Version,
    };
  }
  return { type: "negotiation_complete", version };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Initialize the V1 inner state based on version and direction.
 */
function initInner(
  version: Version,
  direction: Direction,
  authKey: Uint8Array,
): PbPqRatchetState["v1"] {
  if (version === Version.V0) {
    return undefined;
  }

  // V1
  let states: States;
  if (direction === Direction.A2B) {
    states = initA(authKey);
  } else {
    states = initB(authKey);
  }
  return statesToPb(states);
}

/**
 * Extract version from a serialized message.
 * Empty msg -> V0. msg[0]: 0 -> V0, 1 -> V1, else undefined.
 */
function msgVersion(msg: SerializedMessage): Version | undefined {
  if (msg.length === 0) return Version.V0;
  const v = msg[0];
  if (v === 0) return Version.V0;
  if (v === 1) return Version.V1;
  return undefined;
}

/**
 * Extract version from the decoded state.
 * No v1 inner -> V0. Has v1 inner -> V1.
 */
function stateVersion(state: PbPqRatchetState): Version {
  return state.v1 !== undefined ? Version.V1 : Version.V0;
}

/**
 * Create a Chain from version negotiation parameters.
 */
function chainFromVersionNegotiation(vn: PbVersionNegotiation): Chain {
  const chainParams: ChainParams = vn.chainParams ?? {
    maxJump: 25000,
    maxOooKeys: 2000,
  };
  return Chain.create(Uint8Array.from(vn.authKey), vn.direction as Direction, chainParams);
}

/**
 * Get or create a Chain from the existing chain proto and version negotiation.
 * Prefers existing chain, falls back to creating from version negotiation.
 */
function chainFrom(
  chainPb: PbPqRatchetState["chain"],
  vn: PbVersionNegotiation | undefined,
): PbPqRatchetState["chain"] {
  if (chainPb !== undefined) return chainPb;
  if (vn !== undefined) return chainFromVersionNegotiation(vn).toProto();
  return undefined;
}

/**
 * Get a Chain object from state, creating from vn if needed.
 */
function chainFromState(
  chainPb: PbPqRatchetState["chain"],
  vn: PbVersionNegotiation | undefined,
): Chain {
  if (chainPb !== undefined) return Chain.fromProto(chainPb);
  if (vn !== undefined) return chainFromVersionNegotiation(vn);
  throw new SpqrError(
    "Chain not available and no version negotiation",
    SpqrErrorCode.ChainNotAvailable,
  );
}
