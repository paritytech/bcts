/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * SPQR Symmetric Chain -- epoch-based key derivation with forward/backward secrecy.
 *
 * Ported from Signal's spqr crate: chain.rs
 *
 * The Chain manages send/receive keys across epochs. Each epoch has two
 * directional chains (A2B and B2A). Keys are derived using HKDF-SHA256
 * with specific info strings that MUST match the Rust implementation
 * exactly (including the double space in "Chain  Start").
 */

import { hkdfSha256 } from './kdf.js';
import { concat, uint32ToBE4 } from './util.js';
import {
  ZERO_SALT,
  LABEL_CHAIN_START,
  LABEL_CHAIN_NEXT,
  LABEL_CHAIN_ADD_EPOCH,
  DEFAULT_MAX_JUMP,
  DEFAULT_MAX_OOO_KEYS,
  EPOCHS_TO_KEEP_PRIOR_TO_SEND_EPOCH,
  KEY_ENTRY_SIZE,
} from './constants.js';
import { SpqrError, SpqrErrorCode } from './error.js';
import type { Epoch, EpochSecret, ChainParams } from './types.js';
import type { Direction } from './types.js';
import type {
  PbChain,
  PbChainParams,
  PbEpoch,
  PbEpochDirection,
} from './proto/pq-ratchet-types.js';

// Re-export Direction from types
export { Direction } from './types.js';

// ---- Pre-encoded info labels ----
const enc = new TextEncoder();
const CHAIN_START_INFO = enc.encode(LABEL_CHAIN_START);
const CHAIN_NEXT_INFO = enc.encode(LABEL_CHAIN_NEXT);
const CHAIN_ADD_EPOCH_INFO = enc.encode(LABEL_CHAIN_ADD_EPOCH);

// ---- Helper functions ----

function resolveMaxJump(params: ChainParams): number {
  return params.maxJump > 0 ? params.maxJump : DEFAULT_MAX_JUMP;
}

function resolveMaxOooKeys(params: ChainParams): number {
  return params.maxOooKeys > 0 ? params.maxOooKeys : DEFAULT_MAX_OOO_KEYS;
}

function trimSize(params: ChainParams): number {
  const maxOoo = resolveMaxOooKeys(params);
  return Math.floor(maxOoo * 11 / 10) + 1;
}

function switchDirection(d: Direction): Direction {
  // Direction.A2B = 0, Direction.B2A = 1
  return d === 0 ? 1 : 0;
}

// ---- KeyHistory ----

/**
 * Stores out-of-order keys as packed [index_be32 (4 bytes)][key (32 bytes)] entries.
 * Matches Rust KeyHistory data layout exactly.
 */
class KeyHistory {
  data: Uint8Array;
  private length: number;

  constructor(data?: Uint8Array) {
    this.data = data ? Uint8Array.from(data) : new Uint8Array(0);
    this.length = this.data.length;
  }

  add(index: number, key: Uint8Array, _params: ChainParams): void {
    const entry = new Uint8Array(KEY_ENTRY_SIZE);
    const view = new DataView(entry.buffer);
    view.setUint32(0, index, false); // big-endian
    entry.set(key, 4);

    const newData = new Uint8Array(this.length + KEY_ENTRY_SIZE);
    newData.set(this.data.subarray(0, this.length));
    newData.set(entry, this.length);
    this.data = newData;
    this.length += KEY_ENTRY_SIZE;
  }

  gc(currentKey: number, params: ChainParams): void {
    const maxOoo = resolveMaxOooKeys(params);
    if (this.length >= trimSize(params) * KEY_ENTRY_SIZE) {
      if (currentKey < maxOoo) {
        throw new Error('KeyHistory.gc: currentKey < maxOooKeys (corrupted state)');
      }
      const trimHorizon = currentKey - maxOoo;

      let i = 0;
      while (i < this.length) {
        const view = new DataView(this.data.buffer, this.data.byteOffset + i, 4);
        const idx = view.getUint32(0, false);
        if (trimHorizon > idx) {
          this.removeAt(i);
          // Don't advance i -- replacement might also be old
        } else {
          i += KEY_ENTRY_SIZE;
        }
      }
    }
  }

  clear(): void {
    this.data = new Uint8Array(0);
    this.length = 0;
  }

  get(at: number, currentCtr: number, params: ChainParams): Uint8Array {
    const maxOoo = resolveMaxOooKeys(params);
    if (at + maxOoo < currentCtr) {
      throw new SpqrError(`Key trimmed: ${at}`, SpqrErrorCode.KeyTrimmed);
    }

    const want = new Uint8Array(4);
    new DataView(want.buffer).setUint32(0, at, false);

    for (let i = 0; i < this.length; i += KEY_ENTRY_SIZE) {
      if (
        this.data[i] === want[0] &&
        this.data[i + 1] === want[1] &&
        this.data[i + 2] === want[2] &&
        this.data[i + 3] === want[3]
      ) {
        const key = this.data.slice(i + 4, i + KEY_ENTRY_SIZE);
        this.removeAt(i);
        return key;
      }
    }

    throw new SpqrError(`Key already requested: ${at}`, SpqrErrorCode.KeyAlreadyRequested);
  }

  private removeAt(index: number): void {
    if (index + KEY_ENTRY_SIZE < this.length) {
      // Swap-remove: move last entry to this position
      const lastStart = this.length - KEY_ENTRY_SIZE;
      this.data.copyWithin(index, lastStart, this.length);
    }
    this.length -= KEY_ENTRY_SIZE;
  }

  /** Serialize to raw bytes for protobuf storage */
  serialize(): Uint8Array {
    return this.data.slice(0, this.length);
  }
}

// ---- ChainEpochDirection ----

/**
 * One directional chain within an epoch (send or recv).
 * Manages a ratcheting key derivation with HKDF.
 */
class ChainEpochDirection {
  ctr: number;
  next: Uint8Array;
  prev: KeyHistory;

  constructor(key: Uint8Array, ctr?: number, prev?: Uint8Array) {
    this.ctr = ctr ?? 0;
    this.next = Uint8Array.from(key);
    this.prev = new KeyHistory(prev);
  }

  /**
   * Derive the next key in the chain.
   * Returns [index, key].
   */
  nextKey(): [number, Uint8Array] {
    this.ctr += 1;

    const ctrBe = uint32ToBE4(this.ctr);
    const info = concat(ctrBe, CHAIN_NEXT_INFO);

    const gen = hkdfSha256(this.next, ZERO_SALT, info, 64);
    this.next = gen.slice(0, 32);
    const key = gen.slice(32, 64);

    return [this.ctr, key];
  }

  /**
   * Internal: derive next key without consuming it publicly.
   * Used for skipping ahead to build out-of-order key history.
   */
  private static nextKeyInternal(
    next: Uint8Array,
    ctr: number,
  ): { next: Uint8Array; ctr: number; index: number; key: Uint8Array } {
    ctr += 1;

    const ctrBe = uint32ToBE4(ctr);
    const info = concat(ctrBe, CHAIN_NEXT_INFO);

    const gen = hkdfSha256(next, ZERO_SALT, info, 64);

    return {
      next: gen.slice(0, 32),
      ctr,
      index: ctr,
      key: gen.slice(32, 64),
    };
  }

  /**
   * Get the key at a specific counter position.
   * Supports out-of-order access via KeyHistory.
   */
  key(at: number, params: ChainParams): Uint8Array {
    const maxJump = resolveMaxJump(params);
    const maxOoo = resolveMaxOooKeys(params);

    if (at > this.ctr) {
      if (at - this.ctr > maxJump) {
        throw new SpqrError(`Key jump: ${this.ctr} - ${at}`, SpqrErrorCode.KeyJump);
      }
    } else if (at < this.ctr) {
      return this.prev.get(at, this.ctr, params);
    } else {
      // at === this.ctr: already returned
      throw new SpqrError(`Key already requested: ${at}`, SpqrErrorCode.KeyAlreadyRequested);
    }

    if (at > this.ctr + maxOoo) {
      // About to make all currently-held keys obsolete
      this.prev.clear();
    }

    while (at > this.ctr + 1) {
      const result = ChainEpochDirection.nextKeyInternal(this.next, this.ctr);
      this.next = result.next;
      this.ctr = result.ctr;
      // Only add keys into history if we're not going to immediately GC them
      if (this.ctr + maxOoo >= at) {
        this.prev.add(result.index, result.key, params);
      }
    }

    // GC after potentially adding new keys
    this.prev.gc(this.ctr, params);

    // Get the requested key
    const result = ChainEpochDirection.nextKeyInternal(this.next, this.ctr);
    this.next = result.next;
    this.ctr = result.ctr;
    return result.key;
  }

  clearNext(): void {
    this.next = new Uint8Array(0);
  }

  /** Serialize to protobuf EpochDirection */
  toProto(): PbEpochDirection {
    return {
      ctr: this.ctr,
      next: Uint8Array.from(this.next),
      prev: this.prev.serialize(),
    };
  }

  static fromProto(pb: PbEpochDirection): ChainEpochDirection {
    return new ChainEpochDirection(pb.next, pb.ctr, pb.prev);
  }
}

// ---- ChainEpoch ----

interface ChainEpoch {
  send: ChainEpochDirection;
  recv: ChainEpochDirection;
}

// ---- Chain ----

/**
 * The main Chain manages send/receive keys across all epochs.
 *
 * Port of Rust's Chain struct from chain.rs.
 * Uses bigint for epoch values (matching Rust u64).
 */
export class Chain {
  private dir: Direction;
  private currentEpoch: Epoch;
  private sendEpoch: Epoch;
  private links: ChainEpoch[];
  private nextRoot: Uint8Array;
  private params: ChainParams;

  private constructor(
    dir: Direction,
    currentEpoch: Epoch,
    sendEpoch: Epoch,
    links: ChainEpoch[],
    nextRoot: Uint8Array,
    params: ChainParams,
  ) {
    this.dir = dir;
    this.currentEpoch = currentEpoch;
    this.sendEpoch = sendEpoch;
    this.links = links;
    this.nextRoot = nextRoot;
    this.params = params;
  }

  /**
   * Create a new chain from an initial key and direction.
   * HKDF info: "Signal PQ Ratchet V1 Chain  Start" (TWO spaces before Start!)
   *
   * The 96-byte HKDF output is split as:
   *   [0..32]:  nextRoot
   *   [32..64]: A2B chain seed
   *   [64..96]: B2A chain seed
   *
   * Direction determines which half is send vs recv.
   */
  static create(
    initialKey: Uint8Array,
    dir: Direction,
    params: ChainParams = { maxJump: DEFAULT_MAX_JUMP, maxOooKeys: DEFAULT_MAX_OOO_KEYS },
  ): Chain {
    const gen = hkdfSha256(initialKey, ZERO_SALT, CHAIN_START_INFO, 96);

    const switchedDir = switchDirection(dir);

    const sendKey = cedForDirection(gen, dir);
    const recvKey = cedForDirection(gen, switchedDir);

    return new Chain(
      dir,
      0n,
      0n,
      [
        {
          send: new ChainEpochDirection(sendKey),
          recv: new ChainEpochDirection(recvKey),
        },
      ],
      gen.slice(0, 32),
      params,
    );
  }

  /**
   * Add a new epoch to the chain with a shared secret.
   * HKDF info: "Signal PQ Ratchet V1 Chain Add Epoch"
   *
   * Salt = current nextRoot, IKM = epochSecret.secret
   */
  addEpoch(epochSecret: EpochSecret): void {
    if (epochSecret.epoch !== this.currentEpoch + 1n) {
      throw new SpqrError(
        `Expected epoch ${this.currentEpoch + 1n}, got ${epochSecret.epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }

    const gen = hkdfSha256(epochSecret.secret, this.nextRoot, CHAIN_ADD_EPOCH_INFO, 96);

    this.currentEpoch = epochSecret.epoch;
    this.nextRoot = gen.slice(0, 32);

    const sendKey = cedForDirection(gen, this.dir);
    const recvKey = cedForDirection(gen, switchDirection(this.dir));

    this.links.push({
      send: new ChainEpochDirection(sendKey),
      recv: new ChainEpochDirection(recvKey),
    });
  }

  private epochIdx(epoch: Epoch): number {
    if (epoch > this.currentEpoch) {
      throw new SpqrError(
        `Epoch not in valid range: ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }
    const back = Number(this.currentEpoch - epoch);
    if (back >= this.links.length) {
      throw new SpqrError(
        `Epoch not in valid range: ${epoch}`,
        SpqrErrorCode.EpochOutOfRange,
      );
    }
    return this.links.length - 1 - back;
  }

  /**
   * Get the next send key for a given epoch.
   * Returns [index, key].
   */
  sendKey(epoch: Epoch): [number, Uint8Array] {
    if (epoch < this.sendEpoch) {
      throw new SpqrError(
        `Send key epoch decreased (${this.sendEpoch} -> ${epoch})`,
        SpqrErrorCode.SendKeyEpochDecreased,
      );
    }

    let epochIndex = this.epochIdx(epoch);

    if (this.sendEpoch !== epoch) {
      this.sendEpoch = epoch;

      while (epochIndex > EPOCHS_TO_KEEP_PRIOR_TO_SEND_EPOCH) {
        this.links.shift();
        epochIndex -= 1;
      }

      for (let i = 0; i < epochIndex; i++) {
        this.links[i]!.send.clearNext();
      }
    }

    return this.links[epochIndex]!.send.nextKey();
  }

  /**
   * Get a receive key for a given epoch and counter index.
   */
  recvKey(epoch: Epoch, index: number): Uint8Array {
    const epochIndex = this.epochIdx(epoch);
    return this.links[epochIndex]!.recv.key(index, this.params);
  }

  // ---- Protobuf serialization ----

  /**
   * Serialize the chain to its protobuf representation.
   * Matches Rust Chain::into_pb().
   */
  toProto(): PbChain {
    return {
      direction: this.dir,
      currentEpoch: this.currentEpoch,
      sendEpoch: this.sendEpoch,
      nextRoot: Uint8Array.from(this.nextRoot),
      links: this.links.map((link): PbEpoch => ({
        send: link.send.toProto(),
        recv: link.recv.toProto(),
      })),
      params: chainParamsToProto(this.params),
    };
  }

  /**
   * Deserialize a chain from its protobuf representation.
   * Matches Rust Chain::from_pb().
   */
  static fromProto(pb: PbChain): Chain {
    const links = pb.links.map((link): ChainEpoch => ({
      send: ChainEpochDirection.fromProto(link.send ?? { ctr: 0, next: new Uint8Array(0), prev: new Uint8Array(0) }),
      recv: ChainEpochDirection.fromProto(link.recv ?? { ctr: 0, next: new Uint8Array(0), prev: new Uint8Array(0) }),
    }));

    const params = chainParamsFromProto(pb.params);

    return new Chain(
      pb.direction as Direction,
      pb.currentEpoch,
      pb.sendEpoch,
      links,
      Uint8Array.from(pb.nextRoot),
      params,
    );
  }
}

// ---- Direction helpers ----

/**
 * Select the chain key for a given direction from a 96-byte HKDF output.
 * A2B uses bytes [32..64], B2A uses bytes [64..96].
 */
function cedForDirection(gen: Uint8Array, dir: Direction): Uint8Array {
  // Direction.A2B = 0 -> [32..64]
  // Direction.B2A = 1 -> [64..96]
  return dir === 0 ? gen.slice(32, 64) : gen.slice(64, 96);
}

// ---- ChainParams proto helpers ----

/**
 * Convert ChainParams to protobuf format.
 * Default values are stored as 0 (proto3 convention).
 */
function chainParamsToProto(params: ChainParams): PbChainParams {
  return {
    maxJump: params.maxJump === DEFAULT_MAX_JUMP ? 0 : params.maxJump,
    maxOooKeys: params.maxOooKeys === DEFAULT_MAX_OOO_KEYS ? 0 : params.maxOooKeys,
  };
}

/**
 * Convert protobuf ChainParams to runtime ChainParams.
 * Zero values are interpreted as defaults.
 */
function chainParamsFromProto(pb?: PbChainParams): ChainParams {
  if (!pb) {
    return { maxJump: DEFAULT_MAX_JUMP, maxOooKeys: DEFAULT_MAX_OOO_KEYS };
  }
  return {
    maxJump: pb.maxJump > 0 ? pb.maxJump : DEFAULT_MAX_JUMP,
    maxOooKeys: pb.maxOooKeys > 0 ? pb.maxOooKeys : DEFAULT_MAX_OOO_KEYS,
  };
}
