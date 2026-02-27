/**
 * Triple Ratchet session state — wraps double-ratchet SessionState
 * with PQ ratchet (SPQR) state.
 *
 * The PQ ratchet state is an opaque Uint8Array managed by `@bcts/spqr`.
 * It is mutated in place on send/recv operations.
 */

import type {
  SessionState,
  RootKey,
  ChainKey,
  KeyPair,
  IdentityKey,
  PendingPreKey,
  PendingKyberPreKey,
  MessageKeys,
} from "@bcts/double-ratchet";
import * as spqr from "@bcts/spqr";
import { TripleRatchetError, TripleRatchetErrorCode } from "./error.js";
import type { PQRatchetState, PQRatchetMessage } from "./types.js";

export class TripleRatchetSessionState {
  private readonly inner: SessionState;
  private _pqRatchetState: PQRatchetState;

  constructor(inner: SessionState, pqRatchetState: PQRatchetState) {
    this.inner = inner;
    this._pqRatchetState = pqRatchetState;
  }

  // ---------------------------------------------------------------------------
  // PQ Ratchet operations
  // ---------------------------------------------------------------------------

  /**
   * Advance the PQ ratchet for an outgoing message.
   *
   * Returns the serialized SPQR message to include in the wire envelope
   * and an optional 32-byte key that should be mixed into the root key.
   */
  pqRatchetSend(rng: spqr.RandomBytes): { msg: PQRatchetMessage; key: Uint8Array | null } {
    try {
      const result = spqr.send(this._pqRatchetState, rng);
      this._pqRatchetState = result.state;
      return { msg: result.msg, key: result.key };
    } catch (err) {
      throw new TripleRatchetError(
        "PQ ratchet send failed",
        TripleRatchetErrorCode.PQRatchetSendError,
        err,
      );
    }
  }

  /**
   * Advance the PQ ratchet for an incoming message.
   *
   * Handles the V0/legacy case where both state and message are empty
   * by returning a null key without touching the state.
   */
  pqRatchetRecv(msg: PQRatchetMessage): { key: Uint8Array | null } {
    // Handle empty pq_ratchet (V0/legacy)
    if (msg.length === 0 && this._pqRatchetState.length === 0) {
      return { key: null };
    }
    try {
      const result = spqr.recv(this._pqRatchetState, msg);
      this._pqRatchetState = result.state;
      return { key: result.key };
    } catch (err) {
      throw new TripleRatchetError(
        "PQ ratchet recv failed",
        TripleRatchetErrorCode.PQRatchetRecvError,
        err,
      );
    }
  }

  /** Return the current opaque PQ ratchet state bytes. */
  pqRatchetState(): PQRatchetState {
    return this._pqRatchetState;
  }

  // ---------------------------------------------------------------------------
  // Delegated SessionState methods
  // ---------------------------------------------------------------------------

  sessionVersion(): number {
    return this.inner.sessionVersion();
  }

  localIdentityKey(): IdentityKey {
    return this.inner.localIdentityKey();
  }

  remoteIdentityKey(): IdentityKey | undefined {
    return this.inner.remoteIdentityKey();
  }

  sessionWithSelf(): boolean {
    return this.inner.sessionWithSelf();
  }

  rootKey(): RootKey {
    return this.inner.rootKey();
  }

  setRootKey(rootKey: RootKey): void {
    this.inner.setRootKey(rootKey);
  }

  hasSenderChain(): boolean {
    return this.inner.hasSenderChain();
  }

  getSenderChainKey(): ChainKey {
    return this.inner.getSenderChainKey();
  }

  setSenderChainKey(chainKey: ChainKey): void {
    this.inner.setSenderChainKey(chainKey);
  }

  senderRatchetKey(): Uint8Array {
    return this.inner.senderRatchetKey();
  }

  senderRatchetKeyPair(): KeyPair {
    return this.inner.senderRatchetKeyPair();
  }

  setSenderChain(keyPair: KeyPair, chainKey: ChainKey): void {
    this.inner.setSenderChain(keyPair, chainKey);
  }

  getReceiverChainKey(senderRatchetKey: Uint8Array): ChainKey | undefined {
    return this.inner.getReceiverChainKey(senderRatchetKey);
  }

  addReceiverChain(senderRatchetKey: Uint8Array, chainKey: ChainKey): void {
    this.inner.addReceiverChain(senderRatchetKey, chainKey);
  }

  setReceiverChainKey(senderRatchetKey: Uint8Array, chainKey: ChainKey): void {
    this.inner.setReceiverChainKey(senderRatchetKey, chainKey);
  }

  getMessageKeys(senderRatchetKey: Uint8Array, counter: number): MessageKeys | undefined {
    return this.inner.getMessageKeys(senderRatchetKey, counter);
  }

  removeMessageKeySeed(
    senderRatchetKey: Uint8Array,
    counter: number,
  ): { seed: Uint8Array; counter: number } | undefined {
    return this.inner.removeMessageKeySeed(senderRatchetKey, counter);
  }

  setMessageKeys(senderRatchetKey: Uint8Array, seed: Uint8Array, counter: number): void {
    this.inner.setMessageKeys(senderRatchetKey, seed, counter);
  }

  pendingPreKey(): PendingPreKey | undefined {
    return this.inner.pendingPreKey();
  }

  setPendingPreKey(pending: PendingPreKey): void {
    this.inner.setPendingPreKey(pending);
  }

  clearPendingPreKey(): void {
    this.inner.clearPendingPreKey();
  }

  pendingKyberPreKey(): PendingKyberPreKey | undefined {
    return this.inner.pendingKyberPreKey();
  }

  setPendingKyberPreKey(pending: PendingKyberPreKey): void {
    this.inner.setPendingKyberPreKey(pending);
  }

  clearPendingKyberPreKey(): void {
    this.inner.clearPendingKyberPreKey();
  }

  localRegistrationId(): number {
    return this.inner.localRegistrationId();
  }

  remoteRegistrationId(): number {
    return this.inner.remoteRegistrationId();
  }

  setLocalRegistrationId(id: number): void {
    this.inner.setLocalRegistrationId(id);
  }

  setRemoteRegistrationId(id: number): void {
    this.inner.setRemoteRegistrationId(id);
  }

  aliceBaseKey(): Uint8Array | undefined {
    return this.inner.aliceBaseKey();
  }

  previousCounter(): number {
    return this.inner.previousCounter();
  }

  setPreviousCounter(counter: number): void {
    this.inner.setPreviousCounter(counter);
  }

  /** Expose the inner double-ratchet SessionState for serialization. */
  innerState(): SessionState {
    return this.inner;
  }

  /** Deep-clone the triple ratchet state for speculative decryption. */
  clone(): TripleRatchetSessionState {
    return new TripleRatchetSessionState(
      this.inner.clone(),
      Uint8Array.from(this._pqRatchetState),
    );
  }
}

// ---------------------------------------------------------------------------
// Session usability (Task 7)
// ---------------------------------------------------------------------------

/**
 * Bitflags that describe which criteria make a triple-ratchet session
 * "usable" beyond simply having a present sender chain.
 *
 * These requirements are conjunctive: specifying multiple flags means
 * the session must satisfy all of them.
 */
export const TripleRatchetSessionUsability = {
  /** No extra requirements -- any session with a sender chain is usable. */
  None: 0,
  /**
   * Requires that a session not be stale.
   *
   * A stale session has a pending prekey older than 30 days.
   */
  NotStale: 1 << 0,
  /** Requires that the session was established via PQXDH (version >= 4). */
  EstablishedWithPqxdh: 1 << 1,
  /** Requires that the session has a non-empty SPQR ratchet state. */
  Spqr: 1 << 2,
} as const;

export type TripleRatchetSessionUsabilityFlags = number;

/** Maximum pending prekey age before a session is considered stale (seconds, matching Rust). */
const MAX_PENDING_PREKEY_AGE_SECS = 30 * 24 * 60 * 60;

/**
 * Check whether a triple-ratchet session meets the given usability
 * requirements.
 *
 * @param state - The triple-ratchet session state to inspect
 * @param now   - Current timestamp in milliseconds since epoch
 * @param requirements - Bitflags from TripleRatchetSessionUsability
 * @returns true if the session meets all specified requirements
 */
export function hasUsableTripleRatchetSession(
  state: TripleRatchetSessionState,
  now: number,
  requirements: TripleRatchetSessionUsabilityFlags,
): boolean {
  if (!state.hasSenderChain()) return false;

  if ((requirements & TripleRatchetSessionUsability.NotStale) !== 0) {
    const pending = state.pendingPreKey();
    if (pending != null) {
      if (Math.floor(now / 1000) - pending.timestamp > MAX_PENDING_PREKEY_AGE_SECS) return false;
    }
  }

  if ((requirements & TripleRatchetSessionUsability.EstablishedWithPqxdh) !== 0) {
    if (state.sessionVersion() < 4) return false;
  }

  if ((requirements & TripleRatchetSessionUsability.Spqr) !== 0) {
    if (state.pqRatchetState().length === 0) return false;
  }

  return true;
}
