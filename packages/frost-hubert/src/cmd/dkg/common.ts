/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Common utilities for DKG commands.
 *
 * Port of cmd/dkg/common.rs from frost-hubert-rust.
 *
 * @module
 */

import * as path from "node:path";

import { type ARID, type XID } from "@bcts/components";
import { compareXidBytes } from "../../dkg/proposed-participant.js";
import { type Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";
import { type XIDDocument } from "@bcts/xid";

import {
  GroupParticipant,
  type OwnerRecord,
  type ParticipantRecord,
  type Registry,
} from "../../registry/index.js";

// Re-export cross-cutting utilities for convenience
export { groupStateDir } from "../common.js";

/**
 * Parse an ARID from a UR string.
 *
 * Mirrors Rust `parse_arid_ur` (`cmd/common.rs:27-43`):
 *
 * 1. Trim and reject empty input.
 * 2. Parse as a UR; require `ur_type` of `"arid"`.
 * 3. Try `ARID::try_from(cbor)` (the tagged-CBOR form).
 * 4. If that fails, fall back to interpreting the CBOR as a bare
 *    byte string and constructing the ARID from those bytes via
 *    `ARID::from_data_ref`.
 *
 * The earlier port only accepted the tagged form; this matches Rust
 * by accepting the byte-string fallback too.
 */
export function parseAridUr(urString: string): ARID {
  const trimmed = urString.trim();
  if (trimmed.length === 0) {
    throw new Error("ARID is required");
  }
  const ur = UR.fromURString(trimmed);

  if (ur.urTypeStr() !== "arid") {
    throw new Error(`Expected a ur:arid, found ur:${ur.urTypeStr()}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
  const { ARID: ARIDClass } = require("@bcts/components");
  const cbor = ur.cbor();
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return ARIDClass.fromTaggedCbor(cbor);
  } catch {
    // Fall back to a bare byte string payload, mirroring Rust's
    // `CBOR::try_into_byte_string(cbor) → ARID::from_data_ref(bytes)`.
    const bytes = (cbor as { asByteString(): Uint8Array | undefined }).asByteString?.();
    if (bytes === undefined) {
      throw new Error("Invalid ARID payload");
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return ARIDClass.fromData(bytes);
  }
}

/**
 * Parse an envelope from a UR string.
 *
 * Port of `parse_envelope_ur()` from cmd/dkg/common.rs.
 */
export function parseEnvelopeUr(urString: string): Envelope {
  const ur = UR.fromURString(urString.trim());

  if (ur.urTypeStr() !== "envelope") {
    throw new Error(`Expected ur:envelope, found ur:${ur.urTypeStr()}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
  const { Envelope: EnvelopeClass } = require("@bcts/envelope");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return EnvelopeClass.fromCbor(ur.cbor());
}

/**
 * Resolve the registry owner's XID document.
 *
 * The earlier port called this `resolveSender(registry)`, but its
 * behaviour — "give me the owner" — has nothing in common with Rust's
 * `resolve_sender(registry, input)` (which resolves an arbitrary
 * named sender). This helper is renamed to its actual behaviour;
 * the Rust-equivalent `resolveSender(registry, input)` lives below.
 */
export function resolveOwnerXidDocument(registry: Registry): XIDDocument {
  const owner = registry.owner();

  if (!owner) {
    throw new Error("No owner set in registry. Run 'registry owner set' first.");
  }

  return owner.xidDocument();
}

/**
 * Resolve a sender XID document from the registry by UR or pet name.
 *
 * Mirrors Rust `resolve_sender(registry, input)`
 * (`cmd/dkg/common.rs:76-94`):
 *
 * 1. Trim and reject empty input.
 * 2. Try parsing the input as a `ur:xid`. If that succeeds, look it
 *    up via `registry.participant(xid)`; if no record is found,
 *    error with `Sender with XID {ur} not found`.
 * 3. Otherwise look it up by pet name via
 *    `registry.participantByPetName(name)`; if no record is found,
 *    error with `Sender with pet name '{name}' not found`.
 *
 * Note Rust does NOT check the owner here — only the participants
 * map. The earlier inline duplicate in `participant/round1.ts` did
 * an extra owner-check fallback which is removed to match Rust.
 */
export function resolveSender(registry: Registry, input: string): XIDDocument {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Sender is required");
  }

  // Try parsing as an XID UR string first. `XID.fromURString` throws
  // when the input isn't a `ur:xid`; that's the signal to fall back
  // to pet-name lookup.
  let xid: XID | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
    const { XID: XIDClass } = require("@bcts/components");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    xid = XIDClass.fromURString(trimmed) as XID;
  } catch {
    xid = undefined;
  }

  if (xid !== undefined) {
    const record = registry.participant(xid);
    if (record !== undefined) {
      return record.xidDocument();
    }
    throw new Error(`Sender with XID ${xid.urString()} not found`);
  }

  const result = registry.participantByPetName(trimmed);
  if (result !== undefined) {
    const [, record] = result;
    return record.xidDocument();
  }
  throw new Error(`Sender with pet name '${trimmed}' not found`);
}

// -----------------------------------------------------------------------------
// Participant resolution
// -----------------------------------------------------------------------------

/**
 * Resolve participant identifiers (XID URs or pet names) to records.
 *
 * Port of `resolve_participants()` from cmd/dkg/common.rs lines 29-74.
 */
export function resolveParticipants(
  registry: Registry,
  inputs: string[],
): [XID, ParticipantRecord][] {
  const seenArgs = new Set<string>();
  const seenXids = new Set<string>();
  const resolved: [XID, ParticipantRecord][] = [];

  for (const raw of inputs) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      throw new Error("Participant identifier cannot be empty");
    }
    if (seenArgs.has(trimmed)) {
      throw new Error(`Duplicate participant argument: ${trimmed}`);
    }
    seenArgs.add(trimmed);

    let xid: XID;
    let record: ParticipantRecord;

    // Try parsing as XID UR first
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
      const { XID: XIDClass } = require("@bcts/components");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      xid = XIDClass.fromURString(trimmed) as XID;

      const foundRecord = registry.participant(xid);
      if (!foundRecord) {
        throw new Error(`Participant with XID ${xid.urString()} not found in registry`);
      }
      record = foundRecord;
    } catch {
      // Try looking up by pet name
      const result = registry.participantByPetName(trimmed);
      if (!result) {
        throw new Error(`Participant with pet name '${trimmed}' not found`);
      }
      [xid, record] = result;
    }

    const xidUr = xid.urString();
    if (seenXids.has(xidUr)) {
      throw new Error(`Duplicate participant specified; multiple inputs resolve to ${xidUr}`);
    }
    seenXids.add(xidUr);

    resolved.push([xid, record]);
  }

  return resolved;
}

/**
 * Get display name for sender from registry.
 *
 * Port of `resolve_sender_name()` from cmd/dkg/common.rs lines 96-116.
 */
export function resolveSenderName(registry: Registry, sender: XIDDocument): string | undefined {
  const owner = registry.owner();
  const senderXid = sender.xid();

  // Check if sender is the owner
  if (owner?.xidDocument().xid().urString() === senderXid.urString()) {
    const name = owner.petName() ?? senderXid.urString();
    return formatNameWithOwnerMarker(name, true);
  }

  // Look up in participants
  const record = registry.participant(senderXid);
  if (record) {
    const name = record.petName() ?? record.xid().urString();
    return formatNameWithOwnerMarker(name, false);
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// Group participant building
// -----------------------------------------------------------------------------

/**
 * Build GroupParticipant[] from XIDDocuments using registry lookups.
 *
 * Port of `build_group_participants()` from cmd/dkg/common.rs lines 122-131.
 */
export function buildGroupParticipants(
  registry: Registry,
  owner: OwnerRecord,
  participants: XIDDocument[],
): GroupParticipant[] {
  return participants.map((doc) => groupParticipantFromRegistry(registry, owner, doc));
}

/**
 * Create a GroupParticipant from a XIDDocument, validating against the registry.
 *
 * Port of `group_participant_from_registry()` from cmd/dkg/common.rs lines 133-149.
 */
export function groupParticipantFromRegistry(
  registry: Registry,
  owner: OwnerRecord,
  document: XIDDocument,
): GroupParticipant {
  const xid = document.xid();

  // If the document is the owner, allow it
  if (xid.urString() === owner.xid().urString()) {
    return new GroupParticipant(xid);
  }

  // Otherwise, verify the participant is in the registry
  if (!registry.participant(xid)) {
    throw new Error(`Invite participant not found in registry: ${xid.urString()}`);
  }

  return new GroupParticipant(xid);
}

// -----------------------------------------------------------------------------
// Name formatting
// -----------------------------------------------------------------------------

/**
 * Format a participant name with owner marker if applicable.
 *
 * Port of `format_name_with_owner_marker()` from cmd/dkg/common.rs lines 155-157.
 */
export function formatNameWithOwnerMarker(name: string, isOwner: boolean): string {
  return isOwner ? `* ${name}` : name;
}

/**
 * Get display names for participants, sorted by XID, with owner marked.
 *
 * Port of `participant_names_from_registry()` from cmd/dkg/common.rs lines 159-191.
 */
export function participantNamesFromRegistry(
  registry: Registry,
  participants: XIDDocument[],
  ownerXid: XID,
  ownerPetName: string | undefined,
): string[] {
  // Sort by XID byte order — mirrors Rust `XID::cmp` (raw 32-byte
  // lex compare). The earlier port used
  // `urString().localeCompare(...)`, which diverges from byte order
  // for bytes ≥ 0x80 and is locale-aware.
  const sorted = [...participants].sort((a, b) =>
    compareXidBytes(a.xid().toData(), b.xid().toData()),
  );

  return sorted.map((document) => {
    const xid = document.xid();
    const isOwner = xid.urString() === ownerXid.urString();

    let name: string;
    if (isOwner) {
      name = ownerPetName ?? xid.urString();
    } else {
      const record = registry.participant(xid);
      if (!record) {
        throw new Error(`Invite participant not found in registry: ${xid.urString()}`);
      }
      name = record.petName() ?? xid.urString();
    }

    return formatNameWithOwnerMarker(name, isOwner);
  });
}

/**
 * Get the DKG state directory for a given registry path and group ID.
 *
 * Port of `dkg_state_dir()` from cmd/dkg/common.rs.
 */
export function dkgStateDir(registryPath: string, groupIdHex: string): string {
  const base = path.dirname(registryPath);
  return path.join(base, "group-state", groupIdHex, "dkg");
}

/**
 * Convert a verifying key bytes to a SigningPublicKey.
 *
 * Port of `signing_key_from_verifying()` from cmd/dkg/common.rs.
 */
export function signingKeyFromVerifying(verifyingKeyBytes: Uint8Array): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
  const { SigningPublicKey: SigningPublicKeyClass } = require("@bcts/components");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return SigningPublicKeyClass.fromBytes(verifyingKeyBytes);
}
