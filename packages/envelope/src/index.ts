/// Gordian Envelope TypeScript Library
///
/// A TypeScript implementation of Blockchain Commons' Gordian Envelope
/// specification for structured, privacy-focused data containers.
///
/// This is a 1:1 port of the Rust bc-envelope library, maintaining the same
/// API structure and functionality.
///
/// @module bc-envelope

// Re-export everything from the base module
export * from "./base";

// Re-export everything from the extension module
export * from "./extension";

// Import registration functions and call them to ensure proper initialization order
import { registerEncryptExtension, encryptWholeEnvelope } from "./extension/encrypt";
import { registerCompressExtension } from "./extension/compress";
import { registerProofExtension } from "./extension/proof";
import { registerSecretExtension } from "./extension/secret";
import { registerSskrExtension } from "./extension/sskr";
import { registerObscureEncryptHandler } from "./base/elide";
import type { SymmetricKey } from "@bcts/components";
registerEncryptExtension();
registerCompressExtension();
registerProofExtension();
registerSecretExtension();
registerSskrExtension();
// Wire up obscure action handlers after all extensions are registered
registerObscureEncryptHandler((env, key) => encryptWholeEnvelope(env, key as SymmetricKey));

// Re-export everything from the format module
// Import for side effects (registers prototype extensions like treeFormat)
import "./format";
export * from "./format";

// Import edge module for side effects (registers prototype extensions)
import "./extension/edge";

// Import seal module for side effects (registers prototype extensions)
import "./seal";
export { registerSealExtension } from "./seal";

// Re-export everything from the utils module
export * from "./utils";

// Version information
export const VERSION = "0.37.0";
