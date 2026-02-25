/**
 * Session record — holds current session state plus archived previous sessions.
 *
 * Reference: libsignal/rust/protocol/src/state/session.rs (SessionRecord)
 */

import { SessionState, type SessionUsabilityRequirements } from "./session-state.js";
import { ARCHIVED_STATES_MAX_LENGTH } from "../constants.js";
import {
  encodeRecordStructure,
  decodeRecordStructure,
  type RecordStructureProto,
} from "../protocol/proto.js";

export class SessionRecord {
  private _currentSession: SessionState | undefined;
  private _previousSessions: SessionState[];

  constructor(currentSession?: SessionState) {
    this._currentSession = currentSession;
    this._previousSessions = [];
  }

  static newFresh(): SessionRecord {
    return new SessionRecord();
  }

  // --- Current Session ---

  sessionState(): SessionState | undefined {
    return this._currentSession;
  }

  setSessionState(state: SessionState): void {
    this._currentSession = state;
  }

  /**
   * Check if this record has a usable session meeting the given requirements.
   *
   * Reference: libsignal SessionRecord::has_usable_sender_chain
   *
   * @param now - Current timestamp in milliseconds since epoch
   * @param requirements - Bitflags from SessionUsabilityRequirements
   */
  hasUsableSession(now: number, requirements: SessionUsabilityRequirements): boolean {
    if (this._currentSession == null) {
      return false;
    }
    return this._currentSession.hasUsableSenderChain(now, requirements);
  }

  // --- Previous Sessions ---

  previousSessionStates(): SessionState[] {
    return this._previousSessions;
  }

  /**
   * Promote a previous session that successfully decrypted.
   * Removes it from previous and sets it as current, archiving old current.
   */
  promoteOldSession(index: number, updatedState: SessionState): void {
    // Remove the old session at index
    this._previousSessions.splice(index, 1);
    // Promote it to current, archiving the current one
    this.promoteState(updatedState);
  }

  /**
   * Archive the current session (if any) and set a new one.
   */
  promoteState(newState: SessionState): void {
    this.archiveCurrentState();
    this._currentSession = newState;
  }

  /**
   * Archive the current session into previous sessions.
   */
  archiveCurrentState(): void {
    if (this._currentSession != null) {
      // H1: Clear pending prekey before archiving (matches libsignal state.rs)
      this._currentSession.clearPendingPreKey();
      this._previousSessions.unshift(this._currentSession);
      // Trim oldest
      while (this._previousSessions.length > ARCHIVED_STATES_MAX_LENGTH) {
        this._previousSessions.pop();
      }
      this._currentSession = undefined;
    }
  }

  /**
   * Serialize this session record to protobuf bytes.
   */
  serialize(): Uint8Array {
    const proto: RecordStructureProto = {};
    if (this._currentSession != null) {
      proto.currentSession = this._currentSession.serialize();
    }
    if (this._previousSessions.length > 0) {
      proto.previousSessions = this._previousSessions.map((s) => s.serialize());
    }
    return encodeRecordStructure(proto);
  }

  /**
   * Deserialize a session record from protobuf bytes.
   */
  static deserialize(data: Uint8Array): SessionRecord {
    const proto = decodeRecordStructure(data);
    const record = new SessionRecord();
    if (proto.currentSession != null) {
      record._currentSession = SessionState.deserialize(proto.currentSession);
    }
    if (proto.previousSessions != null) {
      record._previousSessions = proto.previousSessions.map((s) => SessionState.deserialize(s));
    }
    return record;
  }

  /**
   * Check if a matching session already exists (by version + alice base key).
   * If found, promotes it and returns true; otherwise returns false.
   *
   * The incoming aliceBaseKey may be raw 32 bytes or 33-byte DJB-prefixed.
   * Stored keys are always 33-byte prefixed. We normalize before comparison.
   */
  promoteMatchingSession(version: number, aliceBaseKey: Uint8Array): boolean {
    // Normalize incoming key to 33-byte DJB-prefixed form for comparison
    const normalizedKey = SessionState.ensureDjbPrefix(aliceBaseKey);

    // Check current session
    if (this._currentSession != null) {
      const abk = this._currentSession.aliceBaseKey();
      if (
        abk != null &&
        this._currentSession.sessionVersion() === version &&
        bytesEqual(abk, normalizedKey)
      ) {
        return true;
      }
    }

    // Check previous sessions
    for (let i = 0; i < this._previousSessions.length; i++) {
      const state = this._previousSessions[i];
      const abk = state.aliceBaseKey();
      if (abk != null && state.sessionVersion() === version && bytesEqual(abk, normalizedKey)) {
        this.promoteOldSession(i, state);
        return true;
      }
    }

    return false;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
