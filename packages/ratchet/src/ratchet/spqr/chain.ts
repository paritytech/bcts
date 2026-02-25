/**
 * SPQR Symmetric Chain — epoch-based key derivation with forward/backward secrecy.
 *
 * Ported from Signal's spqr crate: chain.rs
 *
 * The Chain manages send/receive keys across epochs. Each epoch has two
 * directional chains (A2B and B2A). Keys are derived using HKDF-SHA256
 * with specific info strings that MUST match the Rust implementation
 * exactly (including the double space in "Chain  Start").
 */

import { hkdfSha256 } from "../../crypto/kdf.js";

// ---- Helpers ----

/** Concatenate multiple Uint8Arrays */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const a of arrays) totalLen += a.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// Pre-encode info strings to avoid repeated TextEncoder calls
const CHAIN_NEXT_INFO = new TextEncoder().encode("Signal PQ Ratchet V1 Chain Next");
const CHAIN_START_INFO = new TextEncoder().encode("Signal PQ Ratchet V1 Chain  Start");
const CHAIN_ADD_EPOCH_INFO = new TextEncoder().encode("Signal PQ Ratchet V1 Chain Add Epoch");

// ---- Constants ----

/** Default chain parameters matching Rust DEFAULT_CHAIN_PARAMS */
const DEFAULT_MAX_JUMP = 25_000;
const DEFAULT_MAX_OOO_KEYS = 2_000;

/**
 * Number of epochs to keep prior to the current send epoch.
 * Matches Rust EPOCHS_TO_KEEP_PRIOR_TO_SEND_EPOCH.
 */
const EPOCHS_TO_KEEP_PRIOR_TO_SEND_EPOCH = 1;

// Key size in KeyHistory storage: 4 bytes (index BE32) + 32 bytes (key)
const KEY_ENTRY_SIZE = 36;

// ---- Direction ----

export const enum Direction {
  A2B = 0,
  B2A = 1,
}

export function switchDirection(d: Direction): Direction {
  return d === Direction.A2B ? Direction.B2A : Direction.A2B;
}

// ---- ChainParams ----

export interface ChainParams {
  maxJump: number;
  maxOooKeys: number;
}

export const DEFAULT_CHAIN_PARAMS: ChainParams = {
  maxJump: DEFAULT_MAX_JUMP,
  maxOooKeys: DEFAULT_MAX_OOO_KEYS,
};

function resolveMaxJump(params: ChainParams): number {
  return params.maxJump > 0 ? params.maxJump : DEFAULT_MAX_JUMP;
}

function resolveMaxOooKeys(params: ChainParams): number {
  return params.maxOooKeys > 0 ? params.maxOooKeys : DEFAULT_MAX_OOO_KEYS;
}

function trimSize(params: ChainParams): number {
  const maxOoo = resolveMaxOooKeys(params);
  return Math.floor((maxOoo * 11) / 10) + 1;
}

// ---- EpochSecret ----

export interface EpochSecret {
  epoch: number; // u64 in Rust, safe as JS number for practical epoch counts
  secret: Uint8Array;
}

// ---- Errors ----

export class ChainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ChainError";
  }
}

// ---- HKDF helpers ----

const ZERO_SALT = new Uint8Array(32);

function hkdfDerive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  return hkdfSha256(ikm, salt, info, length);
}

// ---- KeyHistory ----

/**
 * Stores out-of-order keys as packed [index_be32][key_32] entries.
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
      if (currentKey < maxOoo) return;
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
      throw new ChainError(`Key trimmed: ${at}`, "KEY_TRIMMED");
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

    throw new ChainError(`Key already requested: ${at}`, "KEY_ALREADY_REQUESTED");
  }

  private removeAt(index: number): void {
    if (index + KEY_ENTRY_SIZE < this.length) {
      // Move last entry to this position
      const lastStart = this.length - KEY_ENTRY_SIZE;
      this.data.copyWithin(index, lastStart, this.length);
    }
    this.length -= KEY_ENTRY_SIZE;
  }

  /** Serialize for protobuf */
  serialize(): Uint8Array {
    return this.data.slice(0, this.length);
  }
}

// ---- ChainEpochDirection ----

/**
 * One directional chain within an epoch (send or recv).
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

    const ctrBe = new Uint8Array(4);
    new DataView(ctrBe.buffer).setUint32(0, this.ctr, false);

    const info = concatBytes(ctrBe, CHAIN_NEXT_INFO);

    const gen = hkdfDerive(ZERO_SALT, this.next, info, 64);
    this.next = gen.slice(0, 32);
    const key = gen.slice(32, 64);

    return [this.ctr, key];
  }

  /**
   * Internal version that derives next key without returning it publicly.
   * Used for skipping ahead.
   */
  private static nextKeyInternal(
    next: Uint8Array,
    ctr: number,
  ): { next: Uint8Array; ctr: number; index: number; key: Uint8Array } {
    ctr += 1;

    const ctrBe = new Uint8Array(4);
    new DataView(ctrBe.buffer).setUint32(0, ctr, false);

    const info = concatBytes(ctrBe, CHAIN_NEXT_INFO);

    const gen = hkdfDerive(ZERO_SALT, next, info, 64);

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
        throw new ChainError(`Key jump: ${this.ctr} - ${at}`, "KEY_JUMP");
      }
    } else if (at < this.ctr) {
      return this.prev.get(at, this.ctr, params);
    } else {
      // at === this.ctr: already returned
      throw new ChainError(`Key already requested: ${at}`, "KEY_ALREADY_REQUESTED");
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

  /** Serialize for protobuf-like storage */
  serialize(): { ctr: number; next: Uint8Array; prev: Uint8Array } {
    return {
      ctr: this.ctr,
      next: Uint8Array.from(this.next),
      prev: this.prev.serialize(),
    };
  }

  static deserialize(data: {
    ctr: number;
    next: Uint8Array;
    prev: Uint8Array;
  }): ChainEpochDirection {
    return new ChainEpochDirection(data.next, data.ctr, data.prev);
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
 */
export class Chain {
  private dir: Direction;
  private currentEpoch: number;
  private sendEpoch: number;
  private links: ChainEpoch[];
  private nextRoot: Uint8Array;
  private params: ChainParams;

  private constructor(
    dir: Direction,
    currentEpoch: number,
    sendEpoch: number,
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
   * EXACT info string: "Signal PQ Ratchet V1 Chain  Start" (TWO spaces!)
   */
  static create(
    initialKey: Uint8Array,
    dir: Direction,
    params: ChainParams = DEFAULT_CHAIN_PARAMS,
  ): Chain {
    const gen = hkdfDerive(ZERO_SALT, initialKey, CHAIN_START_INFO, 96);

    const switchedDir = switchDirection(dir);

    const sendKey = dir === Direction.A2B ? gen.slice(32, 64) : gen.slice(64, 96);
    const recvKey = switchedDir === Direction.A2B ? gen.slice(32, 64) : gen.slice(64, 96);

    return new Chain(
      dir,
      0,
      0,
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
   * Info string: "Signal PQ Ratchet V1 Chain Add Epoch"
   */
  addEpoch(epochSecret: EpochSecret): void {
    if (epochSecret.epoch !== this.currentEpoch + 1) {
      throw new ChainError(
        `Expected epoch ${this.currentEpoch + 1}, got ${epochSecret.epoch}`,
        "EPOCH_MISMATCH",
      );
    }

    const gen = hkdfDerive(this.nextRoot, epochSecret.secret, CHAIN_ADD_EPOCH_INFO, 96);

    this.currentEpoch = epochSecret.epoch;
    this.nextRoot = gen.slice(0, 32);

    const sendKey = this.dir === Direction.A2B ? gen.slice(32, 64) : gen.slice(64, 96);
    const recvKey = this.dir === Direction.A2B ? gen.slice(64, 96) : gen.slice(32, 64);

    this.links.push({
      send: new ChainEpochDirection(sendKey),
      recv: new ChainEpochDirection(recvKey),
    });
  }

  private epochIdx(epoch: number): number {
    if (epoch > this.currentEpoch) {
      throw new ChainError(`Epoch not in valid range: ${epoch}`, "EPOCH_OUT_OF_RANGE");
    }
    const back = this.currentEpoch - epoch;
    if (back >= this.links.length) {
      throw new ChainError(`Epoch not in valid range: ${epoch}`, "EPOCH_OUT_OF_RANGE");
    }
    return this.links.length - 1 - back;
  }

  /**
   * Get the next send key for a given epoch.
   * Returns [index, key].
   */
  sendKey(epoch: number): [number, Uint8Array] {
    if (epoch < this.sendEpoch) {
      throw new ChainError(
        `Send key epoch decreased (${this.sendEpoch} -> ${epoch})`,
        "SEND_KEY_EPOCH_DECREASED",
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
        this.links[i].send.clearNext();
      }
    }

    return this.links[epochIndex].send.nextKey();
  }

  /**
   * Get a receive key for a given epoch and counter index.
   */
  recvKey(epoch: number, index: number): Uint8Array {
    const epochIndex = this.epochIdx(epoch);
    return this.links[epochIndex].recv.key(index, this.params);
  }

  // ---- Serialization ----

  serialize(): SerializedChain {
    return {
      direction: this.dir,
      currentEpoch: this.currentEpoch,
      sendEpoch: this.sendEpoch,
      nextRoot: Uint8Array.from(this.nextRoot),
      links: this.links.map((link) => ({
        send: link.send.serialize(),
        recv: link.recv.serialize(),
      })),
      params: { ...this.params },
    };
  }

  static deserialize(data: SerializedChain): Chain {
    const links = data.links.map((link) => ({
      send: ChainEpochDirection.deserialize(link.send),
      recv: ChainEpochDirection.deserialize(link.recv),
    }));

    return new Chain(
      data.direction,
      data.currentEpoch,
      data.sendEpoch,
      links,
      Uint8Array.from(data.nextRoot),
      data.params,
    );
  }
}

// ---- Serialization types ----

export interface SerializedEpochDirection {
  ctr: number;
  next: Uint8Array;
  prev: Uint8Array;
}

export interface SerializedEpoch {
  send: SerializedEpochDirection;
  recv: SerializedEpochDirection;
}

export interface SerializedChain {
  direction: Direction;
  currentEpoch: number;
  sendEpoch: number;
  nextRoot: Uint8Array;
  links: SerializedEpoch[];
  params: ChainParams;
}
