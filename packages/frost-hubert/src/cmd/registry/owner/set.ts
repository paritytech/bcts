/**
 * Registry owner set command.
 *
 * Port of cmd/registry/owner/set.rs from frost-hubert-rust.
 *
 * @module
 */

import { Registry, OwnerRecord, OwnerOutcome } from "../../../registry/index.js";
import { participantsFilePath } from "../index.js";

/**
 * Options for the owner set command.
 */
export interface OwnerSetOptions {
  /** Signed ur:xid document containing the owner's XID document (must include private keys) */
  xidDocument: string;
  /** Optional human readable alias for the owner */
  petName?: string;
  /** Optional registry path or filename override */
  registryPath?: string;
}

/**
 * Result of the owner set command.
 */
export interface OwnerSetResult {
  outcome: OwnerOutcome;
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
 * Execute the owner set command.
 *
 * Sets the registry owner using an ur:xid document that includes private keys.
 *
 * Port of `CommandArgs.exec()` from cmd/registry/owner/set.rs.
 */
export function ownerSet(options: OwnerSetOptions, cwd: string): OwnerSetResult {
  const petName = normalizePetName(options.petName);
  const owner = OwnerRecord.fromSignedXidUr(options.xidDocument, petName);
  const path = participantsFilePath(options.registryPath, cwd);
  const registry = Registry.load(path);

  const outcome = registry.setOwner(owner);

  if (outcome === OwnerOutcome.AlreadyPresent) {
    console.log("Owner already recorded");
  }

  // Always save to persist pet name updates on existing owner records.
  registry.save(path);

  return { outcome };
}
