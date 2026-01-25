/**
 * Registry implementation for managing participants and groups.
 *
 * Port of registry/registry_impl.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type XID } from "@bcts/components";

import { GroupRecord } from "./group-record.js";
import { OwnerRecord } from "./owner-record.js";
import { ParticipantRecord } from "./participant-record.js";

/**
 * Outcome of adding a participant to the registry.
 *
 * Port of `enum AddOutcome` from registry_impl.rs.
 */
export enum AddOutcome {
  /** Participant was already present in the registry */
  AlreadyPresent = "already_present",
  /** Participant was successfully inserted */
  Inserted = "inserted",
}

/**
 * Outcome of setting the owner in the registry.
 *
 * Port of `enum OwnerOutcome` from registry_impl.rs.
 */
export enum OwnerOutcome {
  /** Owner was already present in the registry */
  AlreadyPresent = "already_present",
  /** Owner was successfully inserted */
  Inserted = "inserted",
}

/**
 * Registry for managing participants and groups.
 *
 * Port of `struct Registry` from registry_impl.rs lines 22-26.
 */
export class Registry {
  private _owner?: OwnerRecord;
  private readonly _participants: Map<string, ParticipantRecord>; // Map by XID UR string
  private readonly _groups: Map<string, GroupRecord>; // Map by ARID hex

  constructor() {
    this._owner = undefined;
    this._participants = new Map();
    this._groups = new Map();
  }

  /**
   * Get the owner record.
   */
  owner(): OwnerRecord | undefined {
    return this._owner;
  }

  /**
   * Set the owner record.
   *
   * Returns the outcome indicating whether the owner was already present or newly inserted.
   */
  setOwner(owner: OwnerRecord): OwnerOutcome {
    if (this._owner !== undefined) {
      const existingXid = this._owner.xid();
      const newXid = owner.xid();
      if (existingXid.urString() === newXid.urString()) {
        return OwnerOutcome.AlreadyPresent;
      }
    }

    this._owner = owner;
    return OwnerOutcome.Inserted;
  }

  /**
   * Get all participants.
   */
  participants(): Map<string, ParticipantRecord> {
    return this._participants;
  }

  /**
   * Get a participant by XID.
   */
  participant(xid: XID): ParticipantRecord | undefined {
    return this._participants.get(xid.urString());
  }

  /**
   * Add a participant.
   *
   * Returns the outcome indicating whether the participant was already present or newly inserted.
   */
  addParticipant(xid: XID, record: ParticipantRecord): AddOutcome {
    const xidUr = xid.urString();

    // Check if already present
    if (this._participants.has(xidUr)) {
      return AddOutcome.AlreadyPresent;
    }

    // Check for conflicting pet name
    const petName = record.petName();
    if (petName !== undefined && this.petNameExists(petName)) {
      throw new Error(`Pet name "${petName}" is already used by another participant`);
    }

    this._participants.set(xidUr, record);
    return AddOutcome.Inserted;
  }

  /**
   * Check if a pet name is already used.
   */
  petNameExists(petName: string): boolean {
    for (const record of this._participants.values()) {
      if (record.petName() === petName) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all groups.
   */
  groups(): Map<string, GroupRecord> {
    return this._groups;
  }

  /**
   * Get a group by ARID.
   */
  group(arid: ARID): GroupRecord | undefined {
    return this._groups.get(arid.hex());
  }

  /**
   * Get a mutable reference to a group by ARID.
   */
  groupMut(arid: ARID): GroupRecord | undefined {
    return this._groups.get(arid.hex());
  }

  /**
   * Add a group.
   */
  addGroup(arid: ARID, record: GroupRecord): void {
    this._groups.set(arid.hex(), record);
  }

  /**
   * Load a registry from a file.
   */
  static load(filePath: string): Registry {
    if (!fs.existsSync(filePath)) {
      return new Registry();
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(content) as Record<string, unknown>;
    return Registry.fromJSON(json);
  }

  /**
   * Save the registry to a file.
   */
  save(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const json = this.toJSON();
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
  }

  /**
   * Serialize to JSON object.
   */
  toJSON(): Record<string, unknown> {
    const participants: Record<string, unknown> = {};
    for (const [xidUr, record] of this._participants) {
      participants[xidUr] = record.toJSON();
    }

    const groups: Record<string, unknown> = {};
    for (const [aridHex, record] of this._groups) {
      groups[aridHex] = record.toJSON();
    }

    const obj: Record<string, unknown> = {
      groups,
      participants,
    };

    if (this._owner !== undefined) {
      obj.owner = this._owner.toJSON();
    }

    return obj;
  }

  /**
   * Deserialize from JSON object.
   */
  static fromJSON(json: Record<string, unknown>): Registry {
    const registry = new Registry();

    if (json.owner !== undefined) {
      registry._owner = OwnerRecord.fromJSON(json.owner as Record<string, unknown>);
    }

    const participantsJson = json.participants as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (participantsJson !== undefined) {
      for (const [, recordJson] of Object.entries(participantsJson)) {
        const record = ParticipantRecord.fromJSON(recordJson);
        registry._participants.set(record.xid().urString(), record);
      }
    }

    const groupsJson = json.groups as Record<string, Record<string, unknown>> | undefined;
    if (groupsJson !== undefined) {
      for (const [aridHex, recordJson] of Object.entries(groupsJson)) {
        const record = GroupRecord.fromJSON(recordJson);
        registry._groups.set(aridHex, record);
      }
    }

    return registry;
  }
}

/**
 * Resolve the registry file path from a given argument.
 *
 * Port of `resolve_registry_path()` from registry/mod.rs lines 49-78.
 */
export function resolveRegistryPath(registryArg: string | undefined, cwd: string): string {
  if (registryArg === undefined || registryArg === "") {
    return path.join(cwd, "registry.json");
  }

  // If it ends with / or is a directory, append registry.json
  if (registryArg.endsWith("/") || registryArg.endsWith(path.sep)) {
    return path.join(cwd, registryArg, "registry.json");
  }

  // If it's just a filename, put it in cwd
  if (!registryArg.includes("/") && !registryArg.includes(path.sep)) {
    return path.join(cwd, registryArg);
  }

  // Otherwise, treat as relative path
  return path.resolve(cwd, registryArg);
}
