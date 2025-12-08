import { Envelope } from "../base/envelope";
import { type EdgeType, edgeLabel } from "../base/walk";

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
  /// Format for displaying digests
  digestDisplay?: "short" | "full";
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

declare module "../base/envelope" {
  interface Envelope {
    /// Returns a tree-formatted string representation of the envelope.
    ///
    /// The tree format displays the hierarchical structure of the envelope,
    /// showing subjects, assertions, and their relationships.
    ///
    /// @param options - Optional formatting options
    /// @returns A tree-formatted string
    ///
    /// @example
    /// ```typescript
    /// const envelope = Envelope.new("Alice")
    ///   .addAssertion("knows", "Bob");
    ///
    /// console.log(envelope.treeFormat());
    /// // Output:
    /// // 9e3b0673 NODE
    /// //     13941b48 subj "Alice"
    /// //     f45afd77 ASSERTION
    /// //         db7dd21c pred "knows"
    /// //         76543210 obj "Bob"
    /// ```
    treeFormat(options?: TreeFormatOptions): string;

    /// Returns a short identifier for this envelope based on its digest.
    ///
    /// @param format - Format for the digest ('short' or 'full')
    /// @returns A digest identifier string
    shortId(format?: "short" | "full"): string;

    /// Returns a summary string for this envelope.
    ///
    /// @param maxLength - Maximum length of the summary
    /// @returns A summary string
    summary(maxLength?: number): string;
  }
}

/// Implementation of shortId()
Envelope.prototype.shortId = function (this: Envelope, format: "short" | "full" = "short"): string {
  const digest = this.digest();
  if (format === "full") {
    return digest.hex();
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

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.extractNull();
        return "null";
      } catch {
        // Fall through
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
