/**
 * FROST DKG and signing using Hubert as the distributed substrate.
 *
 * Port of lib.rs from frost-hubert-rust.
 *
 * @module
 */

// Re-export DKG module
export * from "./dkg/index.js";

// Re-export Registry module
export * from "./registry/index.js";

// Re-export command module
export * from "./cmd/index.js";

/**
 * Initialize the library by registering all required CBOR tags.
 *
 * Port of `run()` tag registration from lib.rs lines 14-16.
 */
export function registerTags(): void {
  const { registerTags: registerComponentsTags } = require("@bcts/components");
  const { registerTags: registerEnvelopeTags } = require("@bcts/envelope");
  const { registerTags: registerProvenanceMarkTags } = require("@bcts/provenance-mark");

  registerComponentsTags();
  registerEnvelopeTags();
  registerProvenanceMarkTags();
}
