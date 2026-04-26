/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { type EdgeType, edgeLabel } from "../base/walk";
import { getGlobalFormatContext, type FormatContext } from "./format-context";

// ============================================================================
// DigestDisplayFormat - Enum for digest display formatting
// ============================================================================

/**
 * Specifies the format for displaying envelope digests in tree output.
 *
 * Ported from bc-envelope-rust/src/format/tree/format/digest.rs
 */
export enum DigestDisplayFormat {
  /**
   * Short format: hex-encoded first 4 bytes of the digest (8 chars),
   * matching Rust `Digest::short_description`.
   * This is the default format.
   */
  Short = "short",

  /**
   * Full format: complete 64 hex character digest.
   */
  Full = "full",

  /**
   * UR format: digest encoded as a UR string.
   */
  UR = "ur",
}

/// Tree formatting for Gordian Envelopes.
///
/// This module provides functionality for creating textual tree
/// representations of envelopes, which is useful for debugging and visualizing
/// the hierarchical structure of complex envelopes.
///
/// The tree format displays each component of an envelope (subject and
/// assertions) as nodes in a tree, making it easy to understand the
/// hierarchical structure of nested envelopes. Each node includes:
///
/// - The first 8 characters of the element's digest (for easy reference)
/// - The type of the element (NODE, ASSERTION, ELIDED, etc.)
/// - The content of the element (for leaf nodes)

/// Options for tree formatting
export interface TreeFormatOptions {
  /// If true, hides NODE identifiers and only shows semantic content
  hideNodes?: boolean;
  /// Set of digest strings to highlight in the tree
  highlightDigests?: Set<string>;
  /// Format for displaying digests: "short" (8 hex chars matching Rust
  /// `short_description`), "full" (64 hex chars), or "ur" (UR string)
  digestDisplay?: DigestDisplayFormat | "short" | "full" | "ur";
  /// Optional format context used for tag name resolution and KnownValue
  /// summarisation. When omitted, the global format context is used —
  /// matching Rust `tree_format_opt(&self, opts: TreeFormatOpts)` which
  /// reads names off the global context unless callers override.
  context?: FormatContext;
}

/// Represents an element in the tree representation
interface TreeElement {
  /// Indentation level
  level: number;
  /// The envelope element
  envelope: Envelope;
  /// Type of incoming edge
  incomingEdge: EdgeType;
  /// Whether to show the digest ID
  showId: boolean;
  /// Whether this element is highlighted
  isHighlighted: boolean;
}

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

/// Implementation of shortId()
Envelope.prototype.shortId = function (
  this: Envelope,
  format: "short" | "full" | "ur" = "short",
): string {
  const digest = this.digest();
  if (format === "full") {
    return digest.hex();
  }
  if (format === "ur") {
    return digest.urString();
  }
  return digest.short();
};

/// Implementation of summary()
///
/// Mirrors Rust `Envelope::summary` (`bc-envelope-rust/src/format/
/// envelope_summary.rs`): defers to `summaryWithContext(maxLength,
/// global_context)`. KnownValue rendering, tag-name resolution for
/// arrays/maps/tagged values, and the truncation rules all live in the
/// context-aware path; the no-arg variant just uses the global context.
Envelope.prototype.summary = function (this: Envelope, maxLength = 40): string {
  return this.summaryWithContext(maxLength, getGlobalFormatContext());
};

/// Implementation of treeFormat()
///
/// Mirrors Rust `Envelope::tree_format_opt` (`bc-envelope-rust/src/format/
/// tree.rs`). For each element line we emit:
///
///   `[*]<short_id> [edge_label] <summary>`
///
/// The summary is rendered through {@link Envelope.summaryWithContext} —
/// **not** the context-free `summary()` — so KnownValue assertions appear
/// as their registered names (e.g. `'isA'`, `'note'`) instead of the
/// placeholder string `KNOWN_VALUE`. The format context defaults to the
/// global one (via {@link getGlobalFormatContext}); callers can override
/// per-call via {@link TreeFormatOptions.context}.
Envelope.prototype.treeFormat = function (this: Envelope, options: TreeFormatOptions = {}): string {
  const hideNodes = options.hideNodes ?? false;
  const highlightDigests = options.highlightDigests ?? new Set<string>();
  const digestDisplay = options.digestDisplay ?? "short";
  const context = options.context ?? getGlobalFormatContext();

  const elements: TreeElement[] = [];

  // Walk the envelope and collect elements
  this.walk(hideNodes, undefined, (envelope, level, incomingEdge, _state) => {
    const digestStr = envelope.digest().short();
    const isHighlighted = highlightDigests.has(digestStr);

    elements.push({
      level,
      envelope,
      incomingEdge,
      showId: !hideNodes,
      isHighlighted,
    });

    return [undefined, false];
  });

  // Format each element as a line
  const lines = elements.map((elem) => {
    const parts: string[] = [];

    if (elem.isHighlighted) {
      parts.push("*");
    }

    if (elem.showId) {
      parts.push(elem.envelope.shortId(digestDisplay));
    }

    const label = edgeLabel(elem.incomingEdge);
    if (label !== undefined && label !== "") {
      parts.push(label);
    }

    parts.push(elem.envelope.summaryWithContext(40, context));

    const line = parts.join(" ");
    const indent = " ".repeat(elem.level * 4);
    return indent + line;
  });

  return lines.join("\n");
};
