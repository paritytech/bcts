/**
 * Seed parsing - 1:1 port of seed.rs
 *
 * Functions for parsing provenance seeds from various formats.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { UR } from "@bcts/uniform-resources";
import { Seed } from "@bcts/components";
import { ProvenanceSeed, PROVENANCE_SEED_LENGTH } from "@bcts/provenance-mark";
import { fromBase64, hexToBytes } from "../utils.js";

/**
 * Parse a seed from a string.
 *
 * Supports the following formats:
 * - `ur:seed/...` - UR-encoded seed
 * - `0x...` or hex string - Hex-encoded seed
 * - Base64 string - Base64-encoded seed
 *
 * Corresponds to Rust `parse_seed()`
 */
export function parseSeed(input: string): ProvenanceSeed {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("seed string is empty");
  }

  // Try UR format first
  if (trimmed.toLowerCase().startsWith("ur:")) {
    return parseSeedUr(trimmed);
  }

  // Try hex format
  const hexResult = parseSeedHex(trimmed);
  if (hexResult !== undefined) {
    return hexResult;
  }

  // Fall back to base64
  return parseSeedBase64(trimmed);
}

/**
 * Parse a seed from a UR string.
 *
 * Corresponds to Rust `parse_seed_ur()`
 */
function parseSeedUr(input: string): ProvenanceSeed {
  try {
    const ur = UR.fromURString(input);
    const seed = Seed.fromUr(ur);
    return seedFromExact(seed.data());
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`failed to parse seed UR: ${message}`);
  }
}

/**
 * Parse a seed from a hex string.
 *
 * Returns undefined if the string is not valid hex format.
 *
 * Corresponds to Rust `parse_seed_hex()`
 */
function parseSeedHex(input: string): ProvenanceSeed | undefined {
  const source = input.startsWith("0x") ? input.slice(2) : input;
  if (source === "") {
    return undefined;
  }

  // Check if it's valid hex
  if (source.length % 2 !== 0) {
    return undefined;
  }
  if (!/^[0-9a-fA-F]+$/.test(source)) {
    return undefined;
  }

  try {
    const bytes = hexToBytes(source);
    return seedFromExact(bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`failed to decode hex seed: ${message}`);
  }
}

/**
 * Parse a seed from a base64 string.
 *
 * Corresponds to Rust `parse_seed_base64()`
 */
function parseSeedBase64(input: string): ProvenanceSeed {
  try {
    const bytes = fromBase64(input);
    return seedFromExact(bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`failed to decode base64 seed: ${message}`);
  }
}

/**
 * Create a seed from exactly PROVENANCE_SEED_LENGTH bytes.
 *
 * Corresponds to Rust `seed_from_exact()`
 */
function seedFromExact(bytes: Uint8Array): ProvenanceSeed {
  if (bytes.length !== PROVENANCE_SEED_LENGTH) {
    throw new Error(
      `seed must be ${PROVENANCE_SEED_LENGTH} bytes but found ${bytes.length}`,
    );
  }
  return ProvenanceSeed.fromBytes(bytes);
}
