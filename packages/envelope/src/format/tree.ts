/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { type EdgeType, edgeLabel } from "../base/walk";

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
   * Short format: first 7 hex characters of the digest.
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
  /// Format for displaying digests: "short" (7 hex chars), "full" (64 hex chars), or "ur" (UR string)
  digestDisplay?: DigestDisplayFormat | "short" | "full" | "ur";
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
Envelope.prototype.summary = function (this: Envelope, maxLength = 40): string {
  const c = this.case();

  switch (c.type) {
    case "node":
      return "NODE";
    case "leaf": {
      // Try to extract a readable value
      try {
        const text = this.asText();
        if (text !== undefined) {
          const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
          return JSON.stringify(truncated);
        }
      } catch {
        // Fall through
      }

      try {
        const num = this.extractNumber();
        return String(num);
      } catch {
        // Fall through
      }

      try {
        const bool = this.extractBoolean();
        return String(bool);
      } catch {
        // Fall through
      }

      if (this.isNull()) {
        return "null";
      }

      // Fallback: show byte string
      const bytes = this.asByteString();
      if (bytes !== undefined && bytes.length <= 16) {
        const hex = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return `h'${hex}'`;
      }

      return "LEAF";
    }
    case "wrapped":
      return "WRAPPED";
    case "assertion":
      return "ASSERTION";
    case "elided":
      return "ELIDED";
    case "encrypted":
      return "ENCRYPTED";
    case "compressed":
      return "COMPRESSED";
    case "knownValue":
      return "KNOWN_VALUE";
    default:
      return "UNKNOWN";
  }
};

/// Implementation of treeFormat()
Envelope.prototype.treeFormat = function (this: Envelope, options: TreeFormatOptions = {}): string {
  const hideNodes = options.hideNodes ?? false;
  const highlightDigests = options.highlightDigests ?? new Set<string>();
  const digestDisplay = options.digestDisplay ?? "short";

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

    parts.push(elem.envelope.summary(40));

    const line = parts.join(" ");
    const indent = " ".repeat(elem.level * 4);
    return indent + line;
  });

  return lines.join("\n");
};
