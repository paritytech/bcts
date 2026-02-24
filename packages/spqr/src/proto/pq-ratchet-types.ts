/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * TypeScript interfaces matching pq_ratchet.proto exactly.
 *
 * NOTE: All optional properties use `| undefined` to satisfy
 * `exactOptionalPropertyTypes: true` in tsconfig.
 */

/** PqRatchetState - top level state (proto field numbers in comments) */
export interface PbPqRatchetState {
  versionNegotiation?: PbVersionNegotiation | undefined; // field 1
  chain?: PbChain | undefined; // field 2
  v1?: PbV1State | undefined; // field 3 (oneof inner)
}

export interface PbVersionNegotiation {
  authKey: Uint8Array; // field 1
  direction: number; // field 2 (Direction enum)
  minVersion: number; // field 3 (Version enum)
  chainParams?: PbChainParams | undefined; // field 4
}

export interface PbChainParams {
  maxJump: number; // field 1 (uint32)
  maxOooKeys: number; // field 2 (uint32)
}

export interface PbChain {
  direction: number; // field 1 (Direction enum)
  currentEpoch: bigint; // field 2 (uint64)
  links: PbEpoch[]; // field 3 (repeated)
  nextRoot: Uint8Array; // field 4
  sendEpoch: bigint; // field 5 (uint64)
  params?: PbChainParams | undefined; // field 6
}

export interface PbEpoch {
  send?: PbEpochDirection | undefined; // field 1
  recv?: PbEpochDirection | undefined; // field 2
}

export interface PbEpochDirection {
  ctr: number; // field 1 (uint32)
  next: Uint8Array; // field 2 (bytes)
  prev: Uint8Array; // field 3 (bytes)
}

export interface PbAuthenticator {
  rootKey: Uint8Array; // field 1
  macKey: Uint8Array; // field 2
}

export interface PbPolynomialEncoder {
  idx: number; // field 1 (uint32)
  pts: Uint8Array[]; // field 2 (repeated bytes)
  polys: Uint8Array[]; // field 3 (repeated bytes)
}

export interface PbPolynomialDecoder {
  ptsNeeded: number; // field 1 (uint32)
  polys: number; // field 2 (uint32, always 16)
  pts: Uint8Array[]; // field 3 (repeated bytes)
  isComplete: boolean; // field 4 (bool)
}

/** V1Msg - wire message format */
export interface PbV1Msg {
  epoch: bigint; // field 1 (uint64)
  index: number; // field 2 (uint32)
  innerMsg?: PbV1MsgInner | undefined;
}

export type PbV1MsgInner =
  | { type: "hdr"; chunk: PbChunk } // field 3
  | { type: "ek"; chunk: PbChunk } // field 4
  | { type: "ekCt1Ack"; chunk: PbChunk } // field 5
  | { type: "ct1Ack"; value: boolean } // field 6
  | { type: "ct1"; chunk: PbChunk } // field 7
  | { type: "ct2"; chunk: PbChunk }; // field 8

export interface PbChunk {
  index: number; // field 1 (uint32)
  data: Uint8Array; // field 2 (bytes, 32 bytes)
}

// V1State contains the oneof with 11 chunked states
export interface PbV1State {
  innerState?: PbChunkedState | undefined;
  /** Epoch of the current state (field 12 in proto, used for deserialization) */
  epoch?: bigint | undefined;
}

export type PbChunkedState =
  // Send_EK states (fields 1-5 in V1State.Chunked)
  | { type: "keysUnsampled"; uc: PbUnchunkedKeysUnsampled }
  | { type: "keysSampled"; uc: PbUnchunkedKeysSampled; sendingHdr: PbPolynomialEncoder }
  | {
      type: "headerSent";
      uc: PbUnchunkedHeaderSent;
      sendingEk: PbPolynomialEncoder;
      receivingCt1: PbPolynomialDecoder;
    }
  | { type: "ct1Received"; uc: PbUnchunkedCt1Received; sendingEk: PbPolynomialEncoder }
  | {
      type: "ekSentCt1Received";
      uc: PbUnchunkedEkSentCt1Received;
      receivingCt2: PbPolynomialDecoder;
    }
  // Send_CT states (fields 6-11 in V1State.Chunked)
  | { type: "noHeaderReceived"; uc: PbUnchunkedNoHeaderReceived; receivingHdr: PbPolynomialDecoder }
  | { type: "headerReceived"; uc: PbUnchunkedHeaderReceived; receivingEk: PbPolynomialDecoder }
  | {
      type: "ct1Sampled";
      uc: PbUnchunkedCt1Sampled;
      sendingCt1: PbPolynomialEncoder;
      receivingEk: PbPolynomialDecoder;
    }
  | {
      type: "ekReceivedCt1Sampled";
      uc: PbUnchunkedEkReceivedCt1Sampled;
      sendingCt1: PbPolynomialEncoder;
    }
  | { type: "ct1Acknowledged"; uc: PbUnchunkedCt1Acknowledged; receivingEk: PbPolynomialDecoder }
  | { type: "ct2Sampled"; uc: PbUnchunkedCt2Sampled; sendingCt2: PbPolynomialEncoder };

// Unchunked state data (carry actual KEM keys/ciphertexts)
export interface PbUnchunkedKeysUnsampled {
  auth?: PbAuthenticator | undefined;
}

export interface PbUnchunkedKeysSampled {
  auth?: PbAuthenticator | undefined;
  ek: Uint8Array;
  dk: Uint8Array;
  hdr: Uint8Array;
  hdrMac: Uint8Array;
}

export interface PbUnchunkedHeaderSent {
  auth?: PbAuthenticator | undefined;
  ek: Uint8Array;
  dk: Uint8Array;
}

export interface PbUnchunkedCt1Received {
  auth?: PbAuthenticator | undefined;
  dk: Uint8Array;
  ct1: Uint8Array;
}

export interface PbUnchunkedEkSentCt1Received {
  auth?: PbAuthenticator | undefined;
  dk: Uint8Array;
  ct1: Uint8Array;
}

export interface PbUnchunkedNoHeaderReceived {
  auth?: PbAuthenticator | undefined;
}

export interface PbUnchunkedHeaderReceived {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ct1: Uint8Array;
  ss: Uint8Array;
}

export interface PbUnchunkedCt1Sampled {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ct1: Uint8Array;
}

export interface PbUnchunkedEkReceivedCt1Sampled {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ek: Uint8Array;
  ct1: Uint8Array;
}

export interface PbUnchunkedCt1Acknowledged {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ct1: Uint8Array;
}

export interface PbUnchunkedCt2Sampled {
  auth?: PbAuthenticator | undefined;
}
