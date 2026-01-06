/// Format module exports for Gordian Envelope.
///
/// This module provides various formatting options for displaying and
/// serializing envelopes, including hex, diagnostic, notation, tree,
/// UR, and mermaid diagram formats.

// Export types
export type { TreeFormatOptions } from "./tree";

// Export format context
export {
  type FormatContextOpt,
  FormatContext,
  formatContextNone,
  formatContextGlobal,
  formatContextCustom,
  getGlobalFormatContext,
  globalFormatContext,
  withFormatContext,
  withFormatContextMut,
  registerTags,
  registerTagsIn,
  GLOBAL_FORMAT_CONTEXT,
} from "./format-context";

// Export envelope summary
export { type EnvelopeSummary, cborEnvelopeSummary, envelopeSummary } from "./envelope-summary";

// Export notation formatting
export {
  type EnvelopeFormatOpts,
  type EnvelopeFormatItem,
  formatEnvelope,
  formatCbor,
  formatAssertion,
  defaultFormatOpts,
  flatFormatOpts,
  formatBegin,
  formatEnd,
  formatItem,
  formatSeparator,
  formatList,
} from "./notation";

// Export mermaid formatting
export {
  MermaidOrientation,
  MermaidTheme,
  type MermaidFormatOpts,
  defaultMermaidOpts,
  registerMermaidExtension,
} from "./mermaid";

// Import side-effect modules to register prototype extensions
import "./hex";
import "./diagnostic";
import "./tree";
import "./envelope-summary";
import "./notation";
import "./mermaid";
