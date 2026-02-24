/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Group record for the registry.
 *
 * Port of registry/group_record.rs from frost-hubert-rust.
 *
 * @module
 */

import { ARID, SigningPublicKey, XID } from "@bcts/components";

/**
 * A participant in a group.
 *
 * Port of `struct GroupParticipant` from group_record.rs lines 9-13.
 */
export class GroupParticipant {
  private readonly _xid: XID;

  constructor(xid: XID) {
    this._xid = xid;
  }

  xid(): XID {
    return this._xid;
  }

  toJSON(): string {
    return this._xid.urString();
  }

  static fromJSON(value: string): GroupParticipant {
    const xid = XID.fromURString(value);
    return new GroupParticipant(xid);
  }
}

/**
 * Contribution paths for DKG state files.
 *
 * Port of `struct ContributionPaths` from group_record.rs lines 21-29.
 */
export class ContributionPaths {
  round1Secret?: string | undefined;
  round1Package?: string | undefined;
  round2Secret?: string | undefined;
  keyPackage?: string | undefined;

  constructor(init?: Partial<ContributionPaths>) {
    if (init !== undefined) {
      this.round1Secret = init.round1Secret;
      this.round1Package = init.round1Package;
      this.round2Secret = init.round2Secret;
      this.keyPackage = init.keyPackage;
    }
  }

  /**
   * Merge missing fields from another ContributionPaths.
   *
   * Port of `ContributionPaths::merge_missing()` from group_record.rs lines 32-45.
   */
  mergeMissing(other: ContributionPaths): void {
    this.round1Secret ??= other.round1Secret;
    this.round1Package ??= other.round1Package;
    this.round2Secret ??= other.round2Secret;
    this.keyPackage ??= other.keyPackage;
  }

  /**
   * Check if all fields are empty.
   *
   * Port of `ContributionPaths::is_empty()` from group_record.rs lines 47-53.
   */
  isEmpty(): boolean {
    return (
      this.round1Secret === undefined &&
      this.round1Package === undefined &&
      this.round2Secret === undefined &&
      this.keyPackage === undefined
    );
  }

  toJSON(): Record<string, string> {
    const obj: Record<string, string> = {};
    if (this.round1Secret !== undefined) obj["round1_secret"] = this.round1Secret;
    if (this.round1Package !== undefined) obj["round1_package"] = this.round1Package;
    if (this.round2Secret !== undefined) obj["round2_secret"] = this.round2Secret;
    if (this.keyPackage !== undefined) obj["key_package"] = this.keyPackage;
    return obj;
  }

  static fromJSON(json: Record<string, string>): ContributionPaths {
    return new ContributionPaths({
      round1Secret: json["round1_secret"],
      round1Package: json["round1_package"],
      round2Secret: json["round2_secret"],
      keyPackage: json["key_package"],
    });
  }
}

/**
 * A pending request entry.
 */
interface PendingRequestEntry {
  participant: XID;
  sendToArid?: ARID | undefined;
  collectFromArid: ARID;
}

/**
 * Tracks pending communication with participants (coordinator-side).
 *
 * Port of `struct PendingRequests` from group_record.rs lines 71-75.
 */
export class PendingRequests {
  private readonly requests: PendingRequestEntry[] = [];

  /**
   * Add a pending request where we only know where to collect from.
   *
   * Port of `PendingRequests::add_collect_only()` from group_record.rs lines 90-99.
   */
  addCollectOnly(participant: XID, collectFromArid: ARID): void {
    this.requests.push({
      participant,
      sendToArid: undefined,
      collectFromArid,
    });
  }

  /**
   * Add a pending request where we know where to send AND where to collect.
   *
   * Port of `PendingRequests::add_send_and_collect()` from group_record.rs lines 103-115.
   */
  addSendAndCollect(participant: XID, sendToArid: ARID, collectFromArid: ARID): void {
    this.requests.push({
      participant,
      sendToArid,
      collectFromArid,
    });
  }

  /**
   * Add a pending request where we only know where to send.
   *
   * Port of `PendingRequests::add_send_only()` from group_record.rs lines 118-127.
   */
  addSendOnly(participant: XID, sendToArid: ARID): void {
    this.requests.push({
      participant,
      sendToArid,
      collectFromArid: sendToArid, // Placeholder
    });
  }

  /**
   * Check if there are no pending requests.
   *
   * Port of `PendingRequests::is_empty()` from group_record.rs line 129.
   */
  isEmpty(): boolean {
    return this.requests.length === 0;
  }

  /**
   * Get the number of pending requests.
   *
   * Port of `PendingRequests::len()` from group_record.rs line 165.
   */
  len(): number {
    return this.requests.length;
  }

  /**
   * Iterate over (participant, collectFromArid) pairs.
   *
   * Port of `PendingRequests::iter_collect()` from group_record.rs lines 132-138.
   */
  *iterCollect(): Generator<[XID, ARID]> {
    for (const r of this.requests) {
      yield [r.participant, r.collectFromArid];
    }
  }

  /**
   * Iterate over (participant, sendToArid) pairs.
   *
   * Port of `PendingRequests::iter_send()` from group_record.rs lines 141-150.
   */
  *iterSend(): Generator<[XID, ARID]> {
    for (const r of this.requests) {
      if (r.sendToArid === undefined) {
        throw new Error("send_to_arid not set for this request");
      }
      yield [r.participant, r.sendToArid];
    }
  }

  /**
   * Iterate over full (participant, sendToArid, collectFromArid) tuples.
   *
   * Port of `PendingRequests::iter_full()` from group_record.rs lines 153-163.
   */
  *iterFull(): Generator<[XID, ARID | undefined, ARID]> {
    for (const r of this.requests) {
      yield [r.participant, r.sendToArid, r.collectFromArid];
    }
  }

  toJSON(): unknown[] {
    return this.requests.map((r) => ({
      participant: r.participant.urString(),
      send_to_arid: r.sendToArid?.urString(),
      collect_from_arid: r.collectFromArid.urString(),
    }));
  }

  static fromJSON(json: unknown[]): PendingRequests {
    const pr = new PendingRequests();
    for (const entry of json as Record<string, string>[]) {
      const participant = XID.fromURString(entry["participant"]);
      const sendToArid =
        entry["send_to_arid"] !== undefined && entry["send_to_arid"] !== ""
          ? ARID.fromURString(entry["send_to_arid"])
          : undefined;
      const collectFromArid = ARID.fromURString(entry["collect_from_arid"]);
      pr.requests.push({ participant, sendToArid, collectFromArid });
    }
    return pr;
  }
}

/**
 * Record of a DKG group.
 *
 * Port of `struct GroupRecord` from group_record.rs lines 168-186.
 */
export class GroupRecord {
  private readonly _charter: string;
  private readonly _minSigners: number;
  private readonly _coordinator: GroupParticipant;
  private readonly _participants: GroupParticipant[];
  private _contributions: ContributionPaths;
  private _listeningAtArid?: ARID | undefined;
  private _pendingRequests: PendingRequests;
  private _verifyingKey?: SigningPublicKey | undefined;

  constructor(
    charter: string,
    minSigners: number,
    coordinator: GroupParticipant,
    participants: GroupParticipant[],
  ) {
    this._charter = charter;
    this._minSigners = minSigners;
    this._coordinator = coordinator;
    this._participants = participants;
    this._contributions = new ContributionPaths();
    this._listeningAtArid = undefined;
    this._pendingRequests = new PendingRequests();
    this._verifyingKey = undefined;
  }

  coordinator(): GroupParticipant {
    return this._coordinator;
  }

  participants(): GroupParticipant[] {
    return this._participants;
  }

  minSigners(): number {
    return this._minSigners;
  }

  charter(): string {
    return this._charter;
  }

  contributions(): ContributionPaths {
    return this._contributions;
  }

  setContributions(contributions: ContributionPaths): void {
    this._contributions = contributions;
  }

  mergeContributions(other: ContributionPaths): void {
    this._contributions.mergeMissing(other);
  }

  listeningAtArid(): ARID | undefined {
    return this._listeningAtArid;
  }

  setListeningAtArid(arid: ARID): void {
    this._listeningAtArid = arid;
  }

  clearListeningAtArid(): void {
    this._listeningAtArid = undefined;
  }

  pendingRequests(): PendingRequests {
    return this._pendingRequests;
  }

  setPendingRequests(requests: PendingRequests): void {
    this._pendingRequests = requests;
  }

  clearPendingRequests(): void {
    this._pendingRequests = new PendingRequests();
  }

  /**
   * Check if the config matches another group record.
   *
   * Port of `GroupRecord::config_matches()` from group_record.rs lines 247-253.
   */
  configMatches(other: GroupRecord): boolean {
    return (
      this._charter === other._charter &&
      this._minSigners === other._minSigners &&
      this._coordinator.xid().toString() === other._coordinator.xid().toString() &&
      this._participants.length === other._participants.length &&
      this._participants.every(
        (p, i) => p.xid().toString() === other._participants[i].xid().toString(),
      )
    );
  }

  verifyingKey(): SigningPublicKey | undefined {
    return this._verifyingKey;
  }

  setVerifyingKey(key: SigningPublicKey): void {
    this._verifyingKey = key;
  }

  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {
      charter: this._charter,
      min_signers: this._minSigners,
      coordinator: this._coordinator.toJSON(),
      participants: this._participants.map((p) => p.toJSON()),
    };
    if (!this._contributions.isEmpty()) {
      obj["contributions"] = this._contributions.toJSON();
    }
    if (this._listeningAtArid !== undefined) {
      obj["listening_at_arid"] = this._listeningAtArid.urString();
    }
    if (!this._pendingRequests.isEmpty()) {
      obj["pending_requests"] = this._pendingRequests.toJSON();
    }
    if (this._verifyingKey !== undefined) {
      obj["verifying_key"] = this._verifyingKey.urString();
    }
    return obj;
  }

  static fromJSON(json: Record<string, unknown>): GroupRecord {
    const charter = json["charter"] as string;
    const minSigners = json["min_signers"] as number;
    const coordinator = GroupParticipant.fromJSON(json["coordinator"] as string);
    const participants = (json["participants"] as string[]).map((p) =>
      GroupParticipant.fromJSON(p),
    );

    const record = new GroupRecord(charter, minSigners, coordinator, participants);

    if (json["contributions"] !== undefined) {
      record._contributions = ContributionPaths.fromJSON(
        json["contributions"] as Record<string, string>,
      );
    }
    if (json["listening_at_arid"] !== undefined) {
      record._listeningAtArid = ARID.fromURString(json["listening_at_arid"] as string);
    }
    if (json["pending_requests"] !== undefined) {
      record._pendingRequests = PendingRequests.fromJSON(json["pending_requests"] as unknown[]);
    }
    if (json["verifying_key"] !== undefined) {
      record._verifyingKey = SigningPublicKey.fromURString(json["verifying_key"] as string);
    }

    return record;
  }
}
