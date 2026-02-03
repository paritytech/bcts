/**
 * Composable for registry data from @bcts/tags and @bcts/known-values
 *
 * This composable imports the actual tag and known value definitions from the
 * source packages and adds category metadata for display purposes.
 */

import type { Tag } from "@bcts/dcbor";
import * as tags from "@bcts/tags";
import { loadBundledRegistries } from "@bcts/known-values";

export interface TagItem {
  value: number;
  name: string;
  category: string;
  deprecated?: boolean;
}

export interface KnownValueItem {
  value: number;
  name: string;
  category: string;
}

// Category mappings for tags (by tag value)
const tagCategories: Record<number, { category: string; deprecated?: boolean }> = {
  // Standard IANA
  32: { category: "Standard IANA" },
  37: { category: "Standard IANA" },

  // Core Envelope
  24: { category: "Core Envelope" },
  200: { category: "Core Envelope" },
  201: { category: "Core Envelope" },
  262: { category: "Core Envelope" },

  // Envelope Extensions
  40000: { category: "Envelope Extension" },
  40001: { category: "Envelope Extension" },
  40002: { category: "Envelope Extension" },
  40003: { category: "Envelope Extension" },

  // Function Calls
  40004: { category: "Function Calls" },
  40005: { category: "Function Calls" },
  40006: { category: "Function Calls" },
  40007: { category: "Function Calls" },
  40008: { category: "Function Calls" },
  40009: { category: "Function Calls" },

  // Cryptography
  40010: { category: "Cryptography" },
  40011: { category: "Cryptography" },
  40012: { category: "Cryptography" },
  40013: { category: "Cryptography" },
  40014: { category: "Cryptography" },
  40015: { category: "Cryptography" },
  40016: { category: "Cryptography" },
  40017: { category: "Cryptography" },
  40018: { category: "Cryptography" },
  40019: { category: "Cryptography" },
  40020: { category: "Cryptography" },
  40021: { category: "Cryptography" },
  40022: { category: "Cryptography" },
  40023: { category: "Cryptography" },
  40024: { category: "Cryptography" },
  40025: { category: "Cryptography" },
  40026: { category: "Cryptography" },
  40027: { category: "Cryptography" },

  // Post-Quantum
  40100: { category: "Post-Quantum" },
  40101: { category: "Post-Quantum" },
  40102: { category: "Post-Quantum" },
  40103: { category: "Post-Quantum" },
  40104: { category: "Post-Quantum" },
  40105: { category: "Post-Quantum" },

  // Seeds & Keys
  40300: { category: "Seeds & Keys" },
  40303: { category: "Seeds & Keys" },
  40304: { category: "Seeds & Keys" },
  40305: { category: "Seeds & Keys" },
  40306: { category: "Seeds & Keys" },
  40307: { category: "Seeds & Keys" },
  40308: { category: "Seeds & Keys" },
  40309: { category: "Seeds & Keys" },
  40310: { category: "Seeds & Keys" },
  40311: { category: "Seeds & Keys" },

  // SSH
  40800: { category: "SSH" },
  40801: { category: "SSH" },
  40802: { category: "SSH" },
  40803: { category: "SSH" },

  // Provenance
  1347571542: { category: "Provenance" },

  // Deprecated
  300: { category: "Deprecated", deprecated: true },
  303: { category: "Deprecated", deprecated: true },
  304: { category: "Deprecated", deprecated: true },
  305: { category: "Deprecated", deprecated: true },
  306: { category: "Deprecated", deprecated: true },
  307: { category: "Deprecated", deprecated: true },
  309: { category: "Deprecated", deprecated: true },
  310: { category: "Deprecated", deprecated: true },
  311: { category: "Deprecated", deprecated: true },

  // Output Descriptors
  400: { category: "Output Descriptors" },
  401: { category: "Output Descriptors" },
  402: { category: "Output Descriptors" },
  403: { category: "Output Descriptors" },
  404: { category: "Output Descriptors" },
  405: { category: "Output Descriptors" },
  406: { category: "Output Descriptors" },
  407: { category: "Output Descriptors" },
  408: { category: "Output Descriptors" },
  409: { category: "Output Descriptors" },
  410: { category: "Output Descriptors" },
};

// Category mappings for known values (by value ranges matching registry files)
function getKnownValueCategory(value: number): string {
  // Blockchain Commons registry (0-999) — use fine-grained sub-categories
  if (value < 1000) {
    if (value <= 24) return "General";
    if (value >= 50 && value <= 52) return "Attachments";
    if (value >= 60 && value <= 68) return "XID Documents";
    if (value >= 70 && value <= 86) return "XID Privileges";
    if (value >= 100 && value <= 108) return "Expressions";
    if (value >= 200 && value <= 203) return "Cryptography";
    if (value >= 300 && value <= 303) return "Crypto Assets";
    if (value >= 400 && value <= 402) return "Networks";
    if (value >= 500 && value <= 508) return "Bitcoin";
    if (value >= 600 && value <= 705) return "Graphs";
    return "General";
  }
  // Ontology registries (by start_code_point ranges)
  if (value < 2000) return "Community";
  if (value < 2050) return "RDF";
  if (value < 2100) return "RDFS";
  if (value < 2200) return "OWL2";
  if (value < 2300) return "DCE";
  if (value < 2500) return "DCT";
  if (value < 2700) return "FOAF";
  if (value < 2800) return "SKOS";
  if (value < 2900) return "Solid";
  if (value < 3000) return "VC";
  if (value < 10000) return "GS1";
  if (value < 100000) return "Schema";
  return "Community";
}

// Build tags data from the @bcts/tags package
function buildTagsData(): TagItem[] {
  const tagExports: Array<{ tag: Tag; exportName: string }> = [
    { tag: tags.URI, exportName: "URI" },
    { tag: tags.UUID, exportName: "UUID" },
    { tag: tags.ENCODED_CBOR, exportName: "ENCODED_CBOR" },
    { tag: tags.ENVELOPE, exportName: "ENVELOPE" },
    { tag: tags.LEAF, exportName: "LEAF" },
    { tag: tags.JSON, exportName: "JSON" },
    { tag: tags.KNOWN_VALUE, exportName: "KNOWN_VALUE" },
    { tag: tags.DIGEST, exportName: "DIGEST" },
    { tag: tags.ENCRYPTED, exportName: "ENCRYPTED" },
    { tag: tags.COMPRESSED, exportName: "COMPRESSED" },
    { tag: tags.REQUEST, exportName: "REQUEST" },
    { tag: tags.RESPONSE, exportName: "RESPONSE" },
    { tag: tags.FUNCTION, exportName: "FUNCTION" },
    { tag: tags.PARAMETER, exportName: "PARAMETER" },
    { tag: tags.PLACEHOLDER, exportName: "PLACEHOLDER" },
    { tag: tags.REPLACEMENT, exportName: "REPLACEMENT" },
    { tag: tags.X25519_PRIVATE_KEY, exportName: "X25519_PRIVATE_KEY" },
    { tag: tags.X25519_PUBLIC_KEY, exportName: "X25519_PUBLIC_KEY" },
    { tag: tags.ARID, exportName: "ARID" },
    { tag: tags.PRIVATE_KEYS, exportName: "PRIVATE_KEYS" },
    { tag: tags.NONCE, exportName: "NONCE" },
    { tag: tags.PASSWORD, exportName: "PASSWORD" },
    { tag: tags.PRIVATE_KEY_BASE, exportName: "PRIVATE_KEY_BASE" },
    { tag: tags.PUBLIC_KEYS, exportName: "PUBLIC_KEYS" },
    { tag: tags.SALT, exportName: "SALT" },
    { tag: tags.SEALED_MESSAGE, exportName: "SEALED_MESSAGE" },
    { tag: tags.SIGNATURE, exportName: "SIGNATURE" },
    { tag: tags.SIGNING_PRIVATE_KEY, exportName: "SIGNING_PRIVATE_KEY" },
    { tag: tags.SIGNING_PUBLIC_KEY, exportName: "SIGNING_PUBLIC_KEY" },
    { tag: tags.SYMMETRIC_KEY, exportName: "SYMMETRIC_KEY" },
    { tag: tags.XID, exportName: "XID" },
    { tag: tags.REFERENCE, exportName: "REFERENCE" },
    { tag: tags.EVENT, exportName: "EVENT" },
    { tag: tags.ENCRYPTED_KEY, exportName: "ENCRYPTED_KEY" },
    { tag: tags.MLKEM_PRIVATE_KEY, exportName: "MLKEM_PRIVATE_KEY" },
    { tag: tags.MLKEM_PUBLIC_KEY, exportName: "MLKEM_PUBLIC_KEY" },
    { tag: tags.MLKEM_CIPHERTEXT, exportName: "MLKEM_CIPHERTEXT" },
    { tag: tags.MLDSA_PRIVATE_KEY, exportName: "MLDSA_PRIVATE_KEY" },
    { tag: tags.MLDSA_PUBLIC_KEY, exportName: "MLDSA_PUBLIC_KEY" },
    { tag: tags.MLDSA_SIGNATURE, exportName: "MLDSA_SIGNATURE" },
    { tag: tags.SEED, exportName: "SEED" },
    { tag: tags.HDKEY, exportName: "HDKEY" },
    { tag: tags.DERIVATION_PATH, exportName: "DERIVATION_PATH" },
    { tag: tags.USE_INFO, exportName: "USE_INFO" },
    { tag: tags.EC_KEY, exportName: "EC_KEY" },
    { tag: tags.ADDRESS, exportName: "ADDRESS" },
    { tag: tags.OUTPUT_DESCRIPTOR, exportName: "OUTPUT_DESCRIPTOR" },
    { tag: tags.SSKR_SHARE, exportName: "SSKR_SHARE" },
    { tag: tags.PSBT, exportName: "PSBT" },
    { tag: tags.ACCOUNT_DESCRIPTOR, exportName: "ACCOUNT_DESCRIPTOR" },
    { tag: tags.SSH_TEXT_PRIVATE_KEY, exportName: "SSH_TEXT_PRIVATE_KEY" },
    { tag: tags.SSH_TEXT_PUBLIC_KEY, exportName: "SSH_TEXT_PUBLIC_KEY" },
    { tag: tags.SSH_TEXT_SIGNATURE, exportName: "SSH_TEXT_SIGNATURE" },
    { tag: tags.SSH_TEXT_CERTIFICATE, exportName: "SSH_TEXT_CERTIFICATE" },
    { tag: tags.PROVENANCE_MARK, exportName: "PROVENANCE_MARK" },
    // Deprecated tags
    { tag: tags.SEED_V1, exportName: "SEED_V1" },
    { tag: tags.EC_KEY_V1, exportName: "EC_KEY_V1" },
    { tag: tags.SSKR_SHARE_V1, exportName: "SSKR_SHARE_V1" },
    { tag: tags.HDKEY_V1, exportName: "HDKEY_V1" },
    { tag: tags.DERIVATION_PATH_V1, exportName: "DERIVATION_PATH_V1" },
    { tag: tags.USE_INFO_V1, exportName: "USE_INFO_V1" },
    { tag: tags.OUTPUT_DESCRIPTOR_V1, exportName: "OUTPUT_DESCRIPTOR_V1" },
    { tag: tags.PSBT_V1, exportName: "PSBT_V1" },
    { tag: tags.ACCOUNT_V1, exportName: "ACCOUNT_V1" },
    // Output Descriptors
    { tag: tags.OUTPUT_SCRIPT_HASH, exportName: "OUTPUT_SCRIPT_HASH" },
    { tag: tags.OUTPUT_WITNESS_SCRIPT_HASH, exportName: "OUTPUT_WITNESS_SCRIPT_HASH" },
    { tag: tags.OUTPUT_PUBLIC_KEY, exportName: "OUTPUT_PUBLIC_KEY" },
    { tag: tags.OUTPUT_PUBLIC_KEY_HASH, exportName: "OUTPUT_PUBLIC_KEY_HASH" },
    { tag: tags.OUTPUT_WITNESS_PUBLIC_KEY_HASH, exportName: "OUTPUT_WITNESS_PUBLIC_KEY_HASH" },
    { tag: tags.OUTPUT_COMBO, exportName: "OUTPUT_COMBO" },
    { tag: tags.OUTPUT_MULTISIG, exportName: "OUTPUT_MULTISIG" },
    { tag: tags.OUTPUT_SORTED_MULTISIG, exportName: "OUTPUT_SORTED_MULTISIG" },
    { tag: tags.OUTPUT_RAW_SCRIPT, exportName: "OUTPUT_RAW_SCRIPT" },
    { tag: tags.OUTPUT_TAPROOT, exportName: "OUTPUT_TAPROOT" },
    { tag: tags.OUTPUT_COSIGNER, exportName: "OUTPUT_COSIGNER" },
  ];

  return tagExports.map(({ tag }) => {
    const value = Number(tag.value);
    const categoryInfo = tagCategories[value] ?? { category: "Other" };
    return {
      value,
      name: tag.name ?? value.toString(),
      category: categoryInfo.category,
      deprecated: categoryInfo.deprecated,
    };
  });
}

// Build known values data from the @bcts/known-values bundled registries
function buildKnownValuesData(): KnownValueItem[] {
  const allValues = loadBundledRegistries();

  const seen = new Set<number>();
  const items: KnownValueItem[] = [];

  for (const kv of allValues) {
    const value = kv.value();
    if (seen.has(value)) continue;
    seen.add(value);
    const rawName = kv.name();
    items.push({
      value,
      name: rawName.includes(":") ? rawName.substring(rawName.indexOf(":") + 1) : rawName,
      category: getKnownValueCategory(value),
    });
  }

  return items;
}

// Cached data
let _tagsData: TagItem[] | null = null;
let _knownValuesData: KnownValueItem[] | null = null;

export function useRegistryData() {
  // Lazy initialization
  if (_tagsData === null) {
    _tagsData = buildTagsData();
  }
  if (_knownValuesData === null) {
    _knownValuesData = buildKnownValuesData();
  }

  return {
    tagsData: _tagsData,
    knownValuesData: _knownValuesData,
  };
}
