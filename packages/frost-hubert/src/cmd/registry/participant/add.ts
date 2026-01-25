/**
 * Registry participant add command.
 *
 * Port of cmd/registry/participant/add.rs from frost-hubert-rust.
 *
 * @module
 */

import { Registry, ParticipantRecord, AddOutcome } from "../../../registry/index.js";
import { participantsFilePath } from "../index.js";

/**
 * Options for the participant add command.
 */
export interface ParticipantAddOptions {
  /** Signed ur:xid document containing the participant's XID document */
  xidDocument: string;
  /** Optional human readable alias */
  petName?: string | undefined;
  /** Optional registry path or filename override */
  registryPath?: string | undefined;
}

/**
 * Result of the participant add command.
 */
export interface ParticipantAddResult {
  outcome: AddOutcome;
}

/**
 * Normalize pet name, trimming whitespace and validating non-empty.
 */
function normalizePetName(petName?: string): string | undefined {
  if (petName === undefined) {
    return undefined;
  }

  const trimmed = petName.trim();
  if (trimmed.length === 0) {
    throw new Error("Pet name cannot be empty");
  }

  return trimmed;
}

/**
 * Execute the participant add command.
 *
 * Adds a participant using an ur:xid document.
 *
 * Port of `CommandArgs.exec()` from cmd/registry/participant/add.rs.
 */
export function participantAdd(options: ParticipantAddOptions, cwd: string): ParticipantAddResult {
  const petName = normalizePetName(options.petName);
  const participant = ParticipantRecord.fromSignedXidUr(options.xidDocument, petName);
  const xid = participant.xid();
  const path = participantsFilePath(options.registryPath, cwd);
  const registry = Registry.load(path);

  const outcome = registry.addParticipant(xid, participant);

  if (outcome === AddOutcome.AlreadyPresent) {
    console.log("Participant already recorded");
  } else if (outcome === AddOutcome.Inserted) {
    registry.save(path);
  }

  return { outcome };
}
