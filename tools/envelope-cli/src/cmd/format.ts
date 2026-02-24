/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Format command - 1:1 port of cmd/format.rs
 *
 * Print the envelope in various textual formats.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import { bytesToHex } from "../data-types.js";

/**
 * Output format types for the format command.
 */
export enum FormatType {
  /** Envelope notation */
  Envelope = "envelope",
  /** Envelope tree */
  Tree = "tree",
  /** Mermaid format */
  Mermaid = "mermaid",
  /** CBOR diagnostic notation */
  Diag = "diag",
  /** CBOR hex */
  Cbor = "cbor",
  /** UR format */
  UR = "ur",
}

/**
 * Digest display format for tree output.
 */
export enum DigestFormatType {
  /** Display a shortened version of the digest (first 8 characters) */
  Short = "short",
  /** Display the full digest for each element in the tree */
  Full = "full",
  /** Display a `ur:digest` UR for each element in the tree */
  UR = "ur",
}

/**
 * Mermaid diagram orientation.
 */
export enum MermaidOrientationType {
  LeftToRight = "left-to-right",
  TopToBottom = "top-to-bottom",
  RightToLeft = "right-to-left",
  BottomToTop = "bottom-to-top",
}

/**
 * Mermaid color theme.
 */
export enum MermaidThemeType {
  Default = "default",
  Neutral = "neutral",
  Dark = "dark",
  Forest = "forest",
  Base = "base",
}

/**
 * Command arguments for the format command.
 */
export interface CommandArgs {
  /** Output format type */
  type: FormatType;
  /** For `tree` and `mermaid`, hides the NODE case and digests */
  hideNodes: boolean;
  /** For `tree`, specifies the format for displaying digests */
  digestFormat: DigestFormatType;
  /** For `mermaid`, specifies the color theme of the diagram */
  theme: MermaidThemeType;
  /** For `mermaid`, specifies the orientation of the diagram */
  orientation: MermaidOrientationType;
  /** For `mermaid`, do not color the nodes or edges */
  monochrome: boolean;
  /** The envelope to format */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    type: FormatType.Envelope,
    hideNodes: false,
    digestFormat: DigestFormatType.Short,
    theme: MermaidThemeType.Default,
    orientation: MermaidOrientationType.LeftToRight,
    monochrome: false,
  };
}

/**
 * Format command implementation.
 */
export class FormatCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    switch (this.args.type) {
      case FormatType.Envelope:
        return envelope.format();

      case FormatType.Tree:
        return envelope.treeFormat({
          hideNodes: this.args.hideNodes,
          digestDisplay: this.args.digestFormat,
        });

      case FormatType.Mermaid:
        // mermaidFormat doesn't take options in current implementation
        return envelope.mermaidFormat();

      case FormatType.Diag:
        return envelope.diagnostic();

      case FormatType.Cbor:
        return bytesToHex(envelope.taggedCborData());

      case FormatType.UR:
        return envelope.urString();
    }
  }
}

/**
 * Execute the format command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new FormatCommand(args).exec();
}
