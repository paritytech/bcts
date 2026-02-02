/**
 * Data types module - 1:1 port of data_types.rs
 *
 * Handles conversion of string arguments to Envelope objects.
 */

import { Envelope } from "@bcts/envelope";
import { type Cbor, CborDate, decodeCbor, toTaggedValue } from "@bcts/dcbor";
import { ARID, Digest, URI, UUID } from "@bcts/components";
import { UR } from "@bcts/uniform-resources";
import { KnownValue, KNOWN_VALUES } from "@bcts/known-values";
import { getGlobalTagsStore } from "@bcts/tags";

/**
 * Supported data types for envelope values.
 */
export enum DataType {
  /** ARID: Apparently Random Identifier (ur:arid) */
  Arid = "arid",
  /** Boolean (`true` or `false`) */
  Bool = "bool",
  /** CBOR data in hex */
  Cbor = "cbor",
  /** Binary byte string in hex */
  Data = "data",
  /** Date (ISO 8601) */
  Date = "date",
  /** Cryptographic digest (ur:digest) */
  Digest = "digest",
  /** Envelope (ur:envelope) */
  Envelope = "envelope",
  /** Known Value (number or string) */
  Known = "known",
  /** Numeric value */
  Number = "number",
  /** UTF-8 String */
  String = "string",
  /** Unit Known Value (deliberate emptiness, no value) */
  Unit = "unit",
  /** Uniform Resource (UR) */
  Ur = "ur",
  /** URI */
  Uri = "uri",
  /** UUID */
  Uuid = "uuid",
  /** Wrapped Envelope (ur:envelope) */
  Wrapped = "wrapped",
}

/**
 * Parse a string value into an Envelope based on the specified data type.
 */
export function parseDataTypeToEnvelope(
  dataType: DataType,
  value: string | undefined,
  urCborTagValue?: number | bigint,
): Envelope {
  // Unit is special: it takes no value and represents deliberate emptiness
  if (dataType === DataType.Unit) {
    return Envelope.unit();
  }

  if (value === undefined || value === "") {
    throw new Error("No value provided");
  }

  switch (dataType) {
    case DataType.Arid:
      return parseArid(value);
    case DataType.Bool:
      return parseBoolean(value);
    case DataType.Cbor:
      return parseCbor(value);
    case DataType.Data:
      return parseData(value);
    case DataType.Date:
      return parseDate(value);
    case DataType.Digest:
      return parseDigest(value);
    case DataType.Envelope:
      return parseEnvelope(value);
    case DataType.Known:
      return parseKnownValue(value);
    case DataType.Number:
      return parseNumber(value);
    case DataType.String:
      return parseString(value);
    case DataType.Ur:
      return parseUr(value, urCborTagValue);
    case DataType.Uri:
      return parseUri(value);
    case DataType.Uuid:
      return parseUuid(value);
    case DataType.Wrapped:
      return parseWrappedEnvelope(value);
  }
}

/**
 * Parse an ARID from a string.
 * Accepts either a hex-encoded ARID or a UR-encoded ARID.
 */
function parseArid(s: string): Envelope {
  // Try hex first
  try {
    const bytes = hexToBytes(s);
    const arid = ARID.fromData(bytes);
    return Envelope.new(arid);
  } catch {
    // Try UR
    try {
      const arid = ARID.fromURString(s);
      return Envelope.new(arid);
    } catch {
      throw new Error("Invalid ARID");
    }
  }
}

/**
 * Parse a boolean from a string.
 * Accepts either "true" or "false".
 */
function parseBoolean(s: string): Envelope {
  const lower = s.toLowerCase();
  if (lower === "true") {
    return Envelope.new(true);
  } else if (lower === "false") {
    return Envelope.new(false);
  } else {
    throw new Error(`Invalid boolean value: ${s}`);
  }
}

/**
 * Parse a CBOR value from a hex string into a leaf envelope.
 * Unlike parseEnvelope, this wraps raw CBOR as a leaf, not a tagged envelope.
 */
function parseCbor(s: string): Envelope {
  const bytes = hexToBytes(s);
  const cborValue = decodeCbor(bytes);
  return Envelope.newLeaf(cborValue);
}

/**
 * Parse a bytestring from a hex string.
 */
function parseData(s: string): Envelope {
  const bytes = hexToBytes(s);
  return Envelope.new(bytes);
}

/**
 * Parse a Date from an ISO 8601 string.
 */
function parseDate(s: string): Envelope {
  const date = CborDate.fromString(s);
  return Envelope.new(date);
}

/**
 * Parse a Digest from a ur:digest string.
 */
function parseDigest(s: string): Envelope {
  const digest = Digest.fromURString(s);
  return Envelope.new(digest);
}

/**
 * Parse an Envelope from a ur:envelope string.
 */
function parseEnvelope(s: string): Envelope {
  return Envelope.fromUrString(s);
}

/**
 * Parse a KnownValue from a string.
 * Accepts either an integer or a known value name.
 */
function parseKnownValue(s: string): Envelope {
  // Try parsing as number first
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 0) {
    return Envelope.new(new KnownValue(BigInt(num)));
  }

  // Try looking up by name
  const store = KNOWN_VALUES.get();
  const knownValue = store.knownValueNamed(s);
  if (knownValue) {
    return Envelope.new(knownValue);
  }

  throw new Error(`Unknown known value: ${s}`);
}

/**
 * Parse a numeric value from a string.
 */
function parseNumber(s: string): Envelope {
  const num = parseFloat(s);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${s}`);
  }
  // Use integer if possible
  if (Number.isInteger(num)) {
    return Envelope.new(num);
  }
  return Envelope.new(num);
}

/**
 * Parse a string value.
 */
function parseString(s: string): Envelope {
  return Envelope.new(s);
}

/**
 * Parse a UR from a string.
 *
 * - If the UR is a ur:envelope, acts like `type envelope`.
 * - If the UR is another type, attempts to look up the CBOR tag for
 *   the type and encodes the envelope with the tagged CBOR content of the UR.
 * - If the UR is of an unknown type, then a tag must be used to specify the
 *   CBOR tag to use.
 */
function parseUr(s: string, cborTagValue?: number | bigint): Envelope {
  const ur = UR.fromURString(s);
  if (ur.urTypeStr() === "envelope") {
    const envelope = Envelope.fromUR(ur);
    return envelope.wrap();
  }

  // Look up the CBOR tag for this UR type
  const tagsStore = getGlobalTagsStore();
  const tag = tagsStore.tagForName(ur.urTypeStr());
  const resolvedTagValue = tag?.value ?? cborTagValue;

  if (resolvedTagValue !== undefined) {
    const urCbor = ur.cbor();
    const tagged = toTaggedValue(resolvedTagValue, urCbor);
    return Envelope.newLeaf(tagged);
  }

  throw new Error(`Unknown UR type: ${ur.urTypeStr()}`);
}

/**
 * Parse a URI from a string.
 */
function parseUri(s: string): Envelope {
  const uri = URI.new(s);
  return Envelope.new(uri);
}

/**
 * Parse a UUID from a string.
 */
function parseUuid(s: string): Envelope {
  const uuid = UUID.fromString(s);
  return Envelope.new(uuid);
}

/**
 * Parse a wrapped envelope from a ur:envelope string.
 */
function parseWrappedEnvelope(s: string): Envelope {
  const envelope = Envelope.fromUrString(s);
  return envelope.wrap();
}

/**
 * Parse any UR into CBOR for use as structured data (e.g., provenance mark info).
 *
 * This function converts any UR type into a CBOR value:
 * - For known UR types (envelope, digest, etc.), looks up the CBOR tag from the tag store
 * - For unknown UR types, requires cborTagValue parameter
 * - Returns the UR's CBOR content wrapped in the appropriate CBOR tag
 */
export function parseUrToCbor(s: string, cborTagValue?: number | bigint): Cbor {
  const ur = UR.fromURString(s);

  // Look up the CBOR tag for this UR type
  const tagsStore = getGlobalTagsStore();
  const tag = tagsStore.tagForName(ur.urTypeStr());
  const resolvedTagValue = tag?.value ?? cborTagValue;

  if (resolvedTagValue !== undefined) {
    const urCbor = ur.cbor();
    return toTaggedValue(resolvedTagValue, urCbor);
  }

  throw new Error(
    `Unknown UR type: '${ur.urTypeStr()}'. Use --ur-tag to specify the CBOR tag value.`,
  );
}

/**
 * Helper to convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  // Remove any 0x prefix
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert bytes to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
