/**
 * Info args - 1:1 port of info.rs
 *
 * Shared arguments for supplying provenance mark `info` payloads.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { type Cbor, cbor, decodeCbor, expectTag } from "@bcts/dcbor";
import { UR } from "@bcts/uniform-resources";
import { tagForName } from "@bcts/tags";
import { hexToBytes } from "../utils.js";

/**
 * Arguments for info payload.
 *
 * Corresponds to Rust `InfoArgs`
 */
export interface InfoArgs {
  /** Hex-encoded dCBOR or UR payload to embed in the mark's `info` field. */
  info?: string;
  /** CBOR tag value to associate with an unknown UR type. */
  infoTag?: number;
}

/**
 * Parse info args to CBOR.
 *
 * Corresponds to Rust `InfoArgs::to_cbor()`
 */
export function parseInfoArgs(args: InfoArgs): Cbor | undefined {
  if (args.info !== undefined) {
    return parseInfo(args.info, args.infoTag);
  }

  if (args.infoTag !== undefined) {
    throw new Error("--info-tag requires a UR payload");
  }

  return undefined;
}

/**
 * Parse hex-encoded CBOR.
 *
 * Corresponds to Rust `parse_hex()`
 */
function parseHex(input: string): Cbor {
  const trimmed = input.trim();
  const hexStr = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;

  try {
    const bytes = hexToBytes(hexStr);
    return decodeCbor(bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`failed to decode hex info payload: ${message}`);
  }
}

/**
 * Parse info payload from raw string.
 *
 * Corresponds to Rust `parse_info()`
 */
function parseInfo(raw: string, tagOverride?: number): Cbor {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error("info payload must not be empty");
  }

  // Check if it's a UR
  if (trimmed.length >= 3 && trimmed.slice(0, 3).toLowerCase() === "ur:") {
    return parseUrPayload(trimmed, tagOverride);
  }

  // Try hex first
  try {
    const cborResult = parseHex(trimmed);
    if (tagOverride !== undefined) {
      throw new Error("--info-tag is only valid when the payload is a UR");
    }
    return cborResult;
  } catch (hexErr) {
    // Try as UR fallback
    try {
      return parseUrPayload(trimmed, tagOverride);
    } catch (urErr) {
      const hexMsg = hexErr instanceof Error ? hexErr.message : String(hexErr);
      const urMsg = urErr instanceof Error ? urErr.message : String(urErr);
      throw new Error(
        `failed to parse --info payload as hex (${hexMsg}) or UR (${urMsg})`,
      );
    }
  }
}

/**
 * Parse UR payload.
 *
 * Corresponds to Rust `parse_ur_payload()`
 */
function parseUrPayload(input: string, tagOverride?: number): Cbor {
  let ur: UR;
  try {
    ur = UR.fromURString(input.trim());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`failed to parse UR info payload: ${message}`);
  }

  const typeStr = ur.urTypeStr();

  // Check if we have a registered tag for this UR type
  const registeredTag = tagForName(typeStr);

  if (registeredTag !== undefined && tagOverride !== undefined) {
    throw new Error(
      `UR type '${typeStr}' has a known CBOR tag; --info-tag must not be supplied`,
    );
  }

  const expectedTag = registeredTag ?? tagOverride;
  if (expectedTag === undefined) {
    throw new Error(
      `UR type '${typeStr}' is not registered; supply --info-tag with the CBOR tag value`,
    );
  }

  const cborValue = ur.cbor();
  return ensureTag(cborValue, expectedTag, typeStr);
}

/**
 * Ensure CBOR has the expected tag.
 *
 * Corresponds to Rust `ensure_tag()`
 */
function ensureTag(cborValue: Cbor, expectedTag: number, typeStr: string): Cbor {
  // Check if already tagged
  try {
    const [tag, _inner] = expectTag(cborValue);
    if (tag !== expectedTag) {
      throw new Error(
        `UR type '${typeStr}' encodes CBOR tag ${tag} but ${expectedTag} was expected`,
      );
    }
    // Return as-is if already properly tagged
    return cborValue;
  } catch {
    // Not tagged, wrap it
    return cbor({ tag: expectedTag, value: cborValue });
  }
}
