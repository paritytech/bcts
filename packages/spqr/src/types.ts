/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Shared types for the SPQR protocol.
 */

/** Epoch identifier (u64 in Rust, bigint in TypeScript) */
export type Epoch = bigint;

/** Secret key material (32 bytes) */
export type Secret = Uint8Array;

/** Message key output from send/recv */
export type MessageKey = Uint8Array | null;

/** Opaque serialized state (protobuf bytes) */
export type SerializedState = Uint8Array;

/** Opaque serialized message (protobuf V1Msg bytes) */
export type SerializedMessage = Uint8Array;

/** Interface for random byte generation */
export interface RandomBytes {
  (length: number): Uint8Array;
}

/** Result of send() */
export interface Send {
  state: SerializedState;
  msg: SerializedMessage;
  key: Secret | null;
}

/** Result of recv() */
export interface Recv {
  state: SerializedState;
  key: Secret | null;
}

/** Epoch secret output from state machine */
export interface EpochSecret {
  epoch: Epoch;
  secret: Secret;
}

/** Parameters for initializing SPQR */
export interface Params {
  direction: Direction;
  version: Version;
  minVersion: Version;
  authKey: Uint8Array;
  chainParams: ChainParams;
}

/** Chain configuration parameters */
export interface ChainParams {
  maxJump: number;
  maxOooKeys: number;
}

/** Protocol version */
export enum Version {
  V0 = 0,
  V1 = 1,
}

/** Communication direction */
export enum Direction {
  A2B = 0,
  B2A = 1,
}

/** Current version negotiation status */
export type CurrentVersion =
  | { type: 'still_negotiating'; version: Version; minVersion: Version }
  | { type: 'negotiation_complete'; version: Version };

/** Internal secret output from state transitions */
export type SecretOutput =
  | { type: 'none' }
  | { type: 'send'; secret: Secret }
  | { type: 'recv'; secret: Secret };
