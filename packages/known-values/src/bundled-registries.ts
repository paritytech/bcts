/**
 * Bundled registry data loaded at build time.
 *
 * This module imports all JSON registry files from the `data/` directory
 * so they are embedded in the bundle and available in all environments
 * (Node.js, browser, etc.) without filesystem access.
 */

import { KnownValue } from "./known-value";

/**
 * A single entry in a known values JSON registry file.
 */
export interface RegistryEntry {
  /** The unique numeric identifier for this known value. */
  codepoint: number;
  /** The canonical string name for this known value. */
  name: string;
  /** The type of entry (e.g., "property", "class", "value"). */
  type?: string;
  /** An optional URI reference for this known value. */
  uri?: string;
  /** An optional human-readable description. */
  description?: string;
}

/**
 * Root structure of a known values JSON registry file.
 */
export interface RegistryFile {
  /** Metadata about this registry. */
  ontology?: { name?: string; source_url?: string; start_code_point?: number; processing_strategy?: string };
  /** Information about how this file was generated. */
  generated?: { tool?: string; version?: string };
  /** The known value entries in this registry. */
  entries: RegistryEntry[];
  /** Statistics about this registry (ignored during parsing). */
  statistics?: unknown;
}

// Import all bundled registry JSON files
import bcRegistry from "../data/0_blockchain_commons_registry.json";
import communityRegistry from "../data/1000_community_registry.json";
import rdfRegistry from "../data/2000_rdf_registry.json";
import rdfsRegistry from "../data/2050_rdfs_registry.json";
import owl2Registry from "../data/2100_owl2_registry.json";
import dceRegistry from "../data/2200_dce_registry.json";
import dctRegistry from "../data/2300_dct_registry.json";
import foafRegistry from "../data/2500_foaf_registry.json";
import skosRegistry from "../data/2700_skos_registry.json";
import solidRegistry from "../data/2800_solid_registry.json";
import vcRegistry from "../data/2900_vc_registry.json";
import gs1Registry from "../data/3000_gs1_registry.json";
import schemaRegistry from "../data/10000_schema_registry.json";
import communityExtRegistry from "../data/100000_community_registry.json";

/**
 * All bundled registries in load order.
 * Later entries override earlier entries when codepoints collide.
 */
const ALL_REGISTRIES: RegistryFile[] = [
  bcRegistry as RegistryFile,
  communityRegistry as RegistryFile,
  rdfRegistry as RegistryFile,
  rdfsRegistry as RegistryFile,
  owl2Registry as RegistryFile,
  dceRegistry as RegistryFile,
  dctRegistry as RegistryFile,
  foafRegistry as RegistryFile,
  skosRegistry as RegistryFile,
  solidRegistry as RegistryFile,
  vcRegistry as RegistryFile,
  gs1Registry as RegistryFile,
  schemaRegistry as RegistryFile,
  communityExtRegistry as RegistryFile,
];

/**
 * Loads all known values from the bundled JSON registry files.
 *
 * Returns a flat array of KnownValue instances parsed from all
 * bundled registry files. The caller is responsible for inserting
 * them into a KnownValuesStore (later entries override earlier ones
 * when codepoints match).
 */
export function loadBundledRegistries(): KnownValue[] {
  const values: KnownValue[] = [];
  for (const registry of ALL_REGISTRIES) {
    for (const entry of registry.entries) {
      values.push(new KnownValue(entry.codepoint, entry.name));
    }
  }
  return values;
}
