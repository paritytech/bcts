/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Blockchain Commons CBOR Tags Registry
 *
 * This package provides a comprehensive registry of CBOR tags used by
 * Blockchain Commons protocols, including Gordian Envelope and related
 * cryptographic specifications.
 *
 * This is a 1:1 port of the Rust bc-tags-rust library.
 *
 * @packageDocumentation
 */

export * from "./tags-registry";

// Re-export getGlobalTagsStore from dcbor for convenience
export { getGlobalTagsStore, type TagsStore } from "@bcts/dcbor";
