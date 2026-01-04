/// Format module exports for Gordian Envelope.
///
/// This module provides various formatting options for displaying and
/// serializing envelopes, including hex, diagnostic, notation, tree,
/// UR, and mermaid diagram formats.

// Export types
export type { TreeFormatOptions } from "./tree";

// Import side-effect modules to register prototype extensions
import "./hex";
import "./diagnostic";
import "./tree";
