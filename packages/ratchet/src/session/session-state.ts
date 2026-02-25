/**
 * Session state for the Signal Protocol.
 *
 * Holds the current ratchet state including root key, sender/receiver chains,
 * pending prekey info, and cached out-of-order message keys.
 *
 * Reference: libsignal/rust/protocol/src/state/session.rs
 */

import { ChainKey } from "../ratchet/chain-key.js";
import { RootKey } from "../ratchet/root-key.js";
import { MessageKeys } from "../ratchet/message-keys.js";
import { PqRatchetState } from "../ratchet/pq-ratchet.js";
import { spqrSend, spqrRecv } from "../ratchet/spqr-adapter.js";
import { KeyPair } from "../keys/key-pair.js";
import { IdentityKey } from "../keys/identity-key.js";
import { InvalidSessionError } from "../error.js";
import {
  MAX_RECEIVER_CHAINS,
  MAX_MESSAGE_KEYS,
  MAX_UNACKNOWLEDGED_SESSION_AGE_MS,
  CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION,
} from "../constants.js";
import {
  encodeSessionStructure,
  decodeSessionStructure,
  type SessionStructureProto,
  type ChainStructureProto,
} from "../protocol/proto.js";

/**
 * Constant-time comparison of two byte arrays.
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Specifies which criteria make a session "usable" beyond simply having a
 * present sender chain.
 *
 * These requirements are conjunctive: specifying `NotStale | EstablishedWithPqxdh`
 * means the session must be neither stale nor established with X3DH.
 *
 * Reference: libsignal/rust/protocol/src/state/session.rs (SessionUsabilityRequirements)
 */
export const SessionUsabilityRequirements = {
  /** No extra requirements -- any session with a sender chain is usable. */
  None: 0,
  /**
   * Requires that a session not be stale.
   *
   * A non-stale session is one of the following:
   * - "incoming", i.e. started by the peer
   * - "acknowledged", i.e. started locally but received a response
   * - no more than MAX_UNACKNOWLEDGED_SESSION_AGE old
   */
  NotStale: 1 << 0,
  /**
   * Requires that a session was established using PQXDH (or newer) rather
   * than X3DH. This includes unacknowledged sessions that are using PQXDH.
   */
  EstablishedWithPqxdh: 1 << 1,
  /**
   * Requires that a session is using SPQR (post-quantum ratchet state).
   *
   * Warning: Allows unacknowledged sessions that include SPQR in their
   * PreKey messages. If the peer downgrades the session, a session previously
   * considered "usable" can become "not usable" upon receiving a response.
   */
  Spqr: 1 << 2,
} as const;

export type SessionUsabilityRequirements = number;

/** Stored message key — either fully derived keys or a seed for lazy derivation. */
type StoredMessageKey =
  | { type: "keys"; keys: MessageKeys }
  | { type: "seed"; seed: Uint8Array; counter: number };

interface ReceiverChain {
  senderRatchetKey: Uint8Array;
  chainKey: ChainKey;
  messageKeys: StoredMessageKey[];
}

interface SenderChain {
  ratchetKeyPair: KeyPair;
  chainKey: ChainKey;
}

export interface PendingPreKey {
  preKeyId: number | undefined;
  signedPreKeyId: number;
  baseKey: Uint8Array;
  timestamp: number;
  kyberPreKeyId?: number;
  kyberCiphertext?: Uint8Array;
}

/**
 * Result of a PQ ratchet send operation.
 *
 * - message: bytes to include in the SignalMessage pqRatchet field (empty for V0)
 * - key: optional PQ message key to use as HKDF salt (null for V0)
 */
export interface PqRatchetSendResult {
  message: Uint8Array;
  key: Uint8Array | null;
}

/**
 * Result of a PQ ratchet receive operation.
 *
 * - key: optional PQ message key to use as HKDF salt (null for V0)
 */
export interface PqRatchetRecvResult {
  key: Uint8Array | null;
}

export class SessionState {
  private _sessionVersion: number;
  private _localIdentityKey: IdentityKey;
  private _remoteIdentityKey: IdentityKey | undefined;
  private _rootKey: RootKey;
  private _previousCounter: number;
  private _senderChain: SenderChain | undefined;
  private _receiverChains: ReceiverChain[];
  private _pendingPreKey: PendingPreKey | undefined;
  private _localRegistrationId: number;
  private _remoteRegistrationId: number;
  private _aliceBaseKey: Uint8Array | undefined;
  private _pqRatchetState: PqRatchetState | undefined;
  /**
   * Raw serialized PQ ratchet state bytes for protobuf field 15.
   *
   * This stores the SPQR serialized state. Interpretation:
   * - Empty (length 0): V0 disabled PQ ratchet (interop mode)
   * - 32 bytes: Simple PQ ratchet root key (current implementation)
   * - >32 bytes: Full SPQR serialized state (future implementation)
   *
   * Reference: libsignal storage.proto field 15 (pq_ratchet_state)
   */
  private _pqRatchetStateBytes: Uint8Array;

  constructor(params: {
    sessionVersion: number;
    localIdentityKey: IdentityKey;
    remoteIdentityKey?: IdentityKey;
    rootKey: RootKey;
    aliceBaseKey?: Uint8Array;
  }) {
    this._sessionVersion = params.sessionVersion;
    this._localIdentityKey = params.localIdentityKey;
    this._remoteIdentityKey = params.remoteIdentityKey;
    this._rootKey = params.rootKey;
    this._previousCounter = 0;
    this._senderChain = undefined;
    this._receiverChains = [];
    this._pendingPreKey = undefined;
    this._localRegistrationId = 0;
    this._remoteRegistrationId = 0;
    // Store aliceBaseKey in 33-byte DJB-prefixed form (0x05 || raw_key)
    // for protobuf compatibility with libsignal's SessionStructure.
    this._aliceBaseKey = params.aliceBaseKey
      ? SessionState.ensureDjbPrefix(params.aliceBaseKey)
      : undefined;
    // V0 by default: empty bytes = disabled PQ ratchet
    this._pqRatchetStateBytes = new Uint8Array(0);
  }

  // --- Version ---

  sessionVersion(): number {
    return this._sessionVersion;
  }

  // --- Identity ---

  localIdentityKey(): IdentityKey {
    return this._localIdentityKey;
  }

  remoteIdentityKey(): IdentityKey | undefined {
    return this._remoteIdentityKey;
  }

  sessionWithSelf(): boolean {
    if (!this._remoteIdentityKey) return false;
    return this._localIdentityKey.equals(this._remoteIdentityKey);
  }

  // --- Root Key ---

  rootKey(): RootKey {
    return this._rootKey;
  }

  setRootKey(rootKey: RootKey): void {
    this._rootKey = rootKey;
  }

  // --- Previous Counter ---

  previousCounter(): number {
    return this._previousCounter;
  }

  setPreviousCounter(counter: number): void {
    this._previousCounter = counter;
  }

  // --- Sender Chain ---

  hasSenderChain(): boolean {
    return this._senderChain !== undefined;
  }

  /**
   * Check if this session has a usable sender chain, considering the given
   * usability requirements.
   *
   * Reference: libsignal SessionState::has_usable_sender_chain
   *
   * @param now - Current timestamp in milliseconds since epoch
   * @param requirements - Bitflags from SessionUsabilityRequirements
   */
  hasUsableSenderChain(now: number, requirements: SessionUsabilityRequirements): boolean {
    if (!this._senderChain) {
      return false;
    }

    if (requirements & SessionUsabilityRequirements.NotStale) {
      if (this._pendingPreKey) {
        const creationTimestamp = this._pendingPreKey.timestamp;
        if (creationTimestamp + MAX_UNACKNOWLEDGED_SESSION_AGE_MS < now) {
          return false;
        }
      }
    }

    if (requirements & SessionUsabilityRequirements.EstablishedWithPqxdh) {
      if (this._sessionVersion <= CIPHERTEXT_MESSAGE_PRE_KYBER_VERSION) {
        return false;
      }
    }

    if (requirements & SessionUsabilityRequirements.Spqr) {
      if (!this.hasPqRatchetState()) {
        return false;
      }
    }

    return true;
  }

  getSenderChainKey(): ChainKey {
    if (!this._senderChain) {
      throw new InvalidSessionError("No sender chain");
    }
    return this._senderChain.chainKey;
  }

  setSenderChainKey(chainKey: ChainKey): void {
    if (!this._senderChain) {
      throw new InvalidSessionError("No sender chain");
    }
    this._senderChain.chainKey = chainKey;
  }

  senderRatchetKey(): Uint8Array {
    if (!this._senderChain) {
      throw new InvalidSessionError("No sender chain");
    }
    return this._senderChain.ratchetKeyPair.publicKey;
  }

  senderRatchetKeyPair(): KeyPair {
    if (!this._senderChain) {
      throw new InvalidSessionError("No sender chain");
    }
    return this._senderChain.ratchetKeyPair;
  }

  setSenderChain(keyPair: KeyPair, chainKey: ChainKey): void {
    this._senderChain = { ratchetKeyPair: keyPair, chainKey };
  }

  // --- Receiver Chains ---

  getReceiverChainKey(senderRatchetKey: Uint8Array): ChainKey | undefined {
    const chain = this._receiverChains.find((c) =>
      bytesEqual(c.senderRatchetKey, senderRatchetKey),
    );
    return chain?.chainKey;
  }

  addReceiverChain(senderRatchetKey: Uint8Array, chainKey: ChainKey): void {
    this._receiverChains.push({
      senderRatchetKey: Uint8Array.from(senderRatchetKey),
      chainKey,
      messageKeys: [],
    });
    // Trim oldest if exceeding limit (matches Signal: remove(0))
    if (this._receiverChains.length > MAX_RECEIVER_CHAINS) {
      this._receiverChains.shift();
    }
  }

  setReceiverChainKey(senderRatchetKey: Uint8Array, chainKey: ChainKey): void {
    const chain = this._receiverChains.find((c) =>
      bytesEqual(c.senderRatchetKey, senderRatchetKey),
    );
    if (chain) {
      chain.chainKey = chainKey;
    }
  }

  // --- Message Keys ---

  getMessageKeys(
    senderRatchetKey: Uint8Array,
    counter: number,
    pqSalt?: Uint8Array,
  ): MessageKeys | undefined {
    const chain = this._receiverChains.find((c) =>
      bytesEqual(c.senderRatchetKey, senderRatchetKey),
    );
    if (!chain) return undefined;

    const idx = chain.messageKeys.findIndex((mk) => {
      if (mk.type === "keys") return mk.keys.counter === counter;
      return mk.counter === counter;
    });
    if (idx === -1) return undefined;

    // Remove and return (one-time use)
    const [stored] = chain.messageKeys.splice(idx, 1);
    if (stored.type === "keys") {
      return stored.keys;
    }
    // Derive from seed with optional PQ salt
    return MessageKeys.deriveFrom(stored.seed, stored.counter, pqSalt);
  }

  setMessageKeys(senderRatchetKey: Uint8Array, seed: Uint8Array, counter: number): void {
    const chain = this._receiverChains.find((c) =>
      bytesEqual(c.senderRatchetKey, senderRatchetKey),
    );
    if (!chain) return;

    // Insert at beginning (newest first), matching Signal behavior
    chain.messageKeys.unshift({ type: "seed", seed, counter });

    // Trim oldest if exceeding limit
    if (chain.messageKeys.length > MAX_MESSAGE_KEYS) {
      chain.messageKeys.pop();
    }
  }

  // --- Pending PreKey ---

  pendingPreKey(): PendingPreKey | undefined {
    return this._pendingPreKey;
  }

  setPendingPreKey(pending: PendingPreKey): void {
    this._pendingPreKey = pending;
  }

  clearPendingPreKey(): void {
    this._pendingPreKey = undefined;
  }

  // --- Registration IDs ---

  localRegistrationId(): number {
    return this._localRegistrationId;
  }

  setLocalRegistrationId(id: number): void {
    this._localRegistrationId = id;
  }

  remoteRegistrationId(): number {
    return this._remoteRegistrationId;
  }

  setRemoteRegistrationId(id: number): void {
    this._remoteRegistrationId = id;
  }

  // --- Alice Base Key ---

  /**
   * Returns the alice base key in 33-byte DJB-prefixed form (0x05 || raw_key),
   * matching libsignal's SessionStructure.alice_base_key serialization.
   */
  aliceBaseKey(): Uint8Array | undefined {
    return this._aliceBaseKey;
  }

  /**
   * Returns the alice base key as raw 32 bytes (without DJB prefix),
   * suitable for X25519 DH operations.
   */
  aliceBaseKeyRaw(): Uint8Array | undefined {
    if (!this._aliceBaseKey) return undefined;
    return SessionState.stripDjbPrefix(this._aliceBaseKey);
  }

  /**
   * Ensure a public key has the 0x05 DJB type prefix.
   * If already 33 bytes with 0x05 prefix, returns as-is.
   * If 32 bytes (raw), prepends 0x05.
   */
  static ensureDjbPrefix(key: Uint8Array): Uint8Array {
    if (key.length === 33 && key[0] === 0x05) {
      return key;
    }
    if (key.length === 32) {
      const prefixed = new Uint8Array(33);
      prefixed[0] = 0x05;
      prefixed.set(key, 1);
      return prefixed;
    }
    // Unexpected length — return as-is for backward compatibility
    return key;
  }

  /**
   * Strip 0x05 DJB prefix from a public key, returning raw 32 bytes.
   */
  static stripDjbPrefix(key: Uint8Array): Uint8Array {
    if (key.length === 33 && key[0] === 0x05) {
      return key.slice(1);
    }
    return key;
  }

  // --- PQ Ratchet ---

  pqRatchetState(): PqRatchetState | undefined {
    return this._pqRatchetState;
  }

  setPqRatchetState(state: PqRatchetState): void {
    this._pqRatchetState = state;
    // Sync raw bytes from the PqRatchetState root key
    this._pqRatchetStateBytes = Uint8Array.from(state.rootKey());
  }

  /**
   * Returns the raw serialized PQ ratchet state bytes (field 15).
   *
   * Empty array means V0 (disabled PQ ratchet).
   */
  pqRatchetStateBytes(): Uint8Array {
    return this._pqRatchetStateBytes;
  }

  /**
   * Set the raw PQ ratchet state bytes directly.
   *
   * Also syncs the PqRatchetState object if the bytes are exactly 32 bytes
   * (simple PQ ratchet root key).
   */
  setPqRatchetStateBytes(bytes: Uint8Array): void {
    this._pqRatchetStateBytes = Uint8Array.from(bytes);
    // Sync PqRatchetState if it's a simple 32-byte root key
    if (bytes.length === 32) {
      this._pqRatchetState = new PqRatchetState(Uint8Array.from(bytes));
    } else {
      // V0 (empty) or future SPQR state (>32 bytes) -- clear the simple state
      this._pqRatchetState = undefined;
    }
  }

  /**
   * Returns true if the PQ ratchet state is non-empty (not V0 disabled).
   *
   * Reference: libsignal SessionState::pq_ratchet_state().is_empty()
   */
  hasPqRatchetState(): boolean {
    return this._pqRatchetStateBytes.length > 0;
  }

  /**
   * PQ ratchet send operation.
   *
   * When state is V0 (empty): returns empty message and null key.
   * When state has a simple PQ root key: delegates to PqRatchetState.send().
   *
   * Reference: libsignal SessionState::pq_ratchet_send (spqr::send)
   */
  pqRatchetSend(): PqRatchetSendResult {
    // V0 disabled: return empty message and null key
    if (this._pqRatchetStateBytes.length === 0) {
      return { message: new Uint8Array(0), key: null };
    }

    // Simple PQ ratchet (32-byte root key)
    if (this._pqRatchetStateBytes.length === 32 && this._pqRatchetState) {
      const result = this._pqRatchetState.send();
      return { message: result.spqrMessage, key: result.messageKey };
    }

    // Full SPQR state (>32 bytes) -- delegate to SPQR module
    if (this._pqRatchetStateBytes.length > 32) {
      const result = spqrSend(this._pqRatchetStateBytes);
      this._pqRatchetStateBytes = result.state;
      this._pqRatchetState = undefined; // Not a simple PQ state
      return { message: result.msg, key: result.key };
    }

    // Fallback: treat as V0
    return { message: new Uint8Array(0), key: null };
  }

  /**
   * PQ ratchet receive operation.
   *
   * When state is V0 (empty) and msg is empty: returns null key.
   * When state has a simple PQ root key: delegates to PqRatchetState.recv().
   *
   * Reference: libsignal SessionState::pq_ratchet_recv (spqr::recv)
   */
  pqRatchetRecv(msg: Uint8Array | undefined): PqRatchetRecvResult {
    // V0 disabled: return null key (msg should also be empty)
    if (this._pqRatchetStateBytes.length === 0) {
      return { key: null };
    }

    // Simple PQ ratchet (32-byte root key)
    if (this._pqRatchetStateBytes.length === 32 && this._pqRatchetState && msg && msg.length > 0) {
      const messageKey = this._pqRatchetState.recv(msg);
      return { key: messageKey };
    }

    // Full SPQR state (>32 bytes) -- delegate to SPQR module
    if (this._pqRatchetStateBytes.length > 32 && msg && msg.length > 0) {
      const result = spqrRecv(this._pqRatchetStateBytes, msg);
      this._pqRatchetStateBytes = result.state;
      this._pqRatchetState = undefined; // Not a simple PQ state
      return { key: result.key };
    }

    // No message data or short state -- return null
    return { key: null };
  }

  // --- Builder helpers (for initialization) ---

  withReceiverChain(senderRatchetKey: Uint8Array, chainKey: ChainKey): SessionState {
    this.addReceiverChain(senderRatchetKey, chainKey);
    return this;
  }

  withSenderChain(keyPair: KeyPair, chainKey: ChainKey): SessionState {
    this.setSenderChain(keyPair, chainKey);
    return this;
  }

  /**
   * Serialize this session state to protobuf bytes.
   * Compatible with libsignal's SessionStructure protobuf.
   */
  serialize(): Uint8Array {
    const proto: SessionStructureProto = {
      sessionVersion: this._sessionVersion,
      localIdentityPublic: this._localIdentityKey.serialize(),
      remoteIdentityPublic: this._remoteIdentityKey?.serialize(),
      rootKey: this._rootKey.key,
      previousCounter: this._previousCounter,
      remoteRegistrationId: this._remoteRegistrationId,
      localRegistrationId: this._localRegistrationId,
      aliceBaseKey: this._aliceBaseKey,
    };

    // Sender chain
    if (this._senderChain) {
      const serializedPubKey = new Uint8Array(33);
      serializedPubKey[0] = 0x05;
      serializedPubKey.set(this._senderChain.ratchetKeyPair.publicKey, 1);
      proto.senderChain = {
        senderRatchetKey: serializedPubKey,
        senderRatchetKeyPrivate: this._senderChain.ratchetKeyPair.privateKey,
        chainKey: {
          index: this._senderChain.chainKey.index,
          key: this._senderChain.chainKey.key,
        },
      };
    }

    // Receiver chains
    proto.receiverChains = this._receiverChains.map((rc) => {
      const serializedKey = new Uint8Array(33);
      serializedKey[0] = 0x05;
      serializedKey.set(rc.senderRatchetKey, 1);
      const chain: ChainStructureProto = {
        senderRatchetKey: serializedKey,
        chainKey: {
          index: rc.chainKey.index,
          key: rc.chainKey.key,
        },
        messageKeys: rc.messageKeys.map((mk) => {
          if (mk.type === "keys") {
            return {
              index: mk.keys.counter,
              cipherKey: mk.keys.cipherKey,
              macKey: mk.keys.macKey,
              iv: mk.keys.iv,
            };
          }
          return {
            index: mk.counter,
            seed: mk.seed,
          };
        }),
      };
      return chain;
    });

    // Pending pre-key
    if (this._pendingPreKey) {
      proto.pendingPreKey = {
        preKeyId: this._pendingPreKey.preKeyId,
        signedPreKeyId: this._pendingPreKey.signedPreKeyId,
        baseKey: this._pendingPreKey.baseKey,
        timestamp: this._pendingPreKey.timestamp,
      };
      if (this._pendingPreKey.kyberPreKeyId !== undefined) {
        proto.pendingKyberPreKey = {
          kyberPreKeyId: this._pendingPreKey.kyberPreKeyId,
          kyberCiphertext: this._pendingPreKey.kyberCiphertext,
        };
      }
    }

    // PQ ratchet state (field 15)
    // Serialize raw bytes -- empty for V0, 32 bytes for simple PQ, or larger for future SPQR
    if (this._pqRatchetStateBytes.length > 0) {
      proto.pqRatchetState = this._pqRatchetStateBytes;
    }

    return encodeSessionStructure(proto);
  }

  /**
   * Deserialize a session state from protobuf bytes.
   */
  static deserialize(data: Uint8Array): SessionState {
    const proto = decodeSessionStructure(data);

    if (!proto.localIdentityPublic) {
      throw new InvalidSessionError("Missing local identity key");
    }

    const localIdentityKey = IdentityKey.deserialize(proto.localIdentityPublic);
    const remoteIdentityKey = proto.remoteIdentityPublic
      ? IdentityKey.deserialize(proto.remoteIdentityPublic)
      : undefined;

    const state = new SessionState({
      sessionVersion: proto.sessionVersion ?? 0,
      localIdentityKey,
      remoteIdentityKey,
      rootKey: new RootKey(proto.rootKey ?? new Uint8Array(32)),
      aliceBaseKey: proto.aliceBaseKey,
    });

    state._previousCounter = proto.previousCounter ?? 0;
    state._remoteRegistrationId = proto.remoteRegistrationId ?? 0;
    state._localRegistrationId = proto.localRegistrationId ?? 0;

    // Sender chain
    if (proto.senderChain) {
      const pub = proto.senderChain.senderRatchetKey;
      const priv = proto.senderChain.senderRatchetKeyPrivate;
      if (pub && priv) {
        // Strip 0x05 prefix
        const rawPub = pub.length === 33 && pub[0] === 0x05 ? pub.slice(1) : pub;
        const kp = new KeyPair(priv, rawPub);
        const ck = new ChainKey(
          proto.senderChain.chainKey?.key ?? new Uint8Array(32),
          proto.senderChain.chainKey?.index ?? 0,
        );
        state.setSenderChain(kp, ck);
      }
    }

    // Receiver chains
    if (proto.receiverChains) {
      for (const rc of proto.receiverChains) {
        if (rc.senderRatchetKey) {
          const rawKey =
            rc.senderRatchetKey.length === 33 && rc.senderRatchetKey[0] === 0x05
              ? rc.senderRatchetKey.slice(1)
              : rc.senderRatchetKey;
          const ck = new ChainKey(rc.chainKey?.key ?? new Uint8Array(32), rc.chainKey?.index ?? 0);
          state.addReceiverChain(rawKey, ck);

          // Restore message keys
          if (rc.messageKeys) {
            for (const mk of rc.messageKeys) {
              if (mk.seed) {
                state.setMessageKeys(rawKey, mk.seed, mk.index ?? 0);
              } else if (mk.cipherKey && mk.macKey && mk.iv) {
                // Set fully-derived keys via direct chain access
                const chain = state._receiverChains.find((c) =>
                  bytesEqual(c.senderRatchetKey, rawKey),
                );
                if (chain) {
                  chain.messageKeys.unshift({
                    type: "keys",
                    keys: new MessageKeys(mk.cipherKey, mk.macKey, mk.iv, mk.index ?? 0),
                  });
                }
              }
            }
          }
        }
      }
    }

    // Pending pre-key
    if (proto.pendingPreKey) {
      state.setPendingPreKey({
        preKeyId: proto.pendingPreKey.preKeyId,
        signedPreKeyId: proto.pendingPreKey.signedPreKeyId ?? 0,
        baseKey: proto.pendingPreKey.baseKey ?? new Uint8Array(0),
        timestamp: proto.pendingPreKey.timestamp ?? Date.now(),
        kyberPreKeyId: proto.pendingKyberPreKey?.kyberPreKeyId,
        kyberCiphertext: proto.pendingKyberPreKey?.kyberCiphertext,
      });
    }

    // PQ ratchet state (field 15)
    // Restore raw bytes and sync PqRatchetState object if applicable
    if (proto.pqRatchetState && proto.pqRatchetState.length > 0) {
      state.setPqRatchetStateBytes(proto.pqRatchetState);
    }

    return state;
  }

  /**
   * Clone this session state for trying decryption without modifying the original.
   */
  clone(): SessionState {
    const cloned = new SessionState({
      sessionVersion: this._sessionVersion,
      localIdentityKey: this._localIdentityKey,
      remoteIdentityKey: this._remoteIdentityKey,
      rootKey: new RootKey(Uint8Array.from(this._rootKey.key)),
      aliceBaseKey: this._aliceBaseKey ? Uint8Array.from(this._aliceBaseKey) : undefined,
    });
    cloned._previousCounter = this._previousCounter;
    cloned._localRegistrationId = this._localRegistrationId;
    cloned._remoteRegistrationId = this._remoteRegistrationId;
    cloned._pendingPreKey = this._pendingPreKey
      ? {
          ...this._pendingPreKey,
          kyberCiphertext: this._pendingPreKey.kyberCiphertext
            ? Uint8Array.from(this._pendingPreKey.kyberCiphertext)
            : undefined,
        }
      : undefined;

    if (this._senderChain) {
      cloned._senderChain = {
        ratchetKeyPair: this._senderChain.ratchetKeyPair,
        chainKey: new ChainKey(
          Uint8Array.from(this._senderChain.chainKey.key),
          this._senderChain.chainKey.index,
        ),
      };
    }

    cloned._pqRatchetState = this._pqRatchetState?.clone();
    cloned._pqRatchetStateBytes = Uint8Array.from(this._pqRatchetStateBytes);

    cloned._receiverChains = this._receiverChains.map((rc) => ({
      senderRatchetKey: Uint8Array.from(rc.senderRatchetKey),
      chainKey: new ChainKey(Uint8Array.from(rc.chainKey.key), rc.chainKey.index),
      messageKeys: rc.messageKeys.map((mk) =>
        mk.type === "keys"
          ? {
              type: "keys" as const,
              keys: new MessageKeys(
                Uint8Array.from(mk.keys.cipherKey),
                Uint8Array.from(mk.keys.macKey),
                Uint8Array.from(mk.keys.iv),
                mk.keys.counter,
              ),
            }
          : {
              type: "seed" as const,
              seed: Uint8Array.from(mk.seed),
              counter: mk.counter,
            },
      ),
    }));

    return cloned;
  }
}
