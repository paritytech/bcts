/**
 * Common utilities for DKG commands.
 *
 * Port of cmd/dkg/common.rs from frost-hubert-rust.
 *
 * @module
 */

import * as path from "node:path";

import { type ARID, type XID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";
import { XIDDocument } from "@bcts/xid";

import { type Registry } from "../../registry/index.js";

/**
 * Parse an ARID from a UR string.
 *
 * Port of `parse_arid_ur()` from cmd/dkg/common.rs.
 */
export function parseAridUr(urString: string): ARID {
  const ur = UR.fromURString(urString.trim());

  if (ur.type !== "arid") {
    throw new Error(`Expected ur:arid, found ur:${ur.type}`);
  }

  const { ARID: ARIDClass } = require("@bcts/components");
  return ARIDClass.fromCbor(ur.cbor);
}

/**
 * Parse an envelope from a UR string.
 *
 * Port of `parse_envelope_ur()` from cmd/dkg/common.rs.
 */
export function parseEnvelopeUr(urString: string): Envelope {
  const ur = UR.fromURString(urString.trim());

  if (ur.type !== "envelope") {
    throw new Error(`Expected ur:envelope, found ur:${ur.type}`);
  }

  const { Envelope: EnvelopeClass } = require("@bcts/envelope");
  return EnvelopeClass.fromCbor(ur.cbor);
}

/**
 * Resolve the sender XID document from the registry.
 *
 * Port of `resolve_sender()` from cmd/dkg/common.rs.
 */
export function resolveSender(registry: Registry): XIDDocument {
  const owner = registry.owner();

  if (!owner) {
    throw new Error("No owner set in registry. Run 'registry owner set' first.");
  }

  return owner.xidDocument();
}

/**
 * Format a participant name with owner marker if applicable.
 *
 * Port of `format_name_with_owner_marker()` from cmd/dkg/common.rs.
 */
export function formatNameWithOwnerMarker(xid: XID, registry: Registry, petName?: string): string {
  const owner = registry.owner();
  const isOwner = owner && owner.xid().toString() === xid.toString();

  if (petName) {
    return isOwner ? `${petName} (you)` : petName;
  }

  const shortXid = xid.urString().slice(0, 20) + "...";
  return isOwner ? `${shortXid} (you)` : shortXid;
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
  const { SigningPublicKey: SigningPublicKeyClass } = require("@bcts/components");
  return SigningPublicKeyClass.fromBytes(verifyingKeyBytes);
}
