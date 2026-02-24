/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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

// Re-export FROST cryptographic operations
export * as frost from "./frost/index.js";

// Type for modules that may have registerTags
interface TagModule {
  registerTags?: () => void;
}

/**
 * Initialize the library by registering all required CBOR tags.
 *
 * Port of `run()` tag registration from lib.rs lines 14-16.
 */
export async function registerTags(): Promise<void> {
  const components = (await import("@bcts/components")) as TagModule;
  const envelope = (await import("@bcts/envelope")) as TagModule;
  const provenanceMark = (await import("@bcts/provenance-mark")) as TagModule;

  if (typeof components.registerTags === "function") {
    components.registerTags();
  }
  if (typeof envelope.registerTags === "function") {
    envelope.registerTags();
  }
  if (typeof provenanceMark.registerTags === "function") {
    provenanceMark.registerTags();
  }
}
